// RotationToast.jsx — one-shot "rotate your phone" hint. UI only.
//
// Shown only on touch devices in portrait orientation, once per browser session
// (sessionStorage, not localStorage — so it reappears next session). Appears 1s
// after mount, auto-dismisses after 4s, and never blocks interaction
// (pointer-events-none).

import { useEffect, useState } from 'react'

const SESSION_KEY = 'hunter_rotation_toast_shown'
const FADE_MS = 300

export function RotationToast() {
  const [mounted, setMounted] = useState(false)
  const [show, setShow] = useState(false) // drives the opacity transition

  useEffect(() => {
    const isTouchDevice = navigator.maxTouchPoints > 0
    const isPortrait = window.innerHeight > window.innerWidth
    if (!isTouchDevice || !isPortrait) return undefined
    if (sessionStorage.getItem(SESSION_KEY)) return undefined

    let hideTimer
    let unmountTimer
    const showTimer = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, 'true')
      setMounted(true)
      // Next frame: flip opacity to 1 so the transition runs (fade in).
      requestAnimationFrame(() => setShow(true))
      hideTimer = setTimeout(() => {
        setShow(false) // fade out
        unmountTimer = setTimeout(() => setMounted(false), FADE_MS)
      }, 4000)
    }, 1000)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
      clearTimeout(unmountTimer)
    }
  }, [])

  if (!mounted) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-8 z-50 flex justify-center px-4">
      <div
        className="rounded-full bg-slate-900/90 px-5 py-2.5 text-sm font-medium text-slate-100 shadow-lg ring-1 ring-slate-700 transition-opacity duration-300"
        style={{ opacity: show ? 1 : 0 }}
      >
        Rotate your phone for the best experience 🔄
      </div>
    </div>
  )
}
