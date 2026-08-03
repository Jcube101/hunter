// particles.test.js — Area D of the Session 17 audit. Pure lifecycle math;
// drawParticles (canvas) is covered only for the globalAlpha-reset invariant.

import { describe, it, expect, vi } from 'vitest'
import { spawnParticles, updateParticles, updateParticlesInPlace, drawParticles } from './particles.js'

describe('spawnParticles', () => {
  it('yields between 8 and 12 particles, all starting at the given position', () => {
    for (let i = 0; i < 20; i++) {
      const particles = spawnParticles(50, 60)
      expect(particles.length).toBeGreaterThanOrEqual(8)
      expect(particles.length).toBeLessThanOrEqual(12)
      for (const p of particles) {
        expect(p.x).toBe(50)
        expect(p.y).toBe(60)
        expect(p.life).toBe(p.maxLife)
        expect(p.life).toBe(20) // LIFESPAN
        const speed = Math.hypot(p.vx, p.vy)
        expect(speed).toBeGreaterThanOrEqual(0.6)
        expect(speed).toBeLessThanOrEqual(2.2)
        expect(p.radius).toBeGreaterThanOrEqual(1.5)
        expect(p.radius).toBeLessThanOrEqual(3.5)
      }
    }
  })
})

describe('updateParticles', () => {
  it('decrements life and drops particles at life<=0, returning a new array', () => {
    const particles = [{ x: 0, y: 0, vx: 0, vy: 0, radius: 1, life: 1, maxLife: 20 }]
    const result = updateParticles(particles, 1)
    expect(result).toHaveLength(0)
    expect(result).not.toBe(particles)
  })

  it('applies buoyancy (extra -0.3 y) and 0.92 velocity damping', () => {
    const particles = [{ x: 0, y: 0, vx: 1, vy: 1, radius: 1, life: 20, maxLife: 20 }]
    const [p] = updateParticles(particles, 1)
    expect(p.x).toBeCloseTo(1)
    expect(p.y).toBeCloseTo(1 - 0.3)
    expect(p.vx).toBeCloseTo(0.92)
    expect(p.vy).toBeCloseTo(0.92)
    expect(p.life).toBe(19)
  })

  it('scales the position advance by dt', () => {
    const particles = [{ x: 0, y: 0, vx: 2, vy: 0, radius: 1, life: 20, maxLife: 20 }]
    const [p1] = updateParticles(particles, 1)
    const [p2] = updateParticles(particles, 2)
    expect(p2.x).toBeCloseTo(2 * p1.x)
  })

  it('a full burst expires after LIFESPAN frames', () => {
    let particles = spawnParticles(0, 0)
    for (let i = 0; i < 20; i++) particles = updateParticles(particles, 1)
    expect(particles).toHaveLength(0)
  })
})

// --- O11 equivalence proof (ROADMAP.md O11) ---------------------------------
// updateParticlesInPlace exists purely as a lower-allocation path for
// App.jsx's hot loop (mutates + compacts in place instead of spreading into
// a new array). Same arithmetic as updateParticles — an actual trajectory
// comparison across a full burst's lifespan, not just "tests pass".
describe('updateParticlesInPlace — equivalence with updateParticles (O11 proof)', () => {
  it('produces identical particle states to updateParticles across a full burst lifespan (varying dt)', () => {
    const seed = spawnParticles(100, 200) // 8-12 particles, randomised velocities/radii
    let pure = seed.map((p) => ({ ...p }))
    let opt = seed.map((p) => ({ ...p }))

    // LIFESPAN is 20 frames; run a few extra ticks to also exercise the
    // "already empty" tail.
    for (let t = 0; t < 24; t++) {
      const dt = 1 + 0.4 * Math.sin(t * 0.31)
      pure = updateParticles(pure, dt)
      updateParticlesInPlace(opt, dt)
      expect(opt, `state at tick ${t}`).toEqual(pure)
    }
  })

  it('mutates and compacts the array in place rather than allocating a new one', () => {
    const particles = [
      { x: 0, y: 0, vx: 1, vy: 1, radius: 1, life: 1, maxLife: 20 }, // dies this tick
      { x: 5, y: 5, vx: 0, vy: 0, radius: 1, life: 20, maxLife: 20 }, // survives
    ]
    const result = updateParticlesInPlace(particles, 1)
    expect(result).toBe(particles) // same array reference, not a new one
    expect(particles).toHaveLength(1)
    expect(particles[0].x).toBeCloseTo(5)
  })

  it('does not allocate (array identity unchanged) when nothing dies this frame', () => {
    const particles = [{ x: 0, y: 0, vx: 1, vy: 1, radius: 1, life: 20, maxLife: 20 }]
    const before = particles
    updateParticlesInPlace(particles, 1)
    expect(particles).toBe(before)
    expect(particles).toHaveLength(1)
  })
})

describe('drawParticles', () => {
  it('resets globalAlpha to 1 after drawing', () => {
    const ctx = {
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: null,
      globalAlpha: 1,
    }
    const particles = [{ x: 0, y: 0, radius: 1, life: 10, maxLife: 20 }]
    const camera = { x: 0, y: 0 }
    drawParticles(ctx, particles, camera)
    expect(ctx.globalAlpha).toBe(1)
  })
})
