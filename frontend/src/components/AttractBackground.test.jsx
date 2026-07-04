// AttractBackground.test.jsx — Area T of the Session 17 audit.
//
// Same canvas-context caveat as Tutorial.test.jsx (D3): getContext is stubbed
// with a permissive Proxy so the draw calls don't throw; no pixel assertions.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import AttractBackground from './AttractBackground.jsx'

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
  return { raf, caf, pendingCount: () => callbacks.size }
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
    render(<AttractBackground />)
    const scheduledBeforeHide = rafSpy.raf.mock.calls.length

    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(rafSpy.caf).toHaveBeenCalled()
    const scheduledWhileHidden = rafSpy.raf.mock.calls.length
    expect(scheduledWhileHidden).toBe(scheduledBeforeHide) // no new frame scheduled while hidden

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(rafSpy.raf.mock.calls.length).toBeGreaterThan(scheduledWhileHidden) // resumed

    Object.defineProperty(document, 'hidden', { value: false, configurable: true }) // reset
  })
})
