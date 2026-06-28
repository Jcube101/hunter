// camera.js — world <-> screen coordinate transforms. No simulation, no drawing.
//
// The camera is a viewport window into the larger world. It follows the
// predator (centered, 1:1, no lag) and is clamped so it never reveals area
// outside the world bounds (GDD.md "Camera").
//
// A camera is a plain object: { x, y } = the world coordinate at the top-left
// of the screen, plus the viewport size { width, height }.

// Compute the camera for this frame: center on the predator, clamp to world.
export function updateCamera(predator, world, viewport) {
  const halfW = viewport.width / 2
  const halfH = viewport.height / 2

  // Desired top-left so the predator sits at screen center.
  let x = predator.x - halfW
  let y = predator.y - halfH

  // Clamp so the viewport stays inside the world. Math.max(0, ...) guards the
  // (unused in v1) case of a world smaller than the viewport.
  const maxX = Math.max(0, world.width - viewport.width)
  const maxY = Math.max(0, world.height - viewport.height)
  x = Math.min(Math.max(x, 0), maxX)
  y = Math.min(Math.max(y, 0), maxY)

  return { x, y, width: viewport.width, height: viewport.height }
}

// World coordinate -> screen (canvas) coordinate.
export function worldToScreen(worldX, worldY, camera) {
  return { x: worldX - camera.x, y: worldY - camera.y }
}

// Screen (canvas) coordinate -> world coordinate. Needed to map input
// (mouse/touch) into the world.
export function screenToWorld(screenX, screenY, camera) {
  return { x: screenX + camera.x, y: screenY + camera.y }
}
