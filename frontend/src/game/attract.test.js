// attract.test.js — Area B of the Session 17 audit. Pure math, no DOM/canvas.
//
// Note: updateAttractShark's "hold angle when nearly still" branch (mirrored
// from the real predator's rotation-jitter guard) turns out to be unreachable
// with the real ATTRACT_WANDER_WEIGHT (0.45) constant — the seek unit vector
// and the wander vector can never sum to exactly zero unless the wander
// weight were 1.0. Not tested directly for that reason (a discovered nuance,
// not a bug — flagged in the Session 18 report rather than asserting
// impossible behavior).

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  initAttractShark,
  initAttractFish,
  updateAttractShark,
  catchAndRespawn,
  stepAttract,
} from './attract.js'
import { ATTRACT_FISH_COUNT, ATTRACT_CATCH_RADIUS, FLEE_RADIUS } from '../constants/boids.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('initAttractShark', () => {
  it('spawns at world center with zero velocity and a wander angle in [0, 2*PI)', () => {
    const world = { width: 800, height: 600 }
    const shark = initAttractShark(world)
    expect(shark.x).toBe(400)
    expect(shark.y).toBe(300)
    expect(shark.vx).toBe(0)
    expect(shark.vy).toBe(0)
    expect(shark.wander).toBeGreaterThanOrEqual(0)
    expect(shark.wander).toBeLessThan(Math.PI * 2)
  })
})

describe('initAttractFish', () => {
  const world = { width: 800, height: 600 }

  it('defaults to ATTRACT_FISH_COUNT', () => {
    expect(initAttractFish(world)).toHaveLength(ATTRACT_FISH_COUNT)
  })

  it('honors an explicit count override', () => {
    expect(initAttractFish(world, 7)).toHaveLength(7)
  })
})

describe('updateAttractShark', () => {
  const world = { width: 2000, height: 2000 }

  it('seeks the nearest of several fish (deterministic wander via mocked Math.random)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // wander turn delta = 0
    const shark = { x: 1000, y: 1000, vx: 0, vy: 0, angle: 0, wander: 0 }
    const near = { x: 1010, y: 1000 } // 10px away
    const far = { x: 1000, y: 0 } // 1000px away
    const result = updateAttractShark(shark, [near, far], world, 1)
    expect(result.vx).toBeGreaterThan(0) // moves toward the near fish (+x)
    expect(result.x).toBeGreaterThan(shark.x)
  })

  it('stays within the viewport bounds when driven toward an edge', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const shark = { x: 5, y: 5, vx: 0, vy: 0, angle: 0, wander: Math.PI } // wander points -x
    const result = updateAttractShark(shark, [], world, 5) // large dt to overshoot
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(result.y).toBeGreaterThanOrEqual(0)
    expect(result.x).toBeLessThanOrEqual(world.width)
    expect(result.y).toBeLessThanOrEqual(world.height)
  })

  it('still moves via pure wander when there are no fish', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const shark = { x: 1000, y: 1000, vx: 0, vy: 0, angle: 0, wander: 0 }
    const result = updateAttractShark(shark, [], world, 1)
    expect(Math.hypot(result.vx, result.vy)).toBeGreaterThan(0)
  })

  it('returns a new object and does not mutate the input', () => {
    const shark = { x: 1000, y: 1000, vx: 0, vy: 0, angle: 0, wander: 0 }
    const snapshot = { ...shark }
    const result = updateAttractShark(shark, [], world, 1)
    expect(result).not.toBe(shark)
    expect(shark).toEqual(snapshot)
  })
})

describe('catchAndRespawn', () => {
  const world = { width: 2000, height: 2000 }

  it('replaces a fish at the mouth point (nose side) with a respawned one', () => {
    const shark = { x: 1000, y: 1000, angle: 0 } // facing +x
    const mouthX = shark.x + 28 // SHARK_MOUTH_OFFSET
    const caughtFish = { x: mouthX, y: shark.y, vx: 0, vy: 0 }
    const fish = [caughtFish]
    const result = catchAndRespawn(fish, shark, world)
    expect(result).not.toBe(fish) // a catch happened -> new array reference
    expect(result[0]).not.toBe(caughtFish) // the caught fish object was replaced
  })

  it('does NOT catch a fish on the tail side, opposite the mouth', () => {
    const shark = { x: 1000, y: 1000, angle: 0 } // facing +x, mouth is at +x
    const tailFish = { x: shark.x - 28, y: shark.y, vx: 0, vy: 0 } // behind the shark
    const fish = [tailFish]
    const result = catchAndRespawn(fish, shark, world)
    expect(result).toBe(fish) // same-reference no-op: nothing was caught
    expect(result[0]).toEqual(tailFish) // untouched — still the same fish
  })

  it('returns the SAME array reference when nothing is caught (cheap no-op frame)', () => {
    const shark = { x: 1000, y: 1000, angle: 0 }
    const fish = [{ x: 0, y: 0, vx: 0, vy: 0 }]
    const result = catchAndRespawn(fish, shark, world)
    expect(result).toBe(fish)
  })

  it('respawns a caught fish outside FLEE_RADIUS of the shark', () => {
    const shark = { x: 1000, y: 1000, angle: 0 }
    const mouthX = shark.x + 28
    const caughtFish = { x: mouthX, y: shark.y, vx: 0, vy: 0 }
    const result = catchAndRespawn([caughtFish], shark, world)
    const respawned = result[0]
    const dist = Math.hypot(respawned.x - shark.x, respawned.y - shark.y)
    expect(dist).toBeGreaterThanOrEqual(FLEE_RADIUS)
  })

  it('catch radius is respected: a fish just outside ATTRACT_CATCH_RADIUS is not caught', () => {
    const shark = { x: 1000, y: 1000, angle: 0 }
    const mouthX = shark.x + 28
    const justOutside = { x: mouthX + ATTRACT_CATCH_RADIUS + 1, y: shark.y, vx: 0, vy: 0 }
    const result = catchAndRespawn([justOutside], shark, world)
    expect(result).toEqual([justOutside])
  })
})

describe('stepAttract', () => {
  const world = { width: 2000, height: 2000 }

  it('conserves fish count (respawn, never remove) and returns {fish, shark}', () => {
    const fish = initAttractFish(world, 10)
    const shark = initAttractShark(world)
    const result = stepAttract(fish, shark, world, 1)
    expect(result.fish).toHaveLength(10)
    expect(result.shark).toBeTruthy()
    expect(typeof result.shark.x).toBe('number')
  })
})
