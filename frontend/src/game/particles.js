// particles.js — bubble-burst particle system. Lifecycle + drawing only.
//
// Particles live in WORLD coordinates and are drawn through the camera, so a
// burst stays anchored to where the fish was caught even as the camera moves.

import { theme } from '../constants/theme.js'

const MIN_PARTICLES = 8
const MAX_PARTICLES = 12
const LIFESPAN = 20 // frames
const SPEED_MIN = 0.6
const SPEED_MAX = 2.2
const RADIUS_MIN = 1.5
const RADIUS_MAX = 3.5

// Create 8–12 particles at a world position, fired in random directions.
export function spawnParticles(x, y) {
  const count = MIN_PARTICLES + Math.floor(Math.random() * (MAX_PARTICLES - MIN_PARTICLES + 1))
  const particles = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN)
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: RADIUS_MIN + Math.random() * (RADIUS_MAX - RADIUS_MIN),
      life: LIFESPAN,
      maxLife: LIFESPAN,
    })
  }
  return particles
}

// Advance every particle one frame and drop the dead ones. Returns a NEW array.
// Bubbles drift slightly upward (negative y) and decelerate as they rise.
// `dt` is the frame-normalized delta (~1.0 at 60Hz) applied to the position
// advance so bubbles travel at the same speed regardless of refresh rate.
export function updateParticles(particles, dt = 1) {
  const next = []
  for (const p of particles) {
    const life = p.life - 1
    if (life <= 0) continue
    next.push({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + (p.vy - 0.3) * dt, // gentle buoyancy
      vx: p.vx * 0.92,
      vy: p.vy * 0.92,
      life,
    })
  }
  return next
}

// In-place variant for the hot loop (ROADMAP.md O11). updateParticles above
// stays pure/unchanged (the tests depend on that, and spawnParticles already
// only allocates on a catch — an infrequent event, not a steady per-frame
// cost). This mutates each still-alive particle's fields directly instead of
// spreading into a new object, and compacts dead ones out via a write-index
// pass instead of allocating a new array — no allocation at all when nothing
// died this frame (the common case between catches), and none of the
// generational-GC churn from the per-frame `next = []` + spread copy either
// way. Safe to mutate here (unlike boids' allFish): each particle's advance
// depends only on its own previous state, never on another particle's.
export function updateParticlesInPlace(particles, dt = 1) {
  let writeIndex = 0
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    const life = p.life - 1
    if (life <= 0) continue
    p.x = p.x + p.vx * dt
    p.y = p.y + (p.vy - 0.3) * dt
    p.vx = p.vx * 0.92
    p.vy = p.vy * 0.92
    p.life = life
    particles[writeIndex] = p
    writeIndex++
  }
  particles.length = writeIndex
  return particles
}

// Draw all particles as fading bubbles through the camera transform.
// worldToScreen (camera.js) is deliberately NOT called here (ROADMAP.md
// O11) — same inlined-arithmetic reasoning as renderer.js's drawSchool.
export function drawParticles(ctx, particles, camera) {
  for (const p of particles) {
    const sx = p.x - camera.x
    const sy = p.y - camera.y
    const alpha = p.life / p.maxLife
    ctx.beginPath()
    ctx.arc(sx, sy, p.radius, 0, Math.PI * 2)
    ctx.fillStyle = theme.particle.color
    ctx.globalAlpha = alpha
    ctx.fill()
  }
  ctx.globalAlpha = 1
}
