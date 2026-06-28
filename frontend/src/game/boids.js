// boids.js (game/) — Boids simulation math. Pure JS, no React, no rendering.
//
// Five force functions (separation, alignment, cohesion, flee, edgeRepulsion),
// each pure: takes state in, returns a velocity vector, never mutates its input.
// updateFish() sums the forces, clamps speed, and returns a NEW fish object.
//
// All tuning values come from constants/boids.js — no magic numbers here.

import {
  FISH_BASE_SPEED,
  FISH_FLEE_SPEED,
  FLEE_RADIUS,
  FLEE_WEIGHT,
  SEPARATION_RADIUS,
  SEPARATION_WEIGHT,
  ALIGNMENT_RADIUS,
  ALIGNMENT_WEIGHT,
  COHESION_RADIUS,
  COHESION_WEIGHT,
  EDGE_REPULSION_RADIUS,
  EDGE_REPULSION_WEIGHT,
  ANCHOR_WEIGHT,
  INITIAL_VELOCITY_RANGE,
} from '../constants/boids.js'

// --- Small vector helpers ---------------------------------------------------

function normalize(x, y) {
  const mag = Math.hypot(x, y)
  if (mag === 0) return { x: 0, y: 0 }
  return { x: x / mag, y: y / mag }
}

function clampMagnitude(x, y, max) {
  const mag = Math.hypot(x, y)
  if (mag > max && mag > 0) {
    const s = max / mag
    return { x: x * s, y: y * s }
  }
  return { x, y }
}

// --- Force functions (pure; return a weighted velocity vector) --------------

// Steer away from neighbors that are too close. Closer neighbors push harder.
export function separation(fish, neighbors, radius, weight) {
  const r2 = radius * radius
  let sx = 0
  let sy = 0
  for (const other of neighbors) {
    if (other === fish) continue
    const dx = fish.x - other.x
    const dy = fish.y - other.y
    const d2 = dx * dx + dy * dy
    if (d2 > 0 && d2 < r2) {
      const d = Math.sqrt(d2)
      // away direction scaled by 1/distance — stronger the closer they are
      sx += dx / d / d
      sy += dy / d / d
    }
  }
  const u = normalize(sx, sy)
  return { x: u.x * weight, y: u.y * weight }
}

// Steer toward the average heading of nearby neighbors.
export function alignment(fish, neighbors, radius, weight) {
  const r2 = radius * radius
  let vx = 0
  let vy = 0
  let count = 0
  for (const other of neighbors) {
    if (other === fish) continue
    const dx = other.x - fish.x
    const dy = other.y - fish.y
    if (dx * dx + dy * dy < r2) {
      vx += other.vx
      vy += other.vy
      count++
    }
  }
  if (count === 0) return { x: 0, y: 0 }
  const u = normalize(vx, vy)
  return { x: u.x * weight, y: u.y * weight }
}

// Steer toward the average position (center of mass) of nearby neighbors.
export function cohesion(fish, neighbors, radius, weight) {
  const r2 = radius * radius
  let cx = 0
  let cy = 0
  let count = 0
  for (const other of neighbors) {
    if (other === fish) continue
    const dx = other.x - fish.x
    const dy = other.y - fish.y
    if (dx * dx + dy * dy < r2) {
      cx += other.x
      cy += other.y
      count++
    }
  }
  if (count === 0) return { x: 0, y: 0 }
  const u = normalize(cx / count - fish.x, cy / count - fish.y)
  return { x: u.x * weight, y: u.y * weight }
}

// Escape the predator. Full weight whenever the predator is within FLEE_RADIUS,
// so it deliberately dominates the flocking forces (GDD.md). The proportional
// "closer = faster" behavior is applied to the speed clamp, not this force.
export function flee(fish, predator, radius, weight) {
  if (!predator) return { x: 0, y: 0 }
  const dx = fish.x - predator.x
  const dy = fish.y - predator.y
  const d2 = dx * dx + dy * dy
  if (d2 === 0 || d2 >= radius * radius) return { x: 0, y: 0 }
  const u = normalize(dx, dy)
  return { x: u.x * weight, y: u.y * weight }
}

// Turn away from world boundaries. Force ramps up smoothly as the fish nears an
// edge (0 at radius, full at the wall) so fish curve away organically.
export function edgeRepulsion(fish, world, radius, weight) {
  let fx = 0
  let fy = 0
  if (fish.x < radius) fx += (radius - fish.x) / radius
  if (fish.x > world.width - radius) fx -= (radius - (world.width - fish.x)) / radius
  if (fish.y < radius) fy += (radius - fish.y) / radius
  if (fish.y > world.height - radius) fy -= (radius - (world.height - fish.y)) / radius
  return { x: fx * weight, y: fy * weight }
}

// Weak constant pull toward world center, applied every frame regardless of
// neighbors. Keeps a scattered school (or a lone exiled fish) from settling
// permanently in a corner. Deliberately subtle — see ANCHOR_WEIGHT.
export function anchorForce(fish, world, weight) {
  const u = normalize(world.width / 2 - fish.x, world.height / 2 - fish.y)
  return { x: u.x * weight, y: u.y * weight }
}

// --- Speed: base, ramping up to flee speed as the predator closes in --------

function maxSpeedFor(fish, predator) {
  if (!predator) return FISH_BASE_SPEED
  const d = Math.hypot(fish.x - predator.x, fish.y - predator.y)
  if (d >= FLEE_RADIUS) return FISH_BASE_SPEED
  const proximity = 1 - d / FLEE_RADIUS // 0 at edge, 1 at contact
  return FISH_BASE_SPEED + proximity * (FISH_FLEE_SPEED - FISH_BASE_SPEED)
}

// --- Main per-fish update ---------------------------------------------------

// Applies all five forces, clamps to the proximity-scaled max speed, and
// returns a NEW fish object. Does not mutate `fish`. `dt` is the frame-
// normalized delta (~1.0 at 60Hz) so the position advance is refresh-rate
// independent; the velocity/force constants themselves are never scaled.
export function updateFish(fish, allFish, predator, world, dt = 1) {
  const sep = separation(fish, allFish, SEPARATION_RADIUS, SEPARATION_WEIGHT)
  const ali = alignment(fish, allFish, ALIGNMENT_RADIUS, ALIGNMENT_WEIGHT)
  const coh = cohesion(fish, allFish, COHESION_RADIUS, COHESION_WEIGHT)
  const fle = flee(fish, predator, FLEE_RADIUS, FLEE_WEIGHT)
  const edge = edgeRepulsion(fish, world, EDGE_REPULSION_RADIUS, EDGE_REPULSION_WEIGHT)
  const anc = anchorForce(fish, world, ANCHOR_WEIGHT)

  // Forces act as acceleration on the existing velocity (inertia = smoothing).
  let vx = fish.vx + sep.x + ali.x + coh.x + fle.x + edge.x + anc.x
  let vy = fish.vy + sep.y + ali.y + coh.y + fle.y + edge.y + anc.y

  const clamped = clampMagnitude(vx, vy, maxSpeedFor(fish, predator))
  vx = clamped.x
  vy = clamped.y

  return { x: fish.x + vx * dt, y: fish.y + vy * dt, vx, vy }
}

// Advance the whole school one tick. Returns a NEW array (no mutation), so the
// per-fish forces all read the same pre-tick snapshot. `dt` is forwarded to
// each fish for frame-rate-independent motion.
export function updateSchool(fish, predator, world, dt = 1) {
  return fish.map((f) => updateFish(f, fish, predator, world, dt))
}

// --- Spawning ---------------------------------------------------------------

// Spawn `count` fish clustered near world center with randomised velocities
// within ±INITIAL_VELOCITY_RANGE px/frame (GDD.md "Starting Conditions").
export function initFish(count, world) {
  const cx = world.width / 2
  const cy = world.height / 2
  const clusterRadius = Math.min(world.width, world.height) * 0.12
  const fish = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * clusterRadius
    fish.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      vx: (Math.random() * 2 - 1) * INITIAL_VELOCITY_RANGE,
      vy: (Math.random() * 2 - 1) * INITIAL_VELOCITY_RANGE,
    })
  }
  return fish
}
