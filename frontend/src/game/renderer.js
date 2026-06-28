// renderer.js — all canvas drawing. No simulation math, no internal state.
// Every function takes a canvas context + game state and draws one thing.
//
// World entities (fish, shark, particles) are drawn through the camera via
// worldToScreen. The minimap is drawn on its own separate canvas.

import { worldToScreen } from './camera.js'
import {
  SHARK_MOUTH_OFFSET,
  JOYSTICK_BASE_X,
  JOYSTICK_BASE_Y,
  JOYSTICK_RADIUS,
  JOYSTICK_KNOB_RADIUS,
} from '../constants/boids.js'

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

// Silver/white chevron, rotated to face its heading.
export function drawFish(ctx, fishList, camera, theme) {
  ctx.fillStyle = theme.fish.fill
  ctx.strokeStyle = theme.fish.stroke
  ctx.lineWidth = 1
  for (const fish of fishList) {
    const s = worldToScreen(fish.x, fish.y, camera)
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate(headingOf(fish))
    ctx.beginPath()
    ctx.moveTo(7, 0) // nose
    ctx.lineTo(-5, -5) // upper tail
    ctx.lineTo(-2, 0) // chevron notch
    ctx.lineTo(-5, 5) // lower tail
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}

// Canvas-drawn shark, facing +X in local space (the rotate transform handles
// heading). All shapes are positioned so the snout/front tip sits at
// SHARK_MOUTH_OFFSET — the same point the catch check uses.
export function drawShark(ctx, predator, camera, theme) {
  const s = worldToScreen(predator.x, predator.y, camera)
  const sk = theme.shark
  const nose = SHARK_MOUTH_OFFSET // front tip x — aligns visual with catch point

  ctx.save()
  ctx.translate(s.x, s.y)
  ctx.rotate(headingOf(predator))

  // --- Tail fin: two angled triangles forming a crescent (drawn first) ---
  ctx.fillStyle = sk.fin
  ctx.beginPath()
  ctx.moveTo(-14, -1) // upper lobe
  ctx.lineTo(-25, -9)
  ctx.lineTo(-18, 0)
  ctx.closePath()
  ctx.moveTo(-14, 1) // lower lobe
  ctx.lineTo(-24, 8)
  ctx.lineTo(-18, 0)
  ctx.closePath()
  ctx.fill()

  // --- Dorsal fin: back-swept triangle from the top center ---
  ctx.beginPath()
  ctx.moveTo(2, -6)
  ctx.lineTo(-8, -16)
  ctx.lineTo(-6, -6)
  ctx.closePath()
  ctx.fill()

  // --- Body: streamlined ellipse, front tip at the nose ---
  ctx.fillStyle = sk.body
  ctx.strokeStyle = sk.outline
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(nose - 16, 0, 16, 6.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // --- Underside: darker belly ellipse on the lower half ---
  ctx.fillStyle = sk.underside
  ctx.beginPath()
  ctx.ellipse(nose - 17, 3, 12, 3.2, 0, 0, Math.PI * 2)
  ctx.fill()

  // --- Mouth: subtle open-mouth line at the very front tip ---
  ctx.strokeStyle = sk.outline
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(nose, 0.5)
  ctx.lineTo(nose - 6, 2.5)
  ctx.stroke()

  // --- Eye: small dark circle toward the front ---
  ctx.fillStyle = sk.eye
  ctx.beginPath()
  ctx.arc(nose - 6, -1.8, 1.3, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

// Virtual joystick overlay (mobile only). Drawn in SCREEN space, so the caller
// must invoke it with the base HiDPI transform set (no camera offset). The base
// ring sits fixed bottom-left; the knob rides the stick's clamped displacement.
export function drawJoystick(ctx, joystick, viewport) {
  const cx = JOYSTICK_BASE_X
  const cy = viewport.height - JOYSTICK_BASE_Y

  // Base ring — always visible during gameplay, semi-transparent.
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, JOYSTICK_RADIUS, 0, Math.PI * 2)
  ctx.stroke()

  // Knob — offset by the (clamped) displacement when active, centered at rest.
  const kx = cx + (joystick?.active ? joystick.dx : 0)
  const ky = cy + (joystick?.active ? joystick.dy : 0)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.beginPath()
  ctx.arc(kx, ky, JOYSTICK_KNOB_RADIUS, 0, Math.PI * 2)
  ctx.fill()
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
