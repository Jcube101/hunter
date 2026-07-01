// Tutorial.jsx — first-play three-slide overlay. UI only, no game logic.
//
// Shown once on first ever visit (gated by hunter_tutorial_seen in App), and
// re-triggerable via the start screen's "How to play" link. Swipeable, skippable;
// on dismiss it marks hunter_tutorial_seen so it never auto-shows again.
//
// Each slide has a small canvas illustration drawn in the same visual style as
// the game — reusing drawFish/drawShark from the renderer (no duplicated art).

import { useEffect, useRef, useState } from 'react'
import { theme } from '../constants/theme.js'
import { drawFish, drawShark } from '../game/renderer.js'

const TUTORIAL_KEY = 'hunter_tutorial_seen'
const SWIPE_THRESHOLD = 40 // px of horizontal travel to count as a swipe
const TEAL = '#00BCD4'

const SLIDES = [
  {
    title: 'Chase the School',
    body: 'A school of fish is hiding in the ocean. Hunt them down.',
    w: 200,
    h: 120,
  },
  {
    title: 'Use the Joystick',
    body: 'Press and drag in the bottom-left corner to move your shark. The joystick is invisible — just press anywhere in that area and drag.',
    w: 120,
    h: 120,
  },
  {
    title: '60 Seconds',
    body: 'Catch as many fish as you can before time runs out. Good luck.',
    w: 120,
    h: 120,
  },
]

// --- Slide illustrations (canvas, game visual style) ------------------------

// Slide 1: a small white school with a dark shark approaching from the right.
function drawSchoolScene(ctx, w, h) {
  ctx.clearRect(0, 0, w, h)
  const fish = [
    [46, 44], [68, 38], [90, 46], [42, 62], [66, 60],
    [92, 62], [52, 80], [78, 82], [102, 74],
  ]
  for (const [x, y] of fish) drawFish(ctx, x, y, Math.PI * 0.98, false, {})
  drawShark(ctx, 168, 60, Math.PI) // nose points left toward the school
}

// Slide 2: the invisible joystick made visible — base ring, offset knob, arrow.
function drawJoystickScene(ctx, w, h) {
  ctx.clearRect(0, 0, w, h)
  const cx = w / 2
  const cy = h / 2
  // Base ring
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, 32, 0, Math.PI * 2)
  ctx.stroke()
  // Knob, pushed toward upper-right
  const kx = cx + 15
  const ky = cy - 15
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.beginPath()
  ctx.arc(kx, ky, 14, 0, Math.PI * 2)
  ctx.fill()
  // Direction arrow (teal)
  ctx.strokeStyle = TEAL
  ctx.fillStyle = TEAL
  ctx.lineWidth = 2
  const ax = kx + 20
  const ay = ky - 20
  ctx.beginPath()
  ctx.moveTo(kx + 6, ky - 6)
  ctx.lineTo(ax, ay)
  ctx.stroke()
  ctx.beginPath() // arrowhead
  ctx.moveTo(ax, ay)
  ctx.lineTo(ax - 8, ay + 2)
  ctx.lineTo(ax - 2, ay + 8)
  ctx.closePath()
  ctx.fill()
}

// Slide 3: a circular countdown arc that drains over 4s and loops, 60 -> 57.
function drawTimerScene(ctx, w, h, elapsed) {
  ctx.clearRect(0, 0, w, h)
  const cx = w / 2
  const cy = h / 2
  const r = 40
  const period = 4
  const t = elapsed % period
  const frac = 1 - t / period
  // Faint full ring
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  // Depleting teal arc from the top, clockwise
  ctx.strokeStyle = TEAL
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2)
  ctx.stroke()
  // Countdown number
  ctx.fillStyle = TEAL
  ctx.font = 'bold 26px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(60 - Math.floor(t)), cx, cy + 1)
}

export default function Tutorial({ onDone }) {
  const [index, setIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState(null)
  const canvasRef = useRef(null)
  const isLast = index === SLIDES.length - 1

  // Draw the active slide's illustration. Slide 3 animates via rAF (cleaned up).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const { w, h } = SLIDES[index]
    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (index === 0) {
      drawSchoolScene(ctx, w, h)
      return undefined
    }
    if (index === 1) {
      drawJoystickScene(ctx, w, h)
      return undefined
    }
    let raf
    const start = performance.now()
    const loop = (now) => {
      drawTimerScene(ctx, w, h, (now - start) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [index])

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

      <canvas
        ref={canvasRef}
        style={{ width: slide.w, height: slide.h }}
        aria-hidden="true"
      />
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
