// predator.test.js — Areas M/N of the Session 17 audit. Tests the pure
// functions extracted from App.jsx (Session 18): stepPredator (movement) and
// resolveCatches (catch detection). Same math as the original inline closures.

import { describe, it, expect } from 'vitest'
import { stepPredator, resolveCatches } from './predator.js'
import { SHARK_SPEED, SHARK_MOUTH_OFFSET, HITBOX_RADIUS } from '../constants/boids.js'

describe('stepPredator', () => {
  const world = { width: 1000, height: 1000 }

  it('mouse mode: steps toward the target without overshooting', () => {
    const predator = { x: 0, y: 0, vx: 0, vy: 0, angle: 0 }
    const target = { x: 2, y: 0 } // closer than one full speed-step
    const result = stepPredator(predator, target, world, 1)
    expect(result.x).toBeCloseTo(2) // clamped to the target, not overshot
    expect(result.y).toBeCloseTo(0)
  })

  it('mouse mode: moves at full SHARK_SPEED toward a distant target', () => {
    const predator = { x: 0, y: 0, vx: 0, vy: 0, angle: 0 }
    const target = { x: 1000, y: 0 }
    const result = stepPredator(predator, target, world, 1)
    expect(result.x).toBeCloseTo(SHARK_SPEED)
  })

  it('mouse mode: holds position when input is null', () => {
    const predator = { x: 50, y: 50, vx: 0, vy: 0, angle: 0 }
    const result = stepPredator(predator, null, world, 1)
    expect(result.x).toBe(50)
    expect(result.y).toBe(50)
    expect(result.vx).toBe(0)
    expect(result.vy).toBe(0)
  })

  it('joystick mode: velocity is proportional to stick displacement', () => {
    const predator = { x: 500, y: 500, vx: 0, vy: 0, angle: 0 }
    const input = { dx: 0.5, dy: 0, isJoystick: true }
    const result = stepPredator(predator, input, world, 1)
    expect(result.x - predator.x).toBeCloseTo(0.5 * SHARK_SPEED)
    expect(result.y - predator.y).toBeCloseTo(0)
  })

  it('joystick mode: full displacement (|d|=1) moves at full SHARK_SPEED', () => {
    const predator = { x: 500, y: 500, vx: 0, vy: 0, angle: 0 }
    const input = { dx: 1, dy: 0, isJoystick: true }
    const result = stepPredator(predator, input, world, 1)
    expect(result.x - predator.x).toBeCloseTo(SHARK_SPEED)
  })

  it('hard-stops at the world edge and zeros the wall-axis velocity', () => {
    // Target is far beyond the wall so the full-speed step would overshoot it.
    const predator = { x: 998, y: 500, vx: 0, vy: 0, angle: 0 }
    const target = { x: 2000, y: 500 }
    const result = stepPredator(predator, target, world, 1)
    expect(result.x).toBe(1000)
    expect(result.vx).toBe(0)
  })

  it('hard-stops at the zero edge too', () => {
    const predator = { x: 2, y: 500, vx: 0, vy: 0, angle: 0 }
    const target = { x: -1000, y: 500 }
    const result = stepPredator(predator, target, world, 1)
    expect(result.x).toBe(0)
    expect(result.vx).toBe(0)
  })

  it('updates angle only above the rotation velocity threshold', () => {
    const predator = { x: 500, y: 500, vx: 0, vy: 0, angle: 1.23 }
    // A target 0.01px away yields a velocity far below the threshold.
    const result = stepPredator(predator, { x: 500.01, y: 500 }, world, 1)
    expect(result.angle).toBe(1.23) // held, not jittered
  })

  it('updates angle to face the direction of travel when moving', () => {
    const predator = { x: 500, y: 500, vx: 0, vy: 0, angle: 0 }
    const result = stepPredator(predator, { x: 500, y: 600 }, world, 1)
    expect(result.angle).toBeCloseTo(Math.PI / 2) // facing +y
  })

  it('returns a new object and does not mutate the input', () => {
    const predator = { x: 500, y: 500, vx: 0, vy: 0, angle: 0 }
    const snapshot = { ...predator }
    const result = stepPredator(predator, { x: 600, y: 500 }, world, 1)
    expect(result).not.toBe(predator)
    expect(predator).toEqual(snapshot)
  })
})

describe('resolveCatches', () => {
  it('catches a fish within HITBOX_RADIUS of the mouth point', () => {
    const predator = { x: 0, y: 0, angle: 0 } // mouth at (SHARK_MOUTH_OFFSET, 0)
    const close = { x: SHARK_MOUTH_OFFSET + HITBOX_RADIUS - 1, y: 0 }
    const { survivors, caught } = resolveCatches([close], predator)
    expect(caught).toEqual([close])
    expect(survivors).toEqual([])
  })

  it('does not catch a fish outside HITBOX_RADIUS of the mouth point', () => {
    const predator = { x: 0, y: 0, angle: 0 }
    const far = { x: SHARK_MOUTH_OFFSET + HITBOX_RADIUS + 5, y: 0 }
    const { survivors, caught } = resolveCatches([far], predator)
    expect(caught).toEqual([])
    expect(survivors).toEqual([far])
  })

  it('mouth position follows the predator angle', () => {
    const predator = { x: 0, y: 0, angle: Math.PI } // facing -x, mouth at (-28, 0)
    const behindFish = { x: -SHARK_MOUTH_OFFSET, y: 0 }
    const { caught } = resolveCatches([behindFish], predator)
    expect(caught).toEqual([behindFish])
  })

  it('preserves survivor order and catches multiple fish in one pass', () => {
    const predator = { x: 0, y: 0, angle: 0 }
    const mouthX = SHARK_MOUTH_OFFSET
    const a = { x: mouthX, y: 0 } // caught
    const b = { x: 1000, y: 1000 } // survives
    const c = { x: mouthX + 1, y: 0 } // caught
    const { survivors, caught } = resolveCatches([a, b, c], predator)
    expect(survivors).toEqual([b])
    expect(caught).toEqual([a, c])
  })

  it('does not mutate the input fish array', () => {
    const predator = { x: 0, y: 0, angle: 0 }
    const fish = [{ x: SHARK_MOUTH_OFFSET, y: 0 }, { x: 500, y: 500 }]
    const snapshot = fish.map((f) => ({ ...f }))
    resolveCatches(fish, predator)
    expect(fish).toEqual(snapshot)
  })
})
