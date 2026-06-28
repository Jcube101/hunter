// renderer.js — all canvas drawing. No simulation math, no internal state.
// Every function takes a canvas context + game state and draws one thing.
//
// World entities (fish, shark, particles) are drawn through the camera via
// worldToScreen. The minimap is drawn on its own separate canvas.

import { worldToScreen } from './camera.js'
import { SHARK_MOUTH_OFFSET } from '../constants/boids.js'

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

// Grey shark: triangular body + dorsal fin. Mouth point is the front tip.
export function drawShark(ctx, predator, camera, theme) {
  const s = worldToScreen(predator.x, predator.y, camera)
  ctx.save()
  ctx.translate(s.x, s.y)
  ctx.rotate(headingOf(predator))

  // Dorsal fin (drawn first, behind the body edge)
  ctx.fillStyle = theme.shark.fin
  ctx.beginPath()
  ctx.moveTo(-2, -6)
  ctx.lineTo(-9, -16)
  ctx.lineTo(2, -6)
  ctx.closePath()
  ctx.fill()

  // Body triangle — front tip at (16, 0) is the mouth point.
  ctx.fillStyle = theme.shark.body
  ctx.strokeStyle = theme.shark.outline
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(SHARK_MOUTH_OFFSET, 0) // mouth / front tip — matches the catch point
  ctx.lineTo(-11, -8)
  ctx.lineTo(-7, 0)
  ctx.lineTo(-11, 8)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

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
