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
// update/draw are kept in refs so the loop always invokes the latest closures
// without re-subscribing. Starts/stops cleanly and cancels any pending frame on
// unmount. Per CONTRIBUTING.md, the loop never triggers React re-renders itself.

import { useRef, useCallback, useEffect } from 'react'

const MAX_DT_SECONDS = 0.25 // ~15 frames of slack at 60fps (ROADMAP.md A2)

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
