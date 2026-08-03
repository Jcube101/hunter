// AttractBackground.test.jsx — Area T of the Session 17 audit.
//
// Same canvas-context caveat as Tutorial.test.jsx (D3): getContext is stubbed
// with a permissive Proxy so the draw calls don't throw; no pixel assertions.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import AttractBackground from './AttractBackground.jsx'
import { installVisibilityStub } from '../test/deviceStubs.js'
import { MAX_DEVICE_PIXEL_RATIO, TARGET_FPS } from '../constants/boids.js'

function makeFakeCtx() {
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop in target) return target[prop]
        return vi.fn()
      },
      set(target, prop, value) {
        target[prop] = value
        return true
      },
    },
  )
}

function installRafSpy() {
  let id = 0
  const callbacks = new Map()
  const raf = vi.fn((cb) => {
    const i = ++id
    callbacks.set(i, cb)
    return i
  })
  const caf = vi.fn((i) => callbacks.delete(i))
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', caf)
  return {
    raf,
    caf,
    pendingCount: () => callbacks.size,
    // Invoke the most recently scheduled (and still pending) callback, with
    // an exact timestamp — needed to drive the frame-cap skip logic
    // deterministically (mirrors useGameLoop.test.js's spy).
    fire(now) {
      const ids = [...callbacks.keys()]
      if (ids.length === 0) return
      const lastId = ids[ids.length - 1]
      const cb = callbacks.get(lastId)
      callbacks.delete(lastId)
      cb(now)
    },
  }
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(makeFakeCtx())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('AttractBackground', () => {
  it('starts the animation loop on mount', () => {
    const rafSpy = installRafSpy()
    render(<AttractBackground />)
    expect(rafSpy.raf).toHaveBeenCalled()
  })

  it('cancels the loop on unmount', () => {
    const rafSpy = installRafSpy()
    const { unmount } = render(<AttractBackground />)
    expect(rafSpy.pendingCount()).toBeGreaterThan(0)
    unmount()
    expect(rafSpy.caf).toHaveBeenCalled()
    expect(rafSpy.pendingCount()).toBe(0)
  })

  it('pauses on visibilitychange (hidden) and resumes when visible again', () => {
    const rafSpy = installRafSpy()
    const visibility = installVisibilityStub()
    render(<AttractBackground />)
    const scheduledBeforeHide = rafSpy.raf.mock.calls.length

    visibility.setHidden(true)
    expect(rafSpy.caf).toHaveBeenCalled()
    const scheduledWhileHidden = rafSpy.raf.mock.calls.length
    expect(scheduledWhileHidden).toBe(scheduledBeforeHide) // no new frame scheduled while hidden

    visibility.setHidden(false)
    expect(rafSpy.raf.mock.calls.length).toBeGreaterThan(scheduledWhileHidden) // resumed
  })
})

// ROADMAP.md O8/O10 follow-up (Session 26) — AttractBackground reuses
// MAX_DEVICE_PIXEL_RATIO/TARGET_FPS from constants/boids.js, the same
// constants the real game loop clamps to, but keeps its own separate rAF
// loop (never useGameLoop.js) per this file's isolation requirement.
describe('AttractBackground — performance (reuses O8/O10 constants, Session 26)', () => {
  function setDPR(value) {
    Object.defineProperty(window, 'devicePixelRatio', { value, configurable: true })
  }

  afterEach(() => {
    setDPR(1)
  })

  it('clamps a high real DPR down to MAX_DEVICE_PIXEL_RATIO', () => {
    setDPR(2.75)
    render(<AttractBackground />)
    const canvas = document.querySelector('canvas')
    expect(canvas.width).toBe(Math.round(window.innerWidth * MAX_DEVICE_PIXEL_RATIO))
    expect(canvas.height).toBe(Math.round(window.innerHeight * MAX_DEVICE_PIXEL_RATIO))
  })

  it('does not alter a DPR already under the cap (1.5)', () => {
    setDPR(1.5)
    render(<AttractBackground />)
    const canvas = document.querySelector('canvas')
    expect(canvas.width).toBe(Math.round(window.innerWidth * 1.5))
  })

  // A stable-reference ctx (unlike makeFakeCtx above, whose Proxy hands out a
  // fresh vi.fn() per property access and is explicitly documented as
  // unusable for call-count assertions) so fillRect's call count can stand in
  // for "how many times draw() actually ran".
  function makeStableCtx() {
    return new Proxy(
      {},
      {
        get(target, prop) {
          if (!(prop in target)) target[prop] = vi.fn()
          return target[prop]
        },
        set(target, prop, value) {
          target[prop] = value
          return true
        },
      },
    )
  }

  it('skips the sim/draw step for a native frame arriving well under the target interval (120Hz)', () => {
    const stableCtx = makeStableCtx()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(stableCtx)
    const rafSpy = installRafSpy()
    render(<AttractBackground />)

    act(() => rafSpy.fire(1000)) // first rAF frame always processes
    const callsAfterFirstFrame = stableCtx.fillRect.mock.calls.length
    expect(callsAfterFirstFrame).toBeGreaterThan(0)

    act(() => rafSpy.fire(1000 + 1000 / 120)) // ~8.3ms later — too soon for a 60fps target
    expect(stableCtx.fillRect.mock.calls.length).toBe(callsAfterFirstFrame) // skipped
  })

  it('does not skip a native frame that arrives at the target interval (60Hz)', () => {
    const stableCtx = makeStableCtx()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(stableCtx)
    const rafSpy = installRafSpy()
    render(<AttractBackground />)

    act(() => rafSpy.fire(1000))
    const callsAfterFirstFrame = stableCtx.fillRect.mock.calls.length
    act(() => rafSpy.fire(1000 + 1000 / TARGET_FPS))
    expect(stableCtx.fillRect.mock.calls.length).toBeGreaterThan(callsAfterFirstFrame) // not skipped
  })
})
