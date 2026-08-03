// useInput.test.js — Area K of the Session 17 audit.
//
// jsdom doesn't implement real Touch/TouchEvent construction, so touch
// interactions are simulated with plain Event objects that carry
// `touches`/`changedTouches` arrays of plain {identifier, clientX, clientY}
// objects — useInput only iterates and reads properties off them, so this is
// sufficient (audit decision D7). getBoundingClientRect is stubbed per test
// since jsdom has no layout engine and would otherwise return all zeros.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInput } from './useInput.js'
import { installVisibilityStub } from '../test/deviceStubs.js'
import {
  JOYSTICK_BASE_X,
  JOYSTICK_BASE_Y,
  JOYSTICK_RADIUS,
  JOYSTICK_ACTIVATE_RADIUS,
} from '../constants/boids.js'

function makeCanvas(rect = { left: 0, top: 0, width: 800, height: 600 }) {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height })
  return canvas
}

function touchEvent(type, touches) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  e.touches = touches
  e.changedTouches = touches
  return e
}

describe('useInput — mouse (desktop)', () => {
  it('maps client coords through the camera into world space', () => {
    const canvas = makeCanvas({ left: 10, top: 20, width: 800, height: 600 })
    const canvasRef = { current: canvas }
    const cameraRef = { current: { x: 100, y: 50 } }
    const { result } = renderHook(() => useInput(canvasRef, cameraRef))

    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 110, clientY: 120, bubbles: true }),
      )
    })
    // screen = (110-10, 120-20) = (100,100); world = screen + camera = (200,150)
    expect(result.current.inputPosRef.current).toEqual({ x: 200, y: 150 })
  })

  it('falls back to raw screen coords when there is no camera yet', () => {
    const canvas = makeCanvas({ left: 0, top: 0, width: 800, height: 600 })
    const canvasRef = { current: canvas }
    const cameraRef = { current: null }
    const { result } = renderHook(() => useInput(canvasRef, cameraRef))

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 60, bubbles: true }))
    })
    expect(result.current.inputPosRef.current).toEqual({ x: 50, y: 60 })
  })
})

describe('useInput — joystick (mobile)', () => {
  const rect = { left: 0, top: 0, width: 800, height: 600 }
  const baseX = JOYSTICK_BASE_X // 108 (Session 23: JOYSTICK_MARGIN 40 -> 48, B9)
  const baseY = rect.height - JOYSTICK_BASE_Y // 492

  it('grabs the stick when a touch lands within the activation zone', () => {
    const canvas = makeCanvas(rect)
    const canvasRef = { current: canvas }
    const { result } = renderHook(() => useInput(canvasRef, { current: null }))

    act(() => {
      canvas.dispatchEvent(
        touchEvent('touchstart', [{ identifier: 1, clientX: baseX + 50, clientY: baseY }]),
      )
    })
    expect(result.current.joystickRef.current.active).toBe(true)
  })

  it('ignores a touch that lands outside the activation zone', () => {
    const canvas = makeCanvas(rect)
    const canvasRef = { current: canvas }
    const { result } = renderHook(() => useInput(canvasRef, { current: null }))

    act(() => {
      canvas.dispatchEvent(
        touchEvent('touchstart', [{ identifier: 1, clientX: baseX + 400, clientY: baseY + 300 }]),
      )
    })
    expect(result.current.joystickRef.current.active).toBe(false)
    expect(result.current.inputPosRef.current).toBeNull()
  })

  it('clamps displacement to JOYSTICK_RADIUS and normalizes to [-1,1]', () => {
    const canvas = makeCanvas(rect)
    const canvasRef = { current: canvas }
    const { result } = renderHook(() => useInput(canvasRef, { current: null }))

    // Grab within the (larger) activation zone, then drag well past the
    // (smaller) rim radius — activation and clamping are two different radii.
    act(() => {
      canvas.dispatchEvent(
        touchEvent('touchstart', [{ identifier: 1, clientX: baseX + 50, clientY: baseY }]),
      )
    })
    act(() => {
      canvas.dispatchEvent(
        touchEvent('touchmove', [{ identifier: 1, clientX: baseX + 200, clientY: baseY }]),
      )
    })
    expect(result.current.joystickRef.current.dx).toBeCloseTo(JOYSTICK_RADIUS)
    expect(result.current.joystickRef.current.dy).toBeCloseTo(0)
    expect(result.current.inputPosRef.current).toEqual({ dx: 1, dy: 0, isJoystick: true })
  })

  it('only the owning touch identifier drives the stick; others are ignored', () => {
    const canvas = makeCanvas(rect)
    const canvasRef = { current: canvas }
    const { result } = renderHook(() => useInput(canvasRef, { current: null }))

    act(() => {
      canvas.dispatchEvent(
        touchEvent('touchstart', [{ identifier: 1, clientX: baseX + 10, clientY: baseY }]),
      )
    })
    const afterStart = { ...result.current.joystickRef.current }

    act(() => {
      // A second finger moves elsewhere — should be ignored (wrong identifier).
      canvas.dispatchEvent(
        touchEvent('touchmove', [{ identifier: 2, clientX: baseX + 999, clientY: baseY + 999 }]),
      )
    })
    expect(result.current.joystickRef.current).toEqual(afterStart)
  })

  it('releases only when the owning finger lifts, emitting a zero-vector stop', () => {
    const canvas = makeCanvas(rect)
    const canvasRef = { current: canvas }
    const { result } = renderHook(() => useInput(canvasRef, { current: null }))

    act(() => {
      canvas.dispatchEvent(
        touchEvent('touchstart', [{ identifier: 1, clientX: baseX + 10, clientY: baseY }]),
      )
    })

    act(() => {
      // Wrong finger lifts — stick should remain active.
      canvas.dispatchEvent(touchEvent('touchend', [{ identifier: 2, clientX: 0, clientY: 0 }]))
    })
    expect(result.current.joystickRef.current.active).toBe(true)

    act(() => {
      canvas.dispatchEvent(touchEvent('touchend', [{ identifier: 1, clientX: 0, clientY: 0 }]))
    })
    expect(result.current.joystickRef.current).toEqual({ active: false, dx: 0, dy: 0 })
    expect(result.current.inputPosRef.current).toEqual({ dx: 0, dy: 0, isJoystick: true })
  })

  it('touchstart and touchmove call preventDefault to suppress page scroll', () => {
    const canvas = makeCanvas(rect)
    const canvasRef = { current: canvas }
    renderHook(() => useInput(canvasRef, { current: null }))

    const startEvent = touchEvent('touchstart', [{ identifier: 1, clientX: baseX, clientY: baseY }])
    const preventStart = vi.spyOn(startEvent, 'preventDefault')
    act(() => canvas.dispatchEvent(startEvent))
    expect(preventStart).toHaveBeenCalled()

    const moveEvent = touchEvent('touchmove', [{ identifier: 1, clientX: baseX + 5, clientY: baseY }])
    const preventMove = vi.spyOn(moveEvent, 'preventDefault')
    act(() => canvas.dispatchEvent(moveEvent))
    expect(preventMove).toHaveBeenCalled()
  })

  // ROADMAP.md B8: an interrupted drag can leave inputPosRef stuck at a
  // stale non-zero vector if the interruption never delivers a touchend. A
  // real touchcancel (e.g. the OS reclaiming the gesture) should clear it
  // exactly like touchend does.
  it('touchcancel from the owning finger clears the stick like touchend', () => {
    const canvas = makeCanvas(rect)
    const canvasRef = { current: canvas }
    const { result } = renderHook(() => useInput(canvasRef, { current: null }))

    act(() => {
      canvas.dispatchEvent(
        touchEvent('touchstart', [{ identifier: 1, clientX: baseX + 10, clientY: baseY }]),
      )
    })
    expect(result.current.joystickRef.current.active).toBe(true)

    act(() => {
      canvas.dispatchEvent(touchEvent('touchcancel', [{ identifier: 1, clientX: 0, clientY: 0 }]))
    })
    expect(result.current.joystickRef.current).toEqual({ active: false, dx: 0, dy: 0 })
    expect(result.current.inputPosRef.current).toEqual({ dx: 0, dy: 0, isJoystick: true })
  })

  // Interruptions that strand the vector without ANY touch event reaching the
  // canvas — app switch, notification shade, incoming call, screen off. These
  // fire visibilitychange/blur, not touchend/touchcancel (ROADMAP.md B8).
  it('a stale joystick vector is cleared on visibilitychange -> hidden, without a matching touchend', () => {
    const canvas = makeCanvas(rect)
    const canvasRef = { current: canvas }
    const { result } = renderHook(() => useInput(canvasRef, { current: null }))

    act(() => {
      canvas.dispatchEvent(
        touchEvent('touchstart', [{ identifier: 1, clientX: baseX + 40, clientY: baseY }]),
      )
    })
    expect(result.current.joystickRef.current.active).toBe(true)
    expect(result.current.inputPosRef.current.dx).not.toBe(0)

    const visibility = installVisibilityStub()
    act(() => visibility.setHidden(true))
    expect(result.current.joystickRef.current).toEqual({ active: false, dx: 0, dy: 0 })
    expect(result.current.inputPosRef.current).toBeNull()

    // A finger still down when hidden must not be able to resume the stale
    // drag — the owning touch id was released too.
    act(() => {
      canvas.dispatchEvent(
        touchEvent('touchmove', [{ identifier: 1, clientX: baseX + 40, clientY: baseY }]),
      )
    })
    expect(result.current.joystickRef.current.active).toBe(false)
  })

  it('a stale joystick vector is also cleared on window blur', () => {
    const canvas = makeCanvas(rect)
    const canvasRef = { current: canvas }
    const { result } = renderHook(() => useInput(canvasRef, { current: null }))

    act(() => {
      canvas.dispatchEvent(
        touchEvent('touchstart', [{ identifier: 1, clientX: baseX + 40, clientY: baseY }]),
      )
    })
    expect(result.current.joystickRef.current.active).toBe(true)

    act(() => window.dispatchEvent(new Event('blur')))
    expect(result.current.joystickRef.current).toEqual({ active: false, dx: 0, dy: 0 })
    expect(result.current.inputPosRef.current).toBeNull()
  })

  it('a stale mouse target is also cleared on visibilitychange -> hidden', () => {
    const canvas = makeCanvas(rect)
    const canvasRef = { current: canvas }
    const { result } = renderHook(() => useInput(canvasRef, { current: null }))

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 60, bubbles: true }))
    })
    expect(result.current.inputPosRef.current).toEqual({ x: 50, y: 60 })

    const visibility = installVisibilityStub()
    act(() => visibility.setHidden(true))
    expect(result.current.inputPosRef.current).toBeNull()
  })
})

// --- Safe-area inset composition (ROADMAP.md B3, building on B9) -----------
//
// index.css sets --safe-left/--safe-bottom from env(safe-area-inset-*), 0 on
// any device without a cutout/gesture-bar inset (including jsdom, which never
// loads index.css — hence 0 in every test above). These tests set the custom
// properties directly on document.documentElement, which useInput reads via
// getComputedStyle exactly as it would in a browser that resolved env() to a
// non-zero value.
describe('useInput — joystick base composes safe-area insets with JOYSTICK_MARGIN (B3)', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--safe-left')
    document.documentElement.style.removeProperty('--safe-bottom')
  })

  it('shifts the activation zone by the safe-area inset, on top of the existing margin', () => {
    document.documentElement.style.setProperty('--safe-left', '90px')
    document.documentElement.style.setProperty('--safe-bottom', '90px')
    const rect = { left: 0, top: 0, width: 800, height: 600 }
    const canvas = makeCanvas(rect)
    const canvasRef = { current: canvas }
    const { result } = renderHook(() => useInput(canvasRef, { current: null }))

    // Original base (no inset) would be at (JOYSTICK_BASE_X, height - JOYSTICK_BASE_Y).
    // With the insets above, the real base is offset by (+90, -90).
    const shiftedBaseX = JOYSTICK_BASE_X + 90
    const shiftedBaseY = rect.height - JOYSTICK_BASE_Y - 90

    act(() => {
      canvas.dispatchEvent(
        touchEvent('touchstart', [{ identifier: 1, clientX: shiftedBaseX, clientY: shiftedBaseY }]),
      )
    })
    expect(result.current.joystickRef.current.active).toBe(true)
    // A touch at the ORIGINAL (un-shifted) base center should now miss —
    // proves the inset actually moved the zone rather than just being added
    // as slack.
  })

  it('a touch at the original, un-shifted base center misses once insets are applied', () => {
    document.documentElement.style.setProperty('--safe-left', '90px')
    document.documentElement.style.setProperty('--safe-bottom', '90px')
    const rect = { left: 0, top: 0, width: 800, height: 600 }
    const canvas = makeCanvas(rect)
    const canvasRef = { current: canvas }
    const { result } = renderHook(() => useInput(canvasRef, { current: null }))

    act(() => {
      canvas.dispatchEvent(
        touchEvent('touchstart', [
          { identifier: 1, clientX: JOYSTICK_BASE_X, clientY: rect.height - JOYSTICK_BASE_Y },
        ]),
      )
    })
    // sqrt(90^2 + 90^2) ≈ 127px from the real (shifted) base — outside JOYSTICK_ACTIVATE_RADIUS (80).
    expect(result.current.joystickRef.current.active).toBe(false)
  })

  it('defaults to zero inset (unchanged geometry) when the CSS custom properties are absent', () => {
    const rect = { left: 0, top: 0, width: 800, height: 600 }
    const canvas = makeCanvas(rect)
    const canvasRef = { current: canvas }
    const { result } = renderHook(() => useInput(canvasRef, { current: null }))

    act(() => {
      canvas.dispatchEvent(
        touchEvent('touchstart', [
          { identifier: 1, clientX: JOYSTICK_BASE_X, clientY: rect.height - JOYSTICK_BASE_Y },
        ]),
      )
    })
    expect(result.current.joystickRef.current.active).toBe(true)
  })
})

// --- Joystick placement safety (ROADMAP.md Session 19 addendum A13/B9) -----
//
// The functional tests above import JOYSTICK_BASE_X/Y and derive their
// expected values from those same constants — so they stay green through any
// retuning of JOYSTICK_MARGIN, including one that's functionally correct but
// places the activation zone somewhere unsafe. They provide zero coverage of
// the actual property B9 cares about: that a thumb reaching for the stick
// doesn't land in Android's edge-gesture strip.
//
// This block asserts that invariant directly, against a threshold that is
// NOT derived from JOYSTICK_MARGIN/JOYSTICK_BASE_* — so retuning those
// constants can't silently satisfy its own check. SAFE_EDGE_MARGIN mirrors
// Android's documented ~20-24dp back/home gesture-navigation edge exclusion.
//
// Currently FAILS: JOYSTICK_MARGIN=40 puts the activation circle only 20px
// from both edges. Expected to pass once B9's margin increase lands.
const SAFE_EDGE_MARGIN = 24 // px — independent of the joystick's own tuning constants

describe('joystick placement — clears the Android gesture-navigation edges', () => {
  it('activation zone stays >= SAFE_EDGE_MARGIN from the left edge', () => {
    const distanceFromLeftEdge = JOYSTICK_BASE_X - JOYSTICK_ACTIVATE_RADIUS
    expect(distanceFromLeftEdge).toBeGreaterThanOrEqual(SAFE_EDGE_MARGIN)
  })

  it('activation zone stays >= SAFE_EDGE_MARGIN from the bottom edge', () => {
    const distanceFromBottomEdge = JOYSTICK_BASE_Y - JOYSTICK_ACTIVATE_RADIUS
    expect(distanceFromBottomEdge).toBeGreaterThanOrEqual(SAFE_EDGE_MARGIN)
  })
})
