// EndScreen.jsx — final score, personal best, opt-in leaderboard prompt.
//
// SESSION 2 SCOPE: the leaderboard FRONTEND INTEGRATION (fetch global top 5 +
// POST submit) is deferred to Session 3 per the build plan. This component
// renders the full UI shell and exposes optional props (onSubmitScore,
// onShowLeaderboard); when those are absent the leaderboard actions render
// disabled with a hint, so Session 3 only has to pass the handlers in.

import { useState } from 'react'
import { theme } from '../constants/theme.js'

const MAX_NAME_LENGTH = 20

export default function EndScreen({
  score,
  personalBest,
  isNewPB,
  onPlayAgain,
  onSubmitScore, // (name) => Promise — wired in Session 3
  onShowLeaderboard, // () => void — wired in Session 3
}) {
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!onSubmitScore || !name.trim()) return
    await onSubmitScore(name.trim())
    setSubmitted(true)
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
      <h2 className="text-4xl font-bold text-slate-100 sm:text-5xl">
        You caught <span style={{ color: theme.accent }}>{score}</span> fish
      </h2>

      <p className="text-sm text-slate-400">
        Personal best: <span className="font-semibold text-slate-200">{personalBest}</span>
      </p>

      {isNewPB && (
        <p className="text-lg font-semibold" style={{ color: theme.accent }}>
          New personal best! 🎉
        </p>
      )}

      {isNewPB && !submitted && (
        <div className="flex flex-col items-center gap-2">
          <input
            type="text"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-56 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-center text-slate-100 outline-none focus:border-slate-400"
          />
          <button
            onClick={handleSubmit}
            disabled={!onSubmitScore || !name.trim()}
            className="rounded-lg px-6 py-2 text-sm font-bold text-slate-900 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: theme.accent }}
          >
            Add to leaderboard
          </button>
          {!onSubmitScore && (
            <span className="text-xs text-slate-500">Leaderboard opens in the next update</span>
          )}
        </div>
      )}

      {submitted && <p className="text-sm font-semibold text-emerald-400">Added!</p>}

      <div className="mt-2 flex flex-col items-center gap-3">
        <button
          onClick={onPlayAgain}
          className="rounded-xl px-12 py-3 text-lg font-bold text-slate-900 transition active:scale-95"
          style={{ backgroundColor: theme.accent }}
        >
          Play Again
        </button>
        <button
          onClick={onShowLeaderboard}
          disabled={!onShowLeaderboard}
          className="rounded-xl border border-slate-600 px-8 py-2 text-sm font-semibold text-slate-200 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Full Leaderboard
        </button>
      </div>
    </div>
  )
}
