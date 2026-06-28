// useInput.js — mouse + touch input, reported in WORLD coordinates.
//
// Touch and mouse are handled separately (no unified pointer abstraction, per
// GDD.md). Listeners are bound to the canvas element, not the window. On mobile
// the target sits SHARK_OFFSET_MOBILE px above the finger so it never obscures
// the predator. touchmove calls preventDefault() to kill page scroll/zoom.
//
// Returns inputPosRef — a ref holding the current input target in world space
// (or null before the first event).

import { useRef, useEffect } from 'react'
import { screenToWorld } from '../game/camera.js'
import { SHARK_OFFSET_MOBILE } from '../constants/boids.js'

export function useInput(canvasRef, cameraRef) {
  const inputPosRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    // Convert a client (screen) point to world coords, lifting by `offset` px.
    const toWorld = (clientX, clientY, offset) => {
      const rect = canvas.getBoundingClientRect()
      const sx = clientX - rect.left
      const sy = clientY - rect.top - offset
      const cam = cameraRef.current
      return cam ? screenToWorld(sx, sy, cam) : { x: sx, y: sy }
    }

    const onMouseMove = (e) => {
      inputPosRef.current = toWorld(e.clientX, e.clientY, 0)
    }

    const onTouchStart = (e) => {
      const t = e.touches[0]
      if (t) inputPosRef.current = toWorld(t.clientX, t.clientY, SHARK_OFFSET_MOBILE)
    }

    const onTouchMove = (e) => {
      e.preventDefault() // suppress page scroll during gameplay
      const t = e.touches[0]
      if (t) inputPosRef.current = toWorld(t.clientX, t.clientY, SHARK_OFFSET_MOBILE)
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
    }
  }, [canvasRef, cameraRef])

  return { inputPosRef }
}
