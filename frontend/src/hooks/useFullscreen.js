// useFullscreen.js — Fullscreen API + landscape orientation lock.
//
// enter() requests fullscreen on the document element and tries to lock
// landscape. Both are wrapped so that an unsupported API (notably some iOS
// Safari versions) fails silently — no thrown error, no error shown to the
// player (GDD.md graceful fallback). onExit fires whenever fullscreen ends,
// expected or not, so the game can pause.

import { useState, useCallback, useEffect, useRef } from 'react'

export function useFullscreen(onExit) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  const enter = useCallback(async () => {
    const el = document.documentElement
    try {
      if (el.requestFullscreen) await el.requestFullscreen()
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
    } catch {
      // Fullscreen unavailable — run windowed, no error shown.
    }
    try {
      if (window.screen?.orientation?.lock) {
        await window.screen.orientation.lock('landscape')
      }
    } catch {
      // Orientation lock unavailable (e.g. iOS Safari) — ignore.
    }
  }, [])

  const exit = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen()
      }
    } catch {
      // Already out of fullscreen or unsupported — ignore.
    }
    try {
      // Chrome releases the lock implicitly when fullscreen ends, but that's
      // not guaranteed (fullscreen was never entered, or refused) — release
      // explicitly so a standalone PWA session can't leave landscape pinned
      // outside gameplay (ROADMAP.md B11).
      if (window.screen?.orientation?.unlock) {
        await window.screen.orientation.unlock()
      }
    } catch {
      // Unlock unavailable — ignore.
    }
  }, [])

  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement
      setIsFullscreen(fs)
      if (!fs && onExitRef.current) onExitRef.current()
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  return { enter, exit, isFullscreen }
}
