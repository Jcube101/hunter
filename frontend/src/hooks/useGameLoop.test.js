// useGameLoop.test.js — Area J of the Session 17 audit.
//
// requestAnimationFrame is replaced with a controllable spy (audit decision
// D6) that captures the scheduled callback instead of firing it on a real
// clock, so each test can drive frames with exact, arbitrary timestamps.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameLoop } from './useGameLoop.js'

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
    // Invoke the most recently scheduled (and still pending) callback.
    fire(now) {
      const ids = [...callbacks.keys()]
      if (ids.length === 0) return
      const lastId = ids[ids.length - 1]
      const cb = callbacks.get(lastId)
      callbacks.delete(lastId)
      cb(now)
    },
    pendingCount() {
      return callbacks.size
    },
  }
}

let rafSpy

// Proposed backstop clamp from ROADMAP.md Session 19 addendum A2 — not yet
// implemented. The exact value is a judgment call (the addendum floats
// "~0.25s"); recorded here as the target the intended-behavior test below
// checks against, not as a value pulled from source.
const INTENDED_MAX_DT_SECONDS = 0.25

beforeEach(() => {
  rafSpy = installRafSpy()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useGameLoop', () => {
  it('start() schedules the loop; the first frame calls update then draw', () => {
    const update = vi.fn()
    const draw = vi.fn()
    const { result } = renderHook(() => useGameLoop(update, draw))
    act(() => result.current.start())
    expect(rafSpy.raf).toHaveBeenCalledTimes(1)
    act(() => rafSpy.fire(5000))
    expect(update).toHaveBeenCalledTimes(1)
    expect(draw).toHaveBeenCalledTimes(1)
  })

  it('the first frame assumes one 60fps step regardless of the timestamp given', () => {
    const update = vi.fn()
    const { result } = renderHook(() => useGameLoop(update, () => {}))
    act(() => result.current.start())
    act(() => rafSpy.fire(123456)) // arbitrary — lastRef starts at 0 (falsy)
    const [dt] = update.mock.calls[0]
    expect(dt).toBeCloseTo(1, 5)
  })

  it('normalizes dt to ~1 for a normal 60Hz frame gap', () => {
    const update = vi.fn()
    const { result } = renderHook(() => useGameLoop(update, () => {}))
    act(() => result.current.start())
    act(() => rafSpy.fire(1000))
    act(() => rafSpy.fire(1000 + 1000 / 60))
    const [dt] = update.mock.calls[1]
    expect(dt).toBeCloseTo(1, 1)
  })

  it('caps motion dt at 3 after a long stall (spiral-of-death guard — physics/rendering only, NOT the round timer; see the dtSeconds tests below)', () => {
    const update = vi.fn()
    const { result } = renderHook(() => useGameLoop(update, () => {}))
    act(() => result.current.start())
    act(() => rafSpy.fire(1000))
    act(() => rafSpy.fire(1000 + 5000)) // huge gap: 5 real seconds later
    const [dt] = update.mock.calls[1]
    expect(dt).toBe(3)
  })

  // ROADMAP.md Session 19 addendum A1/A13: the test above only ever
  // destructured `dt` (motion), never the second argument, `dtSeconds` (wall
  // clock, used to decrement the round timer — App.jsx). That blind spot let
  // a real bug hide behind a green "spiral-of-death guard" test: dtSeconds is
  // NOT capped, so a 5-second stall (backgrounding the tab, an interruption)
  // charges the FULL 5 seconds to the round clock in a single frame. This
  // test pins that current, actual behavior — it passes today, and it is the
  // bug the next test targets, not a spec to preserve.
  it('documents current behavior: dtSeconds is uncapped after a long stall and equals the full gap (5s) — this is the round-clock bug from ROADMAP A2, not intended behavior', () => {
    const update = vi.fn()
    const { result } = renderHook(() => useGameLoop(update, () => {}))
    act(() => result.current.start())
    act(() => rafSpy.fire(1000))
    act(() => rafSpy.fire(1000 + 5000))
    const [, dtSeconds] = update.mock.calls[1]
    expect(dtSeconds).toBe(5)
  })

  // Intended behavior (ROADMAP A2): a defensive dtSeconds clamp so a single
  // frame can never consume more than a small slice of the round timer, even
  // if the visibilitychange-pause fix is somehow bypassed. Expected to FAIL
  // until that clamp lands (Phase 2) — this is the known-red test the phase
  // exists to introduce, not a broken assertion.
  it('[Phase 2] clamps dtSeconds after a long stall so a single interruption cannot burn most of the round timer', () => {
    const update = vi.fn()
    const { result } = renderHook(() => useGameLoop(update, () => {}))
    act(() => result.current.start())
    act(() => rafSpy.fire(1000))
    act(() => rafSpy.fire(1000 + 5000))
    const [, dtSeconds] = update.mock.calls[1]
    expect(dtSeconds).toBeLessThanOrEqual(INTENDED_MAX_DT_SECONDS)
  })

  it('stop() cancels the frame and blocks further update/draw', () => {
    const update = vi.fn()
    const draw = vi.fn()
    const { result } = renderHook(() => useGameLoop(update, draw))
    act(() => result.current.start())
    act(() => result.current.stop())
    expect(rafSpy.caf).toHaveBeenCalled()
    act(() => rafSpy.fire(9999)) // no-op: nothing pending after cancel
    expect(update).not.toHaveBeenCalled()
    expect(draw).not.toHaveBeenCalled()
  })

  it('an update() that calls stop() mid-frame skips that frame\'s draw and does not reschedule', () => {
    let stopFn
    const update = vi.fn(() => stopFn())
    const draw = vi.fn()
    const { result } = renderHook(() => useGameLoop(update, draw))
    stopFn = () => result.current.stop()
    act(() => result.current.start())
    const scheduleCountBefore = rafSpy.raf.mock.calls.length
    act(() => rafSpy.fire(1000))
    expect(update).toHaveBeenCalledTimes(1)
    expect(draw).not.toHaveBeenCalled() // bailed before draw
    expect(rafSpy.raf.mock.calls.length).toBe(scheduleCountBefore) // no reschedule
  })

  it('unmounting mid-game cancels the pending frame', () => {
    const { result, unmount } = renderHook(() => useGameLoop(() => {}, () => {}))
    act(() => result.current.start())
    unmount()
    expect(rafSpy.caf).toHaveBeenCalled()
  })
})
