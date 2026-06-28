// StartScreen.jsx — title / theme select / play. UI only, no game logic.

import { useEffect, useState } from 'react'
import { theme } from '../constants/theme.js'

const PB_KEY = 'hunter_pb'

export default function StartScreen({ onPlay, onLeaderboard, muted, onToggleMute }) {
  const [personalBest, setPersonalBest] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem(PB_KEY)
    if (stored !== null) setPersonalBest(parseInt(stored, 10))
  }, [])

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 text-center">
      {/* Mute toggle — top-right, icon only, persisted in localStorage */}
      <button
        onClick={onToggleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className="absolute right-4 top-4 rounded-lg border border-slate-700 px-3 py-2 text-xl leading-none text-slate-200 transition active:scale-95"
      >
        {muted ? '🔇' : '🔊'}
      </button>

      <h1
        className="text-6xl font-extrabold tracking-[0.2em] sm:text-7xl"
        style={{ color: theme.accent }}
      >
        HUNTER
      </h1>

      <p className="max-w-sm text-base text-slate-300">
        Chase the school. Catch as many as you can.
      </p>

      {/* Theme selector — Ocean active, Sky locked until v2 */}
      <div className="flex items-center gap-3">
        <button
          className="rounded-lg border-2 px-5 py-2 text-sm font-semibold"
          style={{ borderColor: theme.accent, color: theme.accent }}
        >
          Ocean
        </button>
        <button
          disabled
          className="cursor-not-allowed rounded-lg border-2 border-slate-700 px-5 py-2 text-sm font-semibold text-slate-600"
        >
          Sky <span className="ml-1 text-xs opacity-70">v2</span>
        </button>
      </div>

      <div className="mt-2 flex flex-col items-center gap-3">
        <button
          onClick={onPlay}
          className="rounded-xl px-12 py-3 text-lg font-bold text-slate-900 transition active:scale-95"
          style={{ backgroundColor: theme.accent }}
        >
          Play
        </button>
        <button
          onClick={onLeaderboard}
          className="rounded-xl border border-slate-600 px-8 py-2 text-sm font-semibold text-slate-200 transition active:scale-95"
        >
          Leaderboard
        </button>
      </div>

      {personalBest !== null && (
        <p className="text-sm text-slate-400">
          Personal best: <span className="font-semibold text-slate-200">{personalBest}</span>
        </p>
      )}

      <p className="absolute bottom-6 text-xs text-slate-500">Best played in landscape</p>
    </div>
  )
}
