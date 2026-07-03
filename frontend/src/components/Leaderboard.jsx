// Leaderboard.jsx — shared leaderboard pieces used by both the End screen and the
// start-screen "Leaderboard" button:
//   - getLeaderboard / postScore  (same-origin API helpers)
//   - LeaderboardList             (ranked rows with loading/empty/error states)
//   - LeaderboardOverlay          (full standings: difficulty tabs + platform toggle)
//
// Six independent boards — three difficulties × two platforms (desktop/mobile).
// The platform toggle in the overlay is view-only; it never affects which board a
// score is submitted under (that's always the player's real device — see EndScreen).

import { useEffect, useState } from 'react'
import { theme } from '../constants/theme.js'
import { getPlatform } from '../utils/platform.js'

export const DIFFICULTY_TABS = ['easy', 'normal', 'hardcore']
export const PLATFORM_TABS = ['desktop', 'mobile']

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '')

export async function getLeaderboard(difficulty, platform) {
  const res = await fetch(`/api/leaderboard?difficulty=${difficulty}&platform=${platform}`)
  if (!res.ok) throw new Error(`GET failed (${res.status})`)
  return res.json()
}

export async function postScore(entry) {
  const res = await fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  if (!res.ok) throw new Error(`POST failed (${res.status})`)
  return res.json()
}

// Ranked list with shared loading / empty / error states. Single-board, so rows
// show only rank · name · score (the mode is stated by the header/tab).
export function LeaderboardList({ status, entries, limit }) {
  if (status === 'loading') return <p className="text-sm text-slate-400">Loading…</p>
  if (status === 'error') return <p className="text-sm text-rose-400">Couldn&apos;t load scores</p>
  if (status === 'ready' && entries.length === 0) {
    return <p className="text-sm text-slate-400">No scores yet. Be the first!</p>
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

// Full standings overlay — difficulty tabs + view-only platform toggle. Opens over
// the start screen (Leaderboard button) or the end screen (Full Leaderboard). It
// defaults to the given difficulty and the viewer's own platform, then fetches the
// selected board on every tab/toggle change. Click-outside or Close dismisses.
export function LeaderboardOverlay({ onClose, difficulty = 'normal', platform }) {
  const [activeTab, setActiveTab] = useState(difficulty)
  const [activePlatform, setActivePlatform] = useState(() => platform || getPlatform())
  const [entries, setEntries] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    getLeaderboard(activeTab, activePlatform)
      .then((d) => { if (!cancelled) { setEntries(d); setStatus('ready') } })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [activeTab, activePlatform])

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 px-8 py-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-2xl font-bold text-slate-100">Leaderboard</h3>
        {/* Difficulty tabs */}
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
        {/* Platform toggle — independent, view-only pill segmented control */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-1">
          {PLATFORM_TABS.map((p) => {
            const active = activePlatform === p
            return (
              <button
                key={p}
                onClick={() => setActivePlatform(p)}
                aria-pressed={active}
                className="rounded-md px-4 py-1 text-xs font-semibold uppercase tracking-wide transition active:scale-95"
                style={active ? { backgroundColor: theme.accent, color: '#0f172a' } : { color: '#94a3b8' }}
              >
                {cap(p)}
              </button>
            )
          })}
        </div>
        <LeaderboardList status={status} entries={entries} limit={10} />
        <button
          onClick={onClose}
          className="mt-1 rounded-lg border border-slate-600 px-6 py-2 text-sm font-semibold text-slate-200 transition active:scale-95"
        >
          Close
        </button>
      </div>
    </div>
  )
}
