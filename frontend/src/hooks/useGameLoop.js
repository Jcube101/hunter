// useGameLoop.js — requestAnimationFrame loop driver.
//
// Calls update(deltaSeconds) then draw() each frame. update/draw are kept in
// refs so the loop always invokes the latest closures without re-subscribing.
// Starts/stops cleanly and cancels any pending frame on unmount — no lingering
// loops. Per CONTRIBUTING.md, the loop never triggers React re-renders itself.

import { useRef, useCallback, useEffect } from 'react'

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
    const dt = lastRef.current ? (now - lastRef.current) / 1000 : 1 / 60
    lastRef.current = now
    updateRef.current(dt)
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
