// App.test.jsx — Session 22 Bug 1 regression: endGame() must use the
// difficulty actually played, not whatever `difficulty` was on App's FIRST
// render.
//
// Root cause: onFrameUpdate is a useCallback whose only deps (movePredator,
// tickBoids) never change identity for the component's lifetime, so it is
// memoized exactly once — meaning the endGame() it calls is permanently the
// closure captured on the FIRST render, including that render's `difficulty`
// value. startGame() (invoked directly from onClick handlers, not through
// onFrameUpdate) correctly tracks live difficulty via its own deps, which is
// why gameplay tuning was always correct while the PB key/value silently
// wasn't — exactly the kind of boundary Session 18/19's tests never
// exercised (they call isNewPersonalBest() and App's tuning helpers
// directly, with correct inputs already assumed).
//
// This is deliberately an App-level test, not another pure-function test —
// the bug lives in the wiring between App's closures, not in any function
// this suite could unit-test in isolation.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import App from './App.jsx'

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

function installFakeAudio() {
  class FakeAudio {
    constructor(src) {
      this.src = src
      this.loop = false
      this.volume = 1
      this.paused = true
      this.currentTime = 0
      this.play = vi.fn(() => {
        this.paused = false
        return Promise.resolve()
      })
      this.pause = vi.fn(() => {
        this.paused = true
      })
    }
  }
  vi.stubGlobal('Audio', FakeAudio)
}

let rafSpy

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('hunter_tutorial_seen', 'true') // skip the first-play overlay
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(makeFakeCtx())
  installFakeAudio()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) }))
  rafSpy = installRafSpy()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

// Ends the currently-playing round deterministically: force the clock past
// zero and fire one frame, rather than relying on real elapsed time.
async function forceRoundEnd(score) {
  await waitFor(() => expect(window.__hunter.stateRef.current).toBe('playing'))
  window.__hunter.scoreRef.current = score
  window.__hunter.timeLeftRef.current = -1
  act(() => rafSpy.fire(1000))
  await waitFor(() => expect(window.__hunter.stateRef.current).toBe('end'))
}

describe('App — endGame() difficulty (Session 22 Bug 1)', () => {
  it('uses the difficulty actually played, not the one active on the first render', async () => {
    // Mirrors the reported device scenario exactly: an Easy PB already
    // exists, difficulty was 'easy' on mount (App's first render — this is
    // the value the old code would have frozen forever), then the player
    // switches to Hardcore WITHOUT ever starting an Easy round first.
    localStorage.setItem('hunter_difficulty', 'easy')
    localStorage.setItem('hunter_pb_easy', '52')

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Hardcore' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    await forceRoundEnd(5)

    // The Hardcore PB slot gets this round's score (a new PB — Hardcore
    // defaults to 0) and nothing touches the Easy slot.
    expect(localStorage.getItem('hunter_pb_hardcore')).toBe('5')
    expect(localStorage.getItem('hunter_pb_easy')).toBe('52')

    // The displayed "Personal best" reflects Hardcore's own PB (5), not the
    // stale Easy value (52) — this is the exact symptom reported on-device.
    // Anchored to exclude the separate "New personal best! 🎉" flourish line.
    const pbLine = await screen.findByText(/^personal best:/i)
    expect(pbLine.textContent).toContain('5')
    expect(pbLine.textContent).not.toContain('52')
  })

  it('continues to track the LIVE difficulty across multiple rounds, not just the second-ever selection', async () => {
    localStorage.setItem('hunter_pb_hardcore', '10')
    render(<App />)

    // Round 1: Hardcore, score 20 -> new Hardcore PB.
    fireEvent.click(screen.getByRole('button', { name: 'Hardcore' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    await forceRoundEnd(20)
    expect(localStorage.getItem('hunter_pb_hardcore')).toBe('20')

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    await waitFor(() => expect(window.__hunter.stateRef.current).toBe('start'))

    // Round 2: switch to Normal, score 8 -> new Normal PB (default 0), and
    // Hardcore's slot from round 1 must stay untouched.
    fireEvent.click(screen.getByRole('button', { name: 'Normal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    await forceRoundEnd(8)
    expect(localStorage.getItem('hunter_pb_normal')).toBe('8')
    expect(localStorage.getItem('hunter_pb_hardcore')).toBe('20')
  })
})

// ROADMAP.md O21/A2: the only mobile pause path used to be fullscreen-exit,
// which depends on the back/app-switch gesture firing `fullscreenchange` — not
// guaranteed in a standalone PWA session. visibilitychange is a second,
// independent pause path that fires regardless of fullscreen semantics.
describe('App — visibilitychange pauses an in-progress round (O21/A2)', () => {
  function setHidden(hidden) {
    Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  afterEach(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })

  it('pauses the round when the document is hidden mid-play, without needing fullscreenchange', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    await waitFor(() => expect(window.__hunter.stateRef.current).toBe('playing'))

    const cafCallsBefore = rafSpy.caf.mock.calls.length
    act(() => setHidden(true))

    expect(window.__hunter.stateRef.current).toBe('paused')
    // The loop must actually stop, not just flip the screen state.
    expect(rafSpy.caf.mock.calls.length).toBeGreaterThan(cafCallsBefore)
  })

  it('does nothing when hidden while not playing (e.g. on the start screen)', () => {
    render(<App />)
    expect(window.__hunter.stateRef.current).toBe('start')
    act(() => setHidden(true))
    expect(window.__hunter.stateRef.current).toBe('start')
  })

  it('a hidden round never reaches a giant dtSeconds frame on return (A2 backstop holds end-to-end)', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    await waitFor(() => expect(window.__hunter.stateRef.current).toBe('playing'))
    const timeBeforeHide = window.__hunter.timeLeftRef.current

    act(() => setHidden(true))
    expect(window.__hunter.stateRef.current).toBe('paused')

    // Simulate a long real-world gap while hidden, then return and resume.
    act(() => setHidden(false))
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    await waitFor(() => expect(window.__hunter.stateRef.current).toBe('playing'))
    act(() => rafSpy.fire(1000 + 30000)) // a huge stamp gap, as if 30s passed while hidden

    // The clock lost at most the defensive dtSeconds clamp's worth of time,
    // not the full simulated 30s gap — because the round was paused (and the
    // loop's own lastRef reset by start()) rather than charged wall-clock.
    expect(timeBeforeHide - window.__hunter.timeLeftRef.current).toBeLessThan(1)
  })
})
