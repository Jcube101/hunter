// Tutorial.jsx — first-play three-slide overlay. UI only, no game logic.
//
// Shown once on first ever visit (gated by hunter_tutorial_seen in App), and
// re-triggerable via the start screen's "How to play" link. Swipeable, skippable;
// on dismiss it marks hunter_tutorial_seen so it never auto-shows again.

import { useState } from 'react'
import { theme } from '../constants/theme.js'

const TUTORIAL_KEY = 'hunter_tutorial_seen'
const SWIPE_THRESHOLD = 40 // px of horizontal travel to count as a swipe

const SLIDES = [
  {
    title: 'Chase the School',
    body: 'A school of fish is hiding in the ocean. Hunt them down.',
    visual: '🐟🐟🐟',
  },
  {
    title: 'Use the Joystick',
    body: 'Press and drag the joystick in the bottom-left corner to move your shark.',
    visual: '🕹️',
  },
  {
    title: '60 Seconds',
    body: 'Catch as many fish as you can before time runs out. Good luck.',
    visual: '⏱️',
  },
]

export default function Tutorial({ onDone }) {
  const [index, setIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState(null)
  const isLast = index === SLIDES.length - 1

  const dismiss = () => {
    localStorage.setItem(TUTORIAL_KEY, 'true')
    onDone()
  }
  const next = () => (isLast ? dismiss() : setIndex((i) => i + 1))
  const prev = () => setIndex((i) => Math.max(0, i - 1))

  const onTouchStart = (e) => setTouchStartX(e.changedTouches[0].clientX)
  const onTouchEnd = (e) => {
    if (touchStartX === null) return
    const dx = e.changedTouches[0].clientX - touchStartX
    if (dx <= -SWIPE_THRESHOLD) next()
    else if (dx >= SWIPE_THRESHOLD) prev()
    setTouchStartX(null)
  }

  const slide = SLIDES[index]

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-8 px-6 text-center"
      style={{ background: theme.background }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Skip — top-right */}
      <button
        onClick={dismiss}
        className="absolute right-4 top-4 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-300 transition active:scale-95"
      >
        Skip
      </button>

      <div className="text-7xl" aria-hidden="true">
        {slide.visual}
      </div>
      <div className="flex flex-col items-center gap-3">
        <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: theme.accent }}>
          {slide.title}
        </h2>
        <p className="max-w-sm text-base text-slate-300">{slide.body}</p>
      </div>

      {/* Slide dots */}
      <div className="flex items-center gap-2">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full transition"
            style={{ backgroundColor: i === index ? theme.accent : '#334155' }}
          />
        ))}
      </div>

      <button
        onClick={next}
        className="rounded-xl px-12 py-3 text-lg font-bold text-slate-900 transition active:scale-95"
        style={{ backgroundColor: theme.accent }}
      >
        {isLast ? 'Play' : 'Next'}
      </button>
    </div>
  )
}
