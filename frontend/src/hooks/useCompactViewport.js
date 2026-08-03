// useCompactViewport.js — shared "landscape phone" breakpoint (ROADMAP.md O24).
//
// StartScreen introduced this rule (window.innerHeight < 500) on its own;
// extracted so every overlay screen shares one definition instead of each
// reimplementing its own resize/orientationchange listener. Height-based, not
// width-based, because a landscape phone (e.g. 851x393) is wide but short —
// Tailwind's width-based `sm:` breakpoint gets this backwards (ROADMAP O25).

import { useState, useEffect } from 'react'

export const COMPACT_HEIGHT_THRESHOLD = 500 // px

export function useCompactViewport() {
  const [isCompact, setIsCompact] = useState(
    () => window.innerHeight < COMPACT_HEIGHT_THRESHOLD,
  )

  useEffect(() => {
    const handler = () => setIsCompact(window.innerHeight < COMPACT_HEIGHT_THRESHOLD)
    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
    }
  }, [])

  return isCompact
}
