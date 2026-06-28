// EndScreen.jsx — final score, personal best, and per-difficulty leaderboards.
//
// There are three independent leaderboards (one per difficulty) — Easy/Normal/
// Hardcore scores are never compared. The top-5 preview shows the difficulty the
// player just played; the full overlay has three tabs and defaults to that mode.
// The API is same-origin (/api/leaderboard?difficulty=…) — direct in production,
// via the Vite proxy in dev.

import { useCallback, useEffect, useState } from 'react'
import { theme, ACTIVE_THEME } from '../constants/theme.js'

const MAX_NAME_LENGTH = 20
const TOP_PREVIEW = 5
const DIFFICULTY_TABS = ['easy', 'normal', 'hardcore']

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '')

async function getLeaderboard(difficulty) {
  const res = await fetch(`/api/leaderboard?difficulty=${difficulty}`)
  if (!res.ok) throw new Error(`GET failed (${res.status})`)
  return res.json()
}

async function postScore(entry) {
  const res = await fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  if (!res.ok) throw new Error(`POST failed (${res.status})`)
  return res.json()
}

// Ranked list with shared loading / empty / error states. Single-difficulty, so
// rows show only rank · name · score (the mode is stated by the header/tab).
function LeaderboardList({ status, entries, limit }) {
  if (status === 'loading') return <p className="text-sm text-slate-400">Loading…</p>
  if (status === 'error') return <p className="text-sm text-rose-400">Couldn&apos;t load scores</p>
  if (status === 'ready' && entries.length === 0) {
    return <p className="text-sm text-slate-400">No scores yet — be the first!</p>
  }
  return (
    <ol className="flex w-64 flex-col gap-1">
      {entries.slice(0, limit).map((e, i) => (
        <li
          key={e.id ?? `${e.name}-${i}`}
          className="flex items-center justify-between rounded-md bg-slate-800/50 px-3 py-1.5 text-sm"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="w-5 text-right font-mono text-slate-500">{i + 1}</span>
            <span className="truncate text-slate-100">{e.name}</span>
          </span>
          <span className="font-semibold tabular-nums" style={{ color: theme.accent }}>
            {e.score}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default function EndScreen({ score, personalBest, isNewPB, difficulty, onPlayAgain }) {
  // Top-5 preview — always the difficulty just played.
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [entries, setEntries] = useState([])
  const [name, setName] = useState('')
  const [submitState, setSubmitState] = useState('idle') // idle | posting | done | error
  const [showFull, setShowFull] = useState(false)

  // Full overlay — tabbed across all three difficulties; defaults to played mode.
  const [activeTab, setActiveTab] = useState(difficulty)
  const [tabEntries, setTabEntries] = useState([])
  const [tabStatus, setTabStatus] = useState('loading')

  const loadPreview = useCallback(async () => {
    setStatus('loading')
    try {
      setEntries(await getLeaderboard(difficulty))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [difficulty])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  // Fetch the active tab's standings whenever it changes.
  useEffect(() => {
    let cancelled = false
    setTabStatus('loading')
    getLeaderboard(activeTab)
      .then((d) => { if (!cancelled) { setTabEntries(d); setTabStatus('ready') } })
      .catch(() => { if (!cancelled) setTabStatus('error') })
    return () => { cancelled = true }
  }, [activeTab])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSubmitState('posting')
    try {
      await postScore({ name: trimmed, score, theme: ACTIVE_THEME, difficulty })
      setSubmitState('done')
      loadPreview() // refresh so the player sees their entry
      if (activeTab === difficulty) {
        getLeaderboard(difficulty).then(setTabEntries).catch(() => {})
      }
    } catch {
      setSubmitState('error')
    }
  }

  const openFull = () => {
    setActiveTab(difficulty) // always default to the mode just played
    setShowFull(true)
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
      <h2 className="text-4xl font-bold text-slate-100 sm:text-5xl">
        You caught <span style={{ color: theme.accent }}>{score}</span> fish
      </h2>
      {difficulty && (
        <p className="-mt-3 text-sm font-medium uppercase tracking-wider text-slate-500">
          {cap(difficulty)} mode
        </p>
      )}

      <p className="text-sm text-slate-400">
        Personal best: <span className="font-semibold text-slate-200">{personalBest}</span>
      </p>

      {isNewPB && (
        <p className="text-lg font-semibold" style={{ color: theme.accent }}>
          New personal best! 🎉
        </p>
      )}

      {/* Opt-in submit — only on a new personal best */}
      {isNewPB && submitState !== 'done' && (
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
            disabled={submitState === 'posting' || !name.trim()}
            className="rounded-lg px-6 py-2 text-sm font-bold text-slate-900 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: theme.accent }}
          >
            {submitState === 'posting' ? 'Adding…' : 'Add to leaderboard'}
          </button>
          {submitState === 'error' && (
            <span className="text-xs text-rose-400">Something went wrong — try again</span>
          )}
        </div>
      )}
      {submitState === 'done' && (
        <p className="text-sm font-semibold text-emerald-400">Added to leaderboard! 🎉</p>
      )}

      {/* Top-5 preview for the difficulty just played */}
      <div className="mt-1 flex flex-col items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-slate-500">
          Top scores — {cap(difficulty)} mode
        </span>
        <LeaderboardList status={status} entries={entries} limit={TOP_PREVIEW} />
      </div>

      <div className="mt-1 flex flex-col items-center gap-3">
        <button
          onClick={onPlayAgain}
          className="rounded-xl px-12 py-3 text-lg font-bold text-slate-900 transition active:scale-95"
          style={{ backgroundColor: theme.accent }}
        >
          Play Again
        </button>
        <button
          onClick={openFull}
          className="rounded-xl border border-slate-600 px-8 py-2 text-sm font-semibold text-slate-200 transition active:scale-95"
        >
          Full Leaderboard
        </button>
      </div>

      {/* Full standings modal — three difficulty tabs */}
      {showFull && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setShowFull(false)}
        >
          <div
            className="flex flex-col items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 px-8 py-7"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold text-slate-100">Leaderboard</h3>
            <div className="flex items-center gap-2">
              {DIFFICULTY_TABS.map((tab) => {
                const active = activeTab === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    aria-pressed={active}
                    className="rounded-lg px-4 py-1.5 text-sm font-semibold transition active:scale-95"
                    style={active ? { color: theme.accent } : { color: '#64748b' }}
                  >
                    {cap(tab)}
                  </button>
                )
              })}
            </div>
            <LeaderboardList status={tabStatus} entries={tabEntries} limit={10} />
            <button
              onClick={() => setShowFull(false)}
              className="mt-1 rounded-lg border border-slate-600 px-6 py-2 text-sm font-semibold text-slate-200 transition active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
