// useGameLoop.test.js — Area J of the Session 17 audit.
//
// requestAnimationFrame is replaced with a controllable spy (audit decision
// D6) that captures the scheduled callback instead of firing it on a real
// clock, so each test can drive frames with exact, arbitrary timestamps.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameLoop } from './useGameLoop.js'
import { TARGET_FPS } from '../constants/boids.js'

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
  // a real bug hide behind a green "spiral-of-death guard" test: dtSeconds
  // was NOT capped, so a 5-second stall (backgrounding the tab, an
  // interruption) charged the FULL 5 seconds to the round clock in a single
  // frame. Fixed in Session 23 (ROADMAP A2) — see the clamp test below. This
  // test previously pinned the uncapped 5.0s behavior; that job is done now
  // that the clamp exists, so it was replaced rather than kept as dead
  // documentation.

  // ROADMAP A2: a defensive dtSeconds clamp so a single frame can never
  // consume more than a small slice of the round timer, even if the
  // visibilitychange-pause fix (App.jsx, Session 23) is somehow bypassed.
  it('clamps dtSeconds after a long stall so a single interruption cannot burn most of the round timer', () => {
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

  // ROADMAP.md O10 — frame cap so a high-refresh display doesn't run the
  // simulation/repaint twice as often for no gameplay benefit.
  describe('frame cap (TARGET_FPS, ROADMAP.md O10)', () => {
    const FRAME_MS_120HZ = 1000 / 120
    const FRAME_MS_60HZ = 1000 / TARGET_FPS

    it('skips update/draw for a native frame that arrives well under the target interval (120Hz)', () => {
      const update = vi.fn()
      const draw = vi.fn()
      const { result } = renderHook(() => useGameLoop(update, draw))
      act(() => result.current.start())
      act(() => rafSpy.fire(1000)) // first frame always runs
      expect(update).toHaveBeenCalledTimes(1)

      act(() => rafSpy.fire(1000 + FRAME_MS_120HZ)) // ~8.3ms later — too soon
      expect(update).toHaveBeenCalledTimes(1) // skipped
      expect(draw).toHaveBeenCalledTimes(1) // draw also skipped
      expect(rafSpy.pendingCount()).toBe(1) // still rescheduled, not stalled
    })

    it('does not skip a native frame that arrives at (or just under) the target interval (60Hz)', () => {
      const update = vi.fn()
      const { result } = renderHook(() => useGameLoop(update, () => {}))
      act(() => result.current.start())
      act(() => rafSpy.fire(1000))
      act(() => rafSpy.fire(1000 + FRAME_MS_60HZ)) // ~16.67ms later
      expect(update).toHaveBeenCalledTimes(2) // not skipped
    })

    it('carries a skipped frame\'s elapsed time forward instead of dropping it', () => {
      const update = vi.fn()
      const { result } = renderHook(() => useGameLoop(update, () => {}))
      act(() => result.current.start())
      act(() => rafSpy.fire(1000)) // frame 1: processed, lastRef = 1000

      // Two native 120Hz ticks arrive before a full 60fps interval has
      // passed; both are skipped.
      act(() => rafSpy.fire(1000 + FRAME_MS_120HZ)) // 1008.3 — skipped
      act(() => rafSpy.fire(1000 + FRAME_MS_120HZ * 2)) // 1016.7 — processed
      expect(update).toHaveBeenCalledTimes(2)
      const [dt] = update.mock.calls[1]
      // The processed frame's dt reflects the FULL gap since frame 1
      // (~16.7ms, dt≈1), not just the gap since the last (skipped) tick
      // (~8.3ms, which would give dt≈0.5 and silently lose half a frame of
      // motion/timer on every skip).
      expect(dt).toBeCloseTo(1, 1)
    })

    it('produces the same total update() count and total dt/dtSeconds over a fixed wall-clock duration at 60Hz and at 120Hz', () => {
      // Simulates a 2-second round-clock window at each native refresh rate
      // and sums what the loop actually delivered to update(). This is the
      // property that matters for gameplay: a 120Hz player and a 60Hz player
      // must experience the same round length and the same total motion,
      // not just "some cap is applied."
      function simulate(nativeFrameMs, durationMs) {
        const localRaf = installRafSpy()
        vi.stubGlobal('requestAnimationFrame', localRaf.raf)
        vi.stubGlobal('cancelAnimationFrame', localRaf.caf)
        const calls = []
        const { result } = renderHook(() => useGameLoop((dt, dtSeconds) => calls.push([dt, dtSeconds]), () => {}))
        act(() => result.current.start())
        // Start well above 0 — a real rAF timestamp is time-since-page-load
        // and is never exactly 0 for a game loop's frames in practice; 0
        // would collide with lastRef's "no prior frame yet" falsy sentinel
        // on what should be treated as an ordinary subsequent frame.
        let now = 1000
        const start = now
        act(() => localRaf.fire(now)) // first frame
        while (now < start + durationMs) {
          now += nativeFrameMs
          act(() => localRaf.fire(now))
        }
        return calls
      }

      const calls60 = simulate(FRAME_MS_60HZ, 2000)
      const calls120 = simulate(FRAME_MS_120HZ, 2000)

      const sum = (calls, i) => calls.reduce((acc, c) => acc + c[i], 0)
      const totalDt60 = sum(calls60, 0)
      const totalDt120 = sum(calls120, 0)
      const totalDtSeconds60 = sum(calls60, 1)
      const totalDtSeconds120 = sum(calls120, 1)

      // Same round-clock decrement either way (this is the A2/O10 timer
      // integrity property): total wall-clock time delivered to the timer
      // matches within a fraction of a frame interval.
      expect(totalDtSeconds120).toBeCloseTo(totalDtSeconds60, 0)
      // Same total motion either way: dt is frame-normalized (~1 per 1/60s
      // of real time), so the sums should match within roughly one frame's
      // worth of dt, not diverge by the ~2x a naive uncapped 120Hz loop
      // would produce.
      expect(Math.abs(totalDt120 - totalDt60)).toBeLessThan(2)
      // And update() itself ran roughly the same number of times at both
      // rates (~60/sec), not twice as often at 120Hz.
      expect(Math.abs(calls120.length - calls60.length)).toBeLessThanOrEqual(2)
    })
  })
})
