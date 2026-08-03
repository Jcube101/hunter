// useInput.js — mouse (desktop) + virtual joystick (mobile).
//
// Desktop: mouse position maps to a WORLD-space target the shark moves toward
// (unchanged from previous sessions). Touch: a fixed virtual joystick in the
// bottom-left corner — the thumb stays put and the shark moves in the stick's
// direction, at a speed proportional to displacement. Listeners are bound to the
// canvas, not the window (per GDD.md). touchmove/touchstart preventDefault to
// kill page scroll/zoom during gameplay.
//
// inputPosRef holds one of:
//   - { x, y }                      → mouse world target (isJoystick falsy)
//   - { dx, dy, isJoystick: true }  → joystick direction, |dx,dy| in [0,1]
//   - null                          → no input yet (shark holds position)
// joystickRef holds render state for the on-screen stick (screen-space offsets).

import { useRef, useEffect } from 'react'
import { screenToWorld } from '../game/camera.js'
import {
  JOYSTICK_BASE_X,
  JOYSTICK_BASE_Y,
  JOYSTICK_RADIUS,
  JOYSTICK_ACTIVATE_RADIUS,
} from '../constants/boids.js'

export function useInput(canvasRef, cameraRef) {
  const inputPosRef = useRef(null)
  // Render state for drawJoystick: active flag + clamped knob offset (px) from
  // base center, in screen space.
  const joystickRef = useRef({ active: false, dx: 0, dy: 0 })
  // Which touch identifier currently owns the stick (ignore other fingers).
  const touchIdRef = useRef(null)
  // Safe-area insets (px), composed into the joystick's touch geometry on top
  // of JOYSTICK_MARGIN, not instead of it (ROADMAP.md B3, building on B9's
  // margin increase). Read from the CSS custom properties index.css sets from
  // env(safe-area-inset-*); 0 on any device without a cutout/gesture-bar
  // inset, so this is a no-op there, including in tests (jsdom never loads
  // index.css). Cached in a ref and refreshed on resize/orientationchange
  // rather than read on every touch event, since a drag can fire touchmove
  // far more often than the inset could plausibly change.
  const insetRef = useRef({ left: 0, bottom: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    // --- Mouse (desktop): unchanged world-target tracking --------------------
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const cam = cameraRef.current
      inputPosRef.current = cam ? screenToWorld(sx, sy, cam) : { x: sx, y: sy }
    }

    // --- Joystick (mobile) ---------------------------------------------------
    const readInsets = () => {
      const cs = getComputedStyle(document.documentElement)
      const left = parseFloat(cs.getPropertyValue('--safe-left'))
      const bottom = parseFloat(cs.getPropertyValue('--safe-bottom'))
      insetRef.current = {
        left: Number.isFinite(left) ? left : 0,
        bottom: Number.isFinite(bottom) ? bottom : 0,
      }
    }
    readInsets()
    window.addEventListener('resize', readInsets)
    window.addEventListener('orientationchange', readInsets)

    // Base center in canvas-local screen coords (bottom-left). JOYSTICK_MARGIN
    // is the primary spacing (B9); the safe-area inset adds on top of it when
    // a device reports one, so the two compose rather than fight.
    const baseCenter = (rect) => ({
      x: JOYSTICK_BASE_X + insetRef.current.left,
      y: rect.height - JOYSTICK_BASE_Y - insetRef.current.bottom,
    })

    // Compute direction + knob offset from a touch point relative to base center.
    const applyStick = (localX, localY) => {
      const rect = canvas.getBoundingClientRect()
      const base = baseCenter(rect)
      let dx = localX - base.x
      let dy = localY - base.y
      const mag = Math.hypot(dx, dy)
      // Clamp displacement to the rim.
      if (mag > JOYSTICK_RADIUS) {
        const s = JOYSTICK_RADIUS / mag
        dx *= s
        dy *= s
      }
      joystickRef.current = { active: true, dx, dy }
      // Direction vector normalized by radius → |.| in [0,1]; full speed at rim.
      inputPosRef.current = {
        dx: dx / JOYSTICK_RADIUS,
        dy: dy / JOYSTICK_RADIUS,
        isJoystick: true,
      }
    }

    const findTouch = (touchList) => {
      for (const t of touchList) if (t.identifier === touchIdRef.current) return t
      return null
    }

    const onTouchStart = (e) => {
      e.preventDefault()
      if (touchIdRef.current !== null) return // already driving the stick
      const rect = canvas.getBoundingClientRect()
      const base = baseCenter(rect)
      // Grab the first touch that lands within the activation zone; ignore taps
      // elsewhere (no move-by-tapping-the-field).
      for (const t of e.changedTouches) {
        const lx = t.clientX - rect.left
        const ly = t.clientY - rect.top
        if (Math.hypot(lx - base.x, ly - base.y) <= JOYSTICK_ACTIVATE_RADIUS) {
          touchIdRef.current = t.identifier
          applyStick(lx, ly)
          break
        }
      }
    }

    const onTouchMove = (e) => {
      e.preventDefault()
      if (touchIdRef.current === null) return
      const t = findTouch(e.touches)
      if (!t) return
      const rect = canvas.getBoundingClientRect()
      applyStick(t.clientX - rect.left, t.clientY - rect.top)
    }

    const onTouchEnd = (e) => {
      if (touchIdRef.current === null) return
      // Only release when the owning finger lifts.
      if (findTouch(e.changedTouches)) {
        touchIdRef.current = null
        joystickRef.current = { active: false, dx: 0, dy: 0 }
        inputPosRef.current = { dx: 0, dy: 0, isJoystick: true } // zero vector → stop
      }
    }

    // An interrupted drag (call, notification shade, app switch, screen off)
    // may never deliver touchend/touchcancel, leaving inputPosRef stuck at
    // its last non-zero vector — the shark then drives itself on return with
    // no finger on the screen (ROADMAP.md B8). visibilitychange/blur are the
    // events that reliably fire across all of those interruption paths, so
    // strand-proofing lives here rather than trying to enumerate every
    // possible interruption source.
    const onStrand = () => {
      touchIdRef.current = null
      joystickRef.current = { active: false, dx: 0, dy: 0 }
      inputPosRef.current = null
    }
    const onVisibilityChange = () => {
      if (document.hidden) onStrand()
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)
    canvas.addEventListener('touchcancel', onTouchEnd)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onStrand)

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onStrand)
      window.removeEventListener('resize', readInsets)
      window.removeEventListener('orientationchange', readInsets)
    }
  }, [canvasRef, cameraRef])

  return { inputPosRef, joystickRef }
}
