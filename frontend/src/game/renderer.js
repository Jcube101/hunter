// renderer.js — all canvas drawing. No simulation math, no internal state.
// Every function takes a canvas context + game state and draws one thing.
//
// World entities (fish, shark, particles) are drawn through the camera via
// worldToScreen. The minimap is drawn on its own separate canvas.

import { worldToScreen } from './camera.js'
// No boids constants needed here: the shark nose is authored at local x = 28
// (= SHARK_MOUTH_OFFSET) and colours are literals. The joystick is intentionally
// invisible (Session 8) — no joystick drawing.

// Heading helper: prefer an explicit angle (predator uses one with a jitter
// threshold), else derive from velocity.
function headingOf(entity) {
  if (typeof entity.angle === 'number') return entity.angle
  return Math.atan2(entity.vy, entity.vx)
}

// Solid navy fill across the visible canvas. The camera is clamped inside the
// world, so the viewport always lies within world bounds — filling the canvas
// fills the world region on screen (GDD.md: Ocean background #0a1628).
export function drawBackground(ctx, viewport, theme) {
  ctx.fillStyle = theme.background
  ctx.fillRect(0, 0, viewport.width, viewport.height)
}

const FISH_CALM_COLOR = '#E8EDF0' // body, white/silver — not within flee radius
const FISH_FLEE_COLOR = '#00BCD4' // body, teal — within FLEE_RADIUS of the predator
const FISH_CALM_TAIL = '#C0C8D0' // tail block, calm (lighter than body)
const FISH_FLEE_TAIL = '#00A0B4' // tail block, fleeing (darker teal)
// Glow assist: a bright halo, deliberately LIGHTER than the teal body so it reads
// as a distinct glow (a same-teal halo around a teal fish was near-invisible — the
// reason the toggle looked like it did nothing). Larger blur so it's obvious.
const FISH_GLOW_COLOR = '#9BF6FF' // pale cyan — pops against both navy and the teal body
const FISH_GLOW_BLUR = 14 // shadowBlur px when the glow assist is on

// One fish, drawn at (x, y) facing `angle`. Coordinate-agnostic: the game passes
// screen coords (camera-transformed), the tutorial passes canvas coords.
//
// Geometry (Session 10): a compact kite/diamond body — sharp point at the nose
// (front) and rear, widest in the middle — plus a small separate rhombus tail
// block behind the rear point, in a lighter colour. Straight lines only, no eye.
// Body/tail swap to teal shades when fleeing; the fleeing body glows only when
// settings.glow is on.
export function drawFish(ctx, x, y, angle, isFleeing, settings = {}) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  if (isFleeing && settings.glow) {
    ctx.shadowColor = FISH_GLOW_COLOR
    ctx.shadowBlur = FISH_GLOW_BLUR
  } else {
    ctx.shadowBlur = 0
  }

  // Tail block — small rhombus behind the rear point, slightly offset, lighter.
  ctx.fillStyle = isFleeing ? FISH_FLEE_TAIL : FISH_CALM_TAIL
  ctx.beginPath()
  ctx.moveTo(-6, 0)
  ctx.lineTo(-8, -2.5)
  ctx.lineTo(-10, 0)
  ctx.lineTo(-8, 2.5)
  ctx.closePath()
  ctx.fill()

  // Body — kite/diamond: sharp nose (front) + sharp rear, widest in the middle.
  ctx.fillStyle = isFleeing ? FISH_FLEE_COLOR : FISH_CALM_COLOR
  ctx.beginPath()
  ctx.moveTo(7, 0) // nose
  ctx.lineTo(0, -4) // top (widest)
  ctx.lineTo(-5, 0) // rear
  ctx.lineTo(0, 4) // bottom
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

// Draw the whole school through the camera. Colours each fish by whether it is
// within `detectRadius` (the current difficulty's FLEE_RADIUS) of the predator.
export function drawSchool(ctx, fishList, camera, predator, detectRadius, settings) {
  const fr2 = detectRadius * detectRadius
  for (const fish of fishList) {
    const s = worldToScreen(fish.x, fish.y, camera)
    const dx = fish.x - predator.x
    const dy = fish.y - predator.y
    const isFleeing = dx * dx + dy * dy < fr2
    drawFish(ctx, s.x, s.y, headingOf(fish), isFleeing, settings)
  }
}

// Predator, drawn at (x, y) facing `angle`. Coordinate-agnostic like drawFish
// (game passes screen coords, tutorial passes canvas coords). The sharp nose sits
// at local x = 28 = SHARK_MOUTH_OFFSET, so the visual front tip lands exactly on
// the catch point (camera is 1:1).
//
// Geometry (Session 10, traced from the reference silhouette): one continuous
// outline — snout → raked-back dorsal fin → back → forked caudal tail (larger
// upper lobe, notch into the body, smaller lower lobe, no gap) → belly fin →
// lower jaw back to the nose. A seam line marks the dorsal fin base. Straight
// lines only; the red eye is the one circle. ~56px long (nose +28 to tail ~-28).
// Teal outline + soft teal glow keep the dark body legible on navy.
export function drawShark(ctx, x, y, angle) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  ctx.shadowColor = 'rgba(0, 188, 212, 0.4)'
  ctx.shadowBlur = 12
  ctx.fillStyle = '#0d1f2d'
  ctx.strokeStyle = 'rgba(0, 188, 212, 0.6)'
  ctx.lineWidth = 1.5

  // Body outline — one continuous silhouette (clockwise from the nose).
  ctx.beginPath()
  ctx.moveTo(28, 0) // nose (sharp front point = catch point)
  ctx.lineTo(11.5, -2.4) // upper back
  ctx.lineTo(5, -5.2) // dorsal fin front base
  ctx.lineTo(0.7, -11.9) // dorsal fin peak (raked back)
  ctx.lineTo(-2, -4.5) // dorsal fin rear base
  ctx.lineTo(-10, -2.4) // mid back
  ctx.lineTo(-16.5, -1) // upper caudal peduncle
  ctx.lineTo(-27.8, -6.3) // upper tail lobe tip
  ctx.lineTo(-18.9, 0.2) // tail fork notch (into the body)
  ctx.lineTo(-25, 4.9) // lower tail lobe tip
  ctx.lineTo(-16, 1.8) // lower caudal peduncle
  ctx.lineTo(-6, 4.5) // belly
  ctx.lineTo(-4, 4.8) // belly fin front
  ctx.lineTo(-2, 8.1) // belly fin tip
  ctx.lineTo(1.5, 4.9) // belly fin rear
  ctx.lineTo(15, 3.4) // lower jaw
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Dorsal fin base seam — the border line where the fin meets the body.
  ctx.beginPath()
  ctx.moveTo(5, -5.2)
  ctx.lineTo(-2, -4.5)
  ctx.stroke()

  // Eye — small red circle high near the front (no glow).
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.arc(14, -1.3, 1.8, 0, Math.PI * 2)
  ctx.fillStyle = '#FF4444'
  ctx.fill()

  ctx.restore()
}

// Minimap on its own small canvas. Reads its size from ctx.canvas. Shows the
// whole world as a dark rectangle with white fish dots + an accent shark dot.
export function drawMinimap(ctx, fishList, predator, world, theme) {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  const sx = w / world.width
  const sy = h / world.height

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = theme.minimap.background
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = theme.minimap.border
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1)

  ctx.fillStyle = theme.minimap.fish
  for (const fish of fishList) {
    ctx.fillRect(fish.x * sx - 1, fish.y * sy - 1, 2, 2)
  }

  ctx.fillStyle = theme.minimap.predator
  ctx.beginPath()
  ctx.arc(predator.x * sx, predator.y * sy, 3, 0, Math.PI * 2)
  ctx.fill()
}
