// predator.js — pure predator movement + catch-detection math, extracted from
// App.jsx's movePredator/onFrameUpdate closures (Session 18) so it can be unit
// tested directly. No React, no refs, no side effects — same math as before,
// just relocated.

import {
  SHARK_SPEED,
  ROTATION_VELOCITY_THRESHOLD,
  SHARK_MOUTH_OFFSET,
  HITBOX_RADIUS,
} from '../constants/boids.js'

// One predator movement step. `input` is whatever useInput's inputPosRef holds:
//   - { dx, dy, isJoystick: true } — mobile joystick, |dx,dy| in [0,1]
//   - { x, y }                     — desktop mouse world-target
//   - null                         — no input yet (holds position)
// Returns a NEW predator object; does not mutate `predator`.
export function stepPredator(predator, input, world, dt) {
  const p = predator

  let vx = 0
  let vy = 0
  if (input && input.isJoystick) {
    // Joystick (mobile): velocity ∝ stick displacement. |dx,dy| in [0,1], so
    // the shark crawls near center and hits full speed at the rim.
    vx = input.dx * SHARK_SPEED * dt
    vy = input.dy * SHARK_SPEED * dt
  } else {
    // Mouse (desktop): move toward the world-space target, never overshoot.
    const target = input || { x: p.x, y: p.y }
    const dx = target.x - p.x
    const dy = target.y - p.y
    const dist = Math.hypot(dx, dy)
    if (dist > 0) {
      const step = Math.min(SHARK_SPEED * dt, dist)
      vx = (dx / dist) * step
      vy = (dy / dist) * step
    }
  }

  let nx = p.x + vx
  let ny = p.y + vy
  // Hard stop at world bounds (GDD.md): zero the velocity that hit the wall.
  if (nx < 0) { nx = 0; vx = 0 } else if (nx > world.width) { nx = world.width; vx = 0 }
  if (ny < 0) { ny = 0; vy = 0 } else if (ny > world.height) { ny = world.height; vy = 0 }

  let angle = p.angle
  if (Math.hypot(vx, vy) > ROTATION_VELOCITY_THRESHOLD) angle = Math.atan2(vy, vx)

  return { x: nx, y: ny, vx, vy, angle }
}

// Resolve one frame's catch detection: which fish are within HITBOX_RADIUS of
// the predator's mouth point. Returns { survivors, caught } — `caught` is the
// list of fish removed this frame (for particle bursts + score), `survivors`
// is the remaining school in original order. Pure; does not mutate `fish`.
export function resolveCatches(fish, predator) {
  const mouthX = predator.x + Math.cos(predator.angle) * SHARK_MOUTH_OFFSET
  const mouthY = predator.y + Math.sin(predator.angle) * SHARK_MOUTH_OFFSET
  const survivors = []
  const caught = []
  for (const f of fish) {
    if (Math.hypot(mouthX - f.x, mouthY - f.y) < HITBOX_RADIUS) {
      caught.push(f)
    } else {
      survivors.push(f)
    }
  }
  return { survivors, caught }
}
