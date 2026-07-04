// boids.test.js — Area A of the Session 17 audit. Pure math, no DOM/canvas.
// Force functions are tested directly; `normalize`/`clampMagnitude`/`maxSpeedFor`
// stay module-private (audit decision D9) and are exercised indirectly through
// separation/alignment/cohesion (normalize) and updateFish (clampMagnitude +
// the speed ramp).

import { describe, it, expect } from 'vitest'
import {
  separation,
  alignment,
  cohesion,
  flee,
  edgeRepulsion,
  anchorForce,
  updateFish,
  updateSchool,
  initFish,
} from './boids.js'
import { FISH_BASE_SPEED, FISH_FLEE_SPEED, INITIAL_VELOCITY_RANGE } from '../constants/boids.js'

describe('separation', () => {
  it('steers away from a single close neighbor', () => {
    const fish = { x: 10, y: 0, vx: 0, vy: 0 }
    const other = { x: 5, y: 0, vx: 0, vy: 0 }
    const f = separation(fish, [fish, other], 25, 1.5)
    expect(f.x).toBeCloseTo(1.5) // pushed +x, away from the neighbor at smaller x
    expect(f.y).toBeCloseTo(0)
  })

  it('ignores a neighbor outside the radius', () => {
    const fish = { x: 0, y: 0 }
    const other = { x: 30, y: 0 }
    const f = separation(fish, [fish, other], 25, 1.5)
    expect(f).toEqual({ x: 0, y: 0 })
  })

  it('skips itself even when present in the neighbor list', () => {
    const fish = { x: 0, y: 0 }
    const f = separation(fish, [fish], 25, 1.5)
    expect(f).toEqual({ x: 0, y: 0 })
  })

  it('two symmetric neighbors cancel to zero', () => {
    const fish = { x: 0, y: 0 }
    const left = { x: -5, y: 0 }
    const right = { x: 5, y: 0 }
    const f = separation(fish, [fish, left, right], 25, 1.5)
    expect(f.x).toBeCloseTo(0)
    expect(f.y).toBeCloseTo(0)
  })

  it('a much closer neighbor dominates the resultant direction (1/d^2 weighting)', () => {
    const fish = { x: 0, y: 0 }
    const near = { x: -1, y: 0 } // distance 1
    const far = { x: 0, y: -20 } // distance 20, different axis
    const f = separation(fish, [fish, near, far], 25, 1)
    // Direction should be dominated by the near neighbor's axis (+x).
    expect(f.x).toBeGreaterThan(0.9)
    expect(Math.abs(f.y)).toBeLessThan(0.1)
  })
})

describe('alignment', () => {
  it('returns zero with no neighbors in radius', () => {
    const fish = { x: 0, y: 0 }
    expect(alignment(fish, [fish], 60, 1)).toEqual({ x: 0, y: 0 })
  })

  it('ignores neighbors outside the radius', () => {
    const fish = { x: 0, y: 0 }
    const far = { x: 1000, y: 0, vx: 5, vy: 0 }
    expect(alignment(fish, [fish, far], 60, 1)).toEqual({ x: 0, y: 0 })
  })

  it('steers toward the normalized average heading of in-radius neighbors', () => {
    const fish = { x: 0, y: 0 }
    const a = { x: 10, y: 0, vx: 1, vy: 0 }
    const b = { x: 0, y: 10, vx: 0, vy: 1 }
    const f = alignment(fish, [fish, a, b], 60, 1)
    expect(f.x).toBeCloseTo(Math.SQRT1_2)
    expect(f.y).toBeCloseTo(Math.SQRT1_2)
  })
})

describe('cohesion', () => {
  it('returns zero with no neighbors in radius', () => {
    const fish = { x: 0, y: 0 }
    expect(cohesion(fish, [fish], 100, 1)).toEqual({ x: 0, y: 0 })
  })

  it('steers toward the centroid of in-radius neighbors', () => {
    const fish = { x: 0, y: 0 }
    const other = { x: 10, y: 0 }
    const f = cohesion(fish, [fish, other], 100, 1)
    expect(f.x).toBeCloseTo(1)
    expect(f.y).toBeCloseTo(0)
  })

  it('is zero when the fish is already at the neighbor centroid', () => {
    const fish = { x: 0, y: 0 }
    const left = { x: -5, y: 0 }
    const right = { x: 5, y: 0 }
    const f = cohesion(fish, [fish, left, right], 100, 1)
    expect(f.x).toBeCloseTo(0)
    expect(f.y).toBeCloseTo(0)
  })
})

describe('flee', () => {
  it('flees away from a predator within radius', () => {
    const fish = { x: 10, y: 0 }
    const predator = { x: 0, y: 0 }
    const f = flee(fish, predator, 20, 3)
    expect(f.x).toBeCloseTo(3)
    expect(f.y).toBeCloseTo(0)
  })

  it('returns zero when the predator is beyond the flee radius', () => {
    const fish = { x: 100, y: 0 }
    const predator = { x: 0, y: 0 }
    expect(flee(fish, predator, 20, 3)).toEqual({ x: 0, y: 0 })
  })

  it('returns zero when there is no predator', () => {
    const fish = { x: 10, y: 0 }
    expect(flee(fish, null, 20, 3)).toEqual({ x: 0, y: 0 })
  })

  it('returns zero when the predator exactly coincides with the fish', () => {
    const fish = { x: 5, y: 5 }
    const predator = { x: 5, y: 5 }
    expect(flee(fish, predator, 20, 3)).toEqual({ x: 0, y: 0 })
  })

  it('is zero exactly at the radius boundary (>=, not >)', () => {
    const fish = { x: 20, y: 0 }
    const predator = { x: 0, y: 0 }
    expect(flee(fish, predator, 20, 3)).toEqual({ x: 0, y: 0 })
  })
})

describe('edgeRepulsion', () => {
  const world = { width: 1000, height: 1000 }

  it('is zero in open water, far from every edge', () => {
    const fish = { x: 500, y: 500 }
    expect(edgeRepulsion(fish, world, 120, 3)).toEqual({ x: 0, y: 0 })
  })

  it('pushes right, away from the left edge', () => {
    const fish = { x: 10, y: 500 }
    const f = edgeRepulsion(fish, world, 120, 1)
    expect(f.x).toBeCloseTo((120 - 10) / 120)
    expect(f.y).toBeCloseTo(0)
  })

  it('pushes left, away from the right edge', () => {
    const fish = { x: 990, y: 500 }
    const f = edgeRepulsion(fish, world, 120, 1)
    expect(f.x).toBeCloseTo(-(120 - 10) / 120)
  })

  it('ramps from zero at the radius to full strength at the wall', () => {
    const atRadius = edgeRepulsion({ x: 120, y: 500 }, world, 120, 1)
    const atWall = edgeRepulsion({ x: 0, y: 500 }, world, 120, 1)
    expect(atRadius.x).toBeCloseTo(0)
    expect(atWall.x).toBeCloseTo(1)
  })

  it('sums both axes in a corner', () => {
    const fish = { x: 10, y: 10 }
    const f = edgeRepulsion(fish, world, 120, 1)
    expect(f.x).toBeGreaterThan(0)
    expect(f.y).toBeGreaterThan(0)
  })
})

describe('anchorForce', () => {
  it('is zero when already at world center', () => {
    const world = { width: 100, height: 100 }
    const fish = { x: 50, y: 50 }
    expect(anchorForce(fish, world, 0.02)).toEqual({ x: 0, y: 0 })
  })

  it('pulls toward center from the top-left quadrant', () => {
    const world = { width: 100, height: 100 }
    const fish = { x: 0, y: 0 }
    const f = anchorForce(fish, world, 1)
    expect(f.x).toBeCloseTo(Math.SQRT1_2)
    expect(f.y).toBeCloseTo(Math.SQRT1_2)
  })

  it('pulls toward center from the bottom-right quadrant (opposite sign)', () => {
    const world = { width: 100, height: 100 }
    const fish = { x: 100, y: 100 }
    const f = anchorForce(fish, world, 1)
    expect(f.x).toBeCloseTo(-Math.SQRT1_2)
    expect(f.y).toBeCloseTo(-Math.SQRT1_2)
  })
})

describe('updateFish', () => {
  const world = { width: 200, height: 200 } // fish placed at center (100,100)

  it('returns a new object and does not mutate the input', () => {
    const fish = { x: 100, y: 100, vx: 1, vy: 0 }
    const snapshot = { ...fish }
    const result = updateFish(fish, [fish], null, world, 1)
    expect(result).not.toBe(fish)
    expect(fish).toEqual(snapshot)
  })

  it('scales the position advance by dt (velocity unaffected)', () => {
    const fish = { x: 100, y: 100, vx: 1, vy: 0 }
    const dt1 = updateFish(fish, [fish], null, world, 1)
    const dt2 = updateFish(fish, [fish], null, world, 2)
    expect(dt2.x - fish.x).toBeCloseTo(2 * (dt1.x - fish.x))
  })

  it('clamps speed to FISH_BASE_SPEED with no predator in range', () => {
    // Large initial velocity should be clamped down to the base speed.
    const fish = { x: 100, y: 100, vx: 50, vy: 0 }
    const result = updateFish(fish, [fish], null, world, 1)
    const speed = Math.hypot(result.vx, result.vy)
    expect(speed).toBeCloseTo(FISH_BASE_SPEED, 1)
  })

  it('ramps toward FISH_FLEE_SPEED as the predator closes to contact', () => {
    const fish = { x: 100, y: 100, vx: 50, vy: 0 }
    const predator = { x: 100.1, y: 100 } // essentially touching
    const result = updateFish(fish, [fish], predator, world, 1)
    const speed = Math.hypot(result.vx, result.vy)
    expect(speed).toBeCloseTo(FISH_FLEE_SPEED, 1)
  })

  it('flee dominates when the predator is within range (default weight 3.0)', () => {
    const fish = { x: 100, y: 100, vx: 0, vy: 0 }
    const predator = { x: 95, y: 100 } // 5px away, well within FLEE_RADIUS
    const result = updateFish(fish, [fish], predator, world, 1)
    // Fish should move away from the predator (+x), not toward world center
    // (which is where it already is, so anchor contributes ~0 anyway).
    expect(result.vx).toBeGreaterThan(0)
  })

  it('a custom fleeRadius overrides the FLEE_RADIUS default', () => {
    const fish = { x: 100, y: 100, vx: 0, vy: 0 }
    const predator = { x: 100 - 95, y: 100 } // distance 95
    // Default FLEE_RADIUS (100) => within range => flee active => faster.
    const withDefault = updateFish(fish, [fish], predator, world, 1)
    // Easy's radius (90) => 95 is outside => flee inactive => base speed only.
    const withEasyRadius = updateFish(fish, [fish], predator, world, 1, 2.5, 90)
    const speedDefault = Math.hypot(withDefault.vx, withDefault.vy)
    const speedEasy = Math.hypot(withEasyRadius.vx, withEasyRadius.vy)
    expect(speedDefault).toBeGreaterThan(speedEasy)
    expect(speedEasy).toBeCloseTo(0, 5) // no forces at all triggered, held still
  })
})

describe('updateSchool', () => {
  // Large world, fish placed near its center — far enough from every wall
  // (EDGE_REPULSION_RADIUS=120) that only separation/cohesion/anchor are in
  // play, keeping the symmetry check below unambiguous.
  const world = { width: 1000, height: 1000 }

  it('returns a new array of the same length without mutating the input', () => {
    const fish = [
      { x: 495, y: 500, vx: 0, vy: 0 },
      { x: 505, y: 500, vx: 0, vy: 0 },
    ]
    const snapshot = fish.map((f) => ({ ...f }))
    const result = updateSchool(fish, null, world, 1)
    expect(result).not.toBe(fish)
    expect(result).toHaveLength(2)
    expect(fish).toEqual(snapshot)
  })

  it('every fish reacts to the same pre-tick snapshot (symmetric separation)', () => {
    const a = { x: 495, y: 500, vx: 0, vy: 0 }
    const b = { x: 505, y: 500, vx: 0, vy: 0 }
    const result = updateSchool([a, b], null, world, 1)
    // Both fish should move apart symmetrically — neither sees the other's
    // already-updated position mid-tick.
    expect(result[0].x).toBeLessThan(a.x)
    expect(result[1].x).toBeGreaterThan(b.x)
  })
})

describe('initFish', () => {
  const world = { width: 1000, height: 800 }

  it('spawns the requested count, clustered near center, within velocity range', () => {
    const count = 25
    const fish = initFish(count, world)
    expect(fish).toHaveLength(count)
    const cx = world.width / 2
    const cy = world.height / 2
    const clusterRadius = Math.min(world.width, world.height) * 0.12
    for (const f of fish) {
      expect(Math.hypot(f.x - cx, f.y - cy)).toBeLessThanOrEqual(clusterRadius + 1e-9)
      expect(Math.abs(f.vx)).toBeLessThanOrEqual(INITIAL_VELOCITY_RANGE)
      expect(Math.abs(f.vy)).toBeLessThanOrEqual(INITIAL_VELOCITY_RANGE)
    }
  })

  it('returns an empty array for count=0', () => {
    expect(initFish(0, world)).toEqual([])
  })
})
