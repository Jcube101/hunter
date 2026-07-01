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

const FISH_CALM_COLOR = '#E8EDF0' // white/silver — not within flee radius
const FISH_FLEE_COLOR = '#00BCD4' // teal — within FLEE_RADIUS of the predator
const FISH_GLOW_BLUR = 8 // shadowBlur px when the glow assist is on

// One fish, drawn at (x, y) facing `angle`. Coordinate-agnostic: the game passes
// screen coords (camera-transformed), the tutorial passes canvas coords. Diamond/
// lens body with a v-notch tail; teal when fleeing, white/silver when calm. Glow
// only when settings.glow is on AND the fish is fleeing.
export function drawFish(ctx, x, y, angle, isFleeing, settings = {}) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  const W = 10 // half-length
  const H = 4 // half-height

  ctx.beginPath()
  ctx.moveTo(W, 0) // nose
  ctx.quadraticCurveTo(W * 0.3, H, -W * 0.5, H * 0.8) // top curve
  ctx.lineTo(-W, 0) // tail center
  ctx.lineTo(-W * 0.5, -H * 0.8)
  ctx.quadraticCurveTo(W * 0.3, -H, W, 0) // bottom curve
  ctx.closePath()

  // V-notch tail
  ctx.moveTo(-W * 0.5, H * 0.8)
  ctx.lineTo(-W * 1.3, H * 1.2)
  ctx.lineTo(-W, 0)
  ctx.lineTo(-W * 1.3, -H * 1.2)
  ctx.lineTo(-W * 0.5, -H * 0.8)

  ctx.fillStyle = isFleeing ? FISH_FLEE_COLOR : FISH_CALM_COLOR
  if (isFleeing && settings.glow) {
    ctx.shadowColor = FISH_FLEE_COLOR
    ctx.shadowBlur = FISH_GLOW_BLUR
  } else {
    ctx.shadowBlur = 0
  }
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

// Dark angular predator silhouette, drawn at (x, y) facing `angle`. Coordinate-
// agnostic like drawFish (game passes screen coords, tutorial passes canvas
// coords). The nose sits at local x = 28 = SHARK_MOUTH_OFFSET, so the visual
// front tip lands exactly on the catch point (camera is 1:1). Pure angular
// shapes — no grey ellipse; a small teal eye gives contrast against the navy.
export function drawShark(ctx, x, y, angle) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  // Contrast layers (Session 9): the dark body barely reads against navy on dim
  // screens, so a teal outline + soft teal shadow glow make it legible without
  // making it look non-threatening. Coordinates/proportions are unchanged.
  ctx.shadowColor = 'rgba(0, 188, 212, 0.4)'
  ctx.shadowBlur = 12
  ctx.fillStyle = '#0d1f2d'
  ctx.strokeStyle = 'rgba(0, 188, 212, 0.6)'
  ctx.lineWidth = 1.5

  // Main body — angular, not rounded (nose = front tip = mouth point).
  ctx.beginPath()
  ctx.moveTo(28, 0)
  ctx.lineTo(8, -8)
  ctx.lineTo(-20, -6)
  ctx.lineTo(-28, 0)
  ctx.lineTo(-20, 6)
  ctx.lineTo(8, 8)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Dorsal fin — tall, raked back.
  ctx.beginPath()
  ctx.moveTo(4, -8)
  ctx.lineTo(0, -22)
  ctx.lineTo(-14, -6)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Tail fin — crescent.
  ctx.beginPath()
  ctx.moveTo(-20, -6)
  ctx.lineTo(-36, -16)
  ctx.lineTo(-28, 0)
  ctx.lineTo(-36, 16)
  ctx.lineTo(-20, 6)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Pectoral fin — angular sweep.
  ctx.beginPath()
  ctx.moveTo(6, 8)
  ctx.lineTo(0, 18)
  ctx.lineTo(-12, 8)
  ctx.closePath()
  ctx.fill()

  // Eye — small teal dot for heading clarity (no glow on the eye itself).
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.arc(16, -3, 2, 0, Math.PI * 2)
  ctx.fillStyle = '#00BCD4'
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
