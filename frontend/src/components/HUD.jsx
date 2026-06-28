// HUD.jsx — score + timer as positioned divs OVER the canvas (not drawn on it).
// Per SPEC.md's React/Canvas boundary, the HUD is React, the game is canvas.

import { theme } from '../constants/theme.js'
import { LOW_TIME_THRESHOLD } from '../constants/boids.js'

function formatTime(seconds) {
  const t = Math.max(0, Math.ceil(seconds))
  const mm = Math.floor(t / 60)
  const ss = String(t % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export default function HUD({ score, timeLeft, difficulty }) {
  const low = timeLeft <= LOW_TIME_THRESHOLD
  const modeLabel = difficulty ? difficulty[0].toUpperCase() + difficulty.slice(1) : ''

  return (
    // pointer-events-none so the HUD never intercepts canvas input
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="absolute left-5 top-4">
        <div className="text-3xl font-bold tabular-nums" style={{ color: theme.hud.text }}>
          {score}
        </div>
        {modeLabel && (
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {modeLabel}
          </div>
        )}
      </div>
      <div
        className={`absolute right-5 top-4 text-3xl font-bold tabular-nums ${low ? 'animate-pulse' : ''}`}
        style={{ color: low ? theme.hud.timerLow : theme.hud.text }}
      >
        {formatTime(timeLeft)}
      </div>
    </div>
  )
}
