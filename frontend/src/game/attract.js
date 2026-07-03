// attract.js (game/) — autonomous "attract mode" simulation math. Pure JS, no
// React, no rendering, no sound, no score. Powers the decorative start-screen
// background only.
//
// The fish reuse the exact game Boids math (updateSchool from boids.js) and flee
// from the autonomous shark as their "predator". The only new behaviour here is
// the shark's own AI: seek the nearest fish blended with a wandering heading, and
// "catch" on proximity — a caught fish is RESPAWNED elsewhere (never removed, no
// score). Everything is confined to the visible viewport (no extended world, no
// camera) so world coords == screen coords.

import { updateSchool, initFish } from './boids.js'
import {
  ATTRACT_SHARK_SPEED,
  ATTRACT_CATCH_RADIUS,
  ATTRACT_WANDER_WEIGHT,
  ATTRACT_WANDER_TURN,
  ATTRACT_FISH_COUNT,
  SHARK_MOUTH_OFFSET,
  ROTATION_VELOCITY_THRESHOLD,
  INITIAL_VELOCITY_RANGE,
  FLEE_RADIUS,
} from '../constants/boids.js'

// Spawn the autonomous shark at viewport center, with a random wander heading.
export function initAttractShark(world) {
  return {
    x: world.width / 2,
    y: world.height / 2,
    vx: 0,
    vy: 0,
    angle: 0,
    wander: Math.random() * Math.PI * 2,
  }
}

// The school reuses the game's spawn helper (clustered near center).
export function initAttractFish(world, count = ATTRACT_FISH_COUNT) {
  return initFish(count, world)
}

// One AI step for the shark. Steers toward the nearest fish, blended with a
// slowly-drifting wander heading so motion looks organic rather than robotic,
// then advances at ATTRACT_SHARK_SPEED and clamps inside the viewport. Returns a
// NEW shark object (no mutation). `dt` is the frame-normalized delta.
export function updateAttractShark(shark, fish, world, dt = 1) {
  // Nearest fish (squared distance; no sqrt needed for the comparison).
  let target = null
  let best = Infinity
  for (const f of fish) {
    const dx = f.x - shark.x
    const dy = f.y - shark.y
    const d2 = dx * dx + dy * dy
    if (d2 < best) {
      best = d2
      target = f
    }
  }

  // Seek direction (unit vector toward the target).
  let sx = 0
  let sy = 0
  if (target) {
    const d = Math.hypot(target.x - shark.x, target.y - shark.y) || 1
    sx = (target.x - shark.x) / d
    sy = (target.y - shark.y) / d
  }

  // Wander: drift the heading a little each frame, then blend it with seek.
  const wander = shark.wander + (Math.random() * 2 - 1) * ATTRACT_WANDER_TURN
  let dx = sx + Math.cos(wander) * ATTRACT_WANDER_WEIGHT
  let dy = sy + Math.sin(wander) * ATTRACT_WANDER_WEIGHT
  const dm = Math.hypot(dx, dy) || 1
  dx /= dm
  dy /= dm

  const vx = dx * ATTRACT_SHARK_SPEED
  const vy = dy * ATTRACT_SHARK_SPEED

  // Confine to the viewport (soft clamp at the edges).
  const x = Math.max(0, Math.min(world.width, shark.x + vx * dt))
  const y = Math.max(0, Math.min(world.height, shark.y + vy * dt))

  // Face travel direction; hold the last angle when nearly still (anti-jitter).
  const angle =
    Math.hypot(vx, vy) > ROTATION_VELOCITY_THRESHOLD ? Math.atan2(vy, vx) : shark.angle

  return { x, y, vx, vy, angle, wander }
}

// Respawn a single fish somewhere on screen, outside the shark's flee range so it
// is not caught again on the next frame. Small randomized velocity.
function respawnFish(world, shark) {
  let x = 0
  let y = 0
  for (let tries = 0; tries < 12; tries++) {
    x = Math.random() * world.width
    y = Math.random() * world.height
    if (Math.hypot(x - shark.x, y - shark.y) >= FLEE_RADIUS) break
  }
  return {
    x,
    y,
    vx: (Math.random() * 2 - 1) * INITIAL_VELOCITY_RANGE,
    vy: (Math.random() * 2 - 1) * INITIAL_VELOCITY_RANGE,
  }
}

// Replace any fish within catch range of the shark's mouth with a respawned one.
// Returns the same array reference when nothing was caught (cheap no-op frames).
export function catchAndRespawn(fish, shark, world) {
  const mx = shark.x + Math.cos(shark.angle) * SHARK_MOUTH_OFFSET
  const my = shark.y + Math.sin(shark.angle) * SHARK_MOUTH_OFFSET
  const r2 = ATTRACT_CATCH_RADIUS * ATTRACT_CATCH_RADIUS
  let caught = false
  const next = fish.map((f) => {
    const dx = f.x - mx
    const dy = f.y - my
    if (dx * dx + dy * dy < r2) {
      caught = true
      return respawnFish(world, shark)
    }
    return f
  })
  return caught ? next : fish
}

// Advance the whole attract simulation one tick (shark AI -> fish flock/flee ->
// catch/respawn). Returns the new { fish, shark } state. Pure: no mutation.
export function stepAttract(fish, shark, world, dt = 1) {
  const nextShark = updateAttractShark(shark, fish, world, dt)
  const nextFish = catchAndRespawn(updateSchool(fish, nextShark, world, dt), nextShark, world)
  return { fish: nextFish, shark: nextShark }
}
