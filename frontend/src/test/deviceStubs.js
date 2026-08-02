// deviceStubs.js — shared jsdom stubs for browser capabilities jsdom doesn't
// implement (Session 19 addendum A14).
//
// Each helper is opt-in — call it inside the test/beforeEach that needs it —
// rather than a blanket setup.js side effect. That matters because some
// existing tests specifically depend on an API being ABSENT (e.g.
// useFullscreen's "entirely absent" iOS Safari fallback test); a global
// default stub would quietly change what those tests are exercising.
// visualViewport is the one exception — see setup.js.

import { vi } from 'vitest'

// document.hidden / visibilitychange. Extracted from AttractBackground.test.jsx
// (Session 17), which solved this cleanly first — reused here rather than
// re-implemented per file.
export function installVisibilityStub() {
  return {
    setHidden(hidden) {
      Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    },
  }
}

// window.visualViewport — absent in jsdom entirely, no polyfill. Needed for
// soft-keyboard-aware layout work (ROADMAP.md B7).
export function installVisualViewportStub(overrides = {}) {
  const listeners = new Set()
  const vv = {
    width: 800,
    height: 600,
    offsetTop: 0,
    offsetLeft: 0,
    scale: 1,
    ...overrides,
    addEventListener: (type, cb) => {
      if (type === 'resize') listeners.add(cb)
    },
    removeEventListener: (type, cb) => {
      if (type === 'resize') listeners.delete(cb)
    },
  }
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true })
  return {
    viewport: vv,
    resize(next) {
      Object.assign(vv, next)
      listeners.forEach((cb) => cb(new Event('resize')))
    },
  }
}

// window.screen.orientation — jsdom has no Screen Orientation API at all.
// Opt-in only: useFullscreen.test.js's "entirely absent" case relies on this
// NOT being installed unless a test explicitly asks for it.
export function installOrientationStub({ lockResolves = true, unlockResolves = true } = {}) {
  const listeners = new Set()
  const lock = vi.fn(() =>
    lockResolves ? Promise.resolve() : Promise.reject(new Error('unsupported')),
  )
  const unlock = vi.fn(() =>
    unlockResolves ? Promise.resolve() : Promise.reject(new Error('unsupported')),
  )
  const orientation = {
    type: 'landscape-primary',
    lock,
    unlock,
    addEventListener: (type, cb) => {
      if (type === 'change') listeners.add(cb)
    },
    removeEventListener: (type, cb) => {
      if (type === 'change') listeners.delete(cb)
    },
  }
  Object.defineProperty(window, 'screen', {
    value: { ...window.screen, orientation },
    configurable: true,
  })
  return {
    orientation,
    lock,
    unlock,
    change(type) {
      orientation.type = type
      listeners.forEach((cb) => cb(new Event('change')))
    },
  }
}
