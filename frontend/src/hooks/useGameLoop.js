// useGameLoop.js — requestAnimationFrame loop driver.
//
// Calls update(dt, dtSeconds) then draw() each frame, where:
//   - dt        = frame-normalized delta (~1.0 at 60Hz, ~0.5 at 120Hz) used to
//                 keep motion identical across refresh rates; capped at 3.
//   - dtSeconds = wall-clock seconds, used by the timer; capped at
//                 MAX_DT_SECONDS so a single frame after a stall/interruption
//                 can never burn a large slice of the round clock (ROADMAP.md
//                 A2). This is a defensive backstop — the primary fix is
//                 App.jsx pausing on visibilitychange before a giant frame
//                 gap can even occur.
//
// Frame cap (ROADMAP.md O10): rAF fires at the display's native refresh rate
// (up to 120Hz on the S23 FE), doubling the O(n^2) boids pass and full-canvas
// repaint for no gameplay benefit. update()/draw() are gated to run at most
// TARGET_FPS times/sec — rAF itself is NOT throttled (every native frame
// still calls this callback; the callback just returns early without
// touching the simulation or canvas when too little real time has passed).
// Critically, `lastRef` only advances on a frame that actually runs
// update()/draw(), so elapsedMs on the next such frame is the real gap since
// the last SIMULATED frame, not since the last native tick — a skipped
// frame's elapsed time is carried forward into dt/dtSeconds on the next
// processed frame, never dropped. This is what keeps round length and
// motion identical between a 60Hz and a 120Hz device (see
// useGameLoop.test.js "frame cap" tests).
import { useRef, useCallback, useEffect } from 'react'
import { TARGET_FPS } from '../constants/boids.js'

const MAX_DT_SECONDS = 0.25 // ~15 frames of slack at 60fps (ROADMAP.md A2)
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS
// Tolerance below FRAME_INTERVAL_MS so ordinary rAF timing jitter at the
// TARGET_FPS boundary (e.g. a 60Hz device occasionally reporting 16.1ms
// instead of 16.67ms) doesn't cause an extra skipped frame. Skipping is only
// meant to bite at meaningfully higher refresh rates (90/120/144Hz).
const FRAME_SKIP_EPSILON_MS = 2

export function useGameLoop(update, draw) {
  const updateRef = useRef(update)
  const drawRef = useRef(draw)
  updateRef.current = update
  drawRef.current = draw

  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const runningRef = useRef(false)

  const loop = useCallback((now) => {
    if (!runningRef.current) return
    // First frame has no prior timestamp; assume one 60fps step.
    const elapsedMs = lastRef.current ? now - lastRef.current : 1000 / 60
    // Below the target interval (a native frame arrived early, e.g. 120Hz) —
    // reschedule without touching lastRef, so the skipped time accumulates
    // into the next processed frame's elapsedMs rather than being dropped.
    if (lastRef.current && elapsedMs < FRAME_INTERVAL_MS - FRAME_SKIP_EPSILON_MS) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    lastRef.current = now
    // Frame-normalized delta: ~1.0 at 60Hz. Capped at 3 to prevent a
    // spiral-of-death after the tab is backgrounded.
    const dt = Math.min(elapsedMs / (1000 / 60), 3)
    const dtSeconds = Math.min(elapsedMs / 1000, MAX_DT_SECONDS)
    updateRef.current(dt, dtSeconds)
    // update() may end the game (calls stop() → runningRef=false). Bail before
    // drawing or re-scheduling so no rAF callback survives game end — the canvas
    // is then frozen on its last frame (and hidden by the end screen).
    if (!runningRef.current) return
    drawRef.current()
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const start = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    lastRef.current = 0
    rafRef.current = requestAnimationFrame(loop)
  }, [loop])

  const stop = useCallback(() => {
    runningRef.current = false
    cancelAnimationFrame(rafRef.current)
  }, [])

  // Safety net: kill the loop if the component unmounts mid-game.
  useEffect(() => {
    return () => {
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return { start, stop }
}
