// particles.js — bubble-burst particle system. Lifecycle + drawing only.
//
// Particles live in WORLD coordinates and are drawn through the camera, so a
// burst stays anchored to where the fish was caught even as the camera moves.

import { worldToScreen } from './camera.js'
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
export function updateParticles(particles) {
  const next = []
  for (const p of particles) {
    const life = p.life - 1
    if (life <= 0) continue
    next.push({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy - 0.3, // gentle buoyancy
      vx: p.vx * 0.92,
      vy: p.vy * 0.92,
      life,
    })
  }
  return next
}

// Draw all particles as fading bubbles through the camera transform.
export function drawParticles(ctx, particles, camera) {
  for (const p of particles) {
    const s = worldToScreen(p.x, p.y, camera)
    const alpha = p.life / p.maxLife
    ctx.beginPath()
    ctx.arc(s.x, s.y, p.radius, 0, Math.PI * 2)
    ctx.fillStyle = theme.particle.color
    ctx.globalAlpha = alpha
    ctx.fill()
  }
  ctx.globalAlpha = 1
}
