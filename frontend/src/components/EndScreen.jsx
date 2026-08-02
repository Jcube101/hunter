// EndScreen.jsx — final score, personal best, and per-difficulty leaderboards.
//
// The top-5 preview shows the difficulty the player just played on their OWN
// platform (auto-detected). "Full Leaderboard" opens the shared LeaderboardOverlay
// (difficulty tabs + platform toggle). API is same-origin.
//
// Submit trigger (Session 16): the "add to leaderboard" prompt appears when the
// score would QUALIFY for the top 10 of the player's difficulty+platform board —
// i.e. that board has fewer than 10 entries, or the score is >= the 10th-place
// score (ties qualify; the backend resolves final ordering). This is independent
// of personal best: PB is still tracked (localStorage) and still drives the "new
// personal best!" flourish, but it no longer gates the submit prompt.
//
// Offline vs. fetch-failed (Session 21 — ROADMAP.md A6): these are now
// distinguished via navigator.onLine. Offline is a DEAD END for submission,
// not a fallback case — qualifies() needs a live board to compare against, so
// offline we genuinely cannot know whether a score would rank. Queuing it
// would mean either prompting for a name on every offline round (most of
// which would never actually qualify) or deferring the qualification check to
// flush time (submitting something the player was never shown as qualifying)
// — both worse than telling the player plainly that submission isn't
// available right now. Online-but-failed keeps the pre-existing
// personal-best fallback: that's a transient server hiccup, not a state where
// submission is fundamentally impossible.

import { useCallback, useEffect, useState } from 'react'
import { theme, ACTIVE_THEME } from '../constants/theme.js'
import { getPlatform } from '../utils/platform.js'
import {
  getLeaderboard,
  postScore,
  cap,
  qualifies as qualifiesForBoard,
  LeaderboardList,
  LeaderboardOverlay,
} from './Leaderboard.jsx'

const MAX_NAME_LENGTH = 20
const TOP_PREVIEW = 5
const BOARD_SIZE = 10 // top-N kept per board (matches backend LIMIT)

export default function EndScreen({ score, personalBest, isNewPB, difficulty, onPlayAgain, onMenu }) {
  // The player's real platform — used for submit AND as the default board to view.
  const [myPlatform] = useState(getPlatform)

  // Preview + qualification source: the full top-10 for the played difficulty on
  // the player's own platform (LeaderboardList just displays the first few).
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [entries, setEntries] = useState([])
  const [name, setName] = useState('')
  const [submitState, setSubmitState] = useState('idle') // idle | posting | done | error
  const [showFull, setShowFull] = useState(false)
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine)

  const loadPreview = useCallback(async () => {
    setStatus('loading')
    try {
      setEntries(await getLeaderboard(difficulty, myPlatform))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [difficulty, myPlatform])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  // Track connectivity live — a round can end offline and reconnect while
  // this screen is still showing (or vice versa). On reconnect, retry the
  // preview fetch so a board that failed while offline can recover without
  // requiring another round.
  useEffect(() => {
    const goOnline = () => {
      setIsOffline(false)
      loadPreview()
    }
    const goOffline = () => setIsOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [loadPreview])

  // Qualifies for the top 10: room on the board, or score >= the last (10th) score.
  const qualifies = status === 'ready' ? qualifiesForBoard(entries, score, BOARD_SIZE) : false
  // Offline blocks submission outright, regardless of status or isNewPB — see
  // the file header note. Online-but-failed keeps the personal-best fallback.
  const canSubmit = isOffline
    ? false
    : status === 'ready'
      ? qualifies
      : status === 'error'
        ? isNewPB
        : false

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSubmitState('posting')
    try {
      // platform is always the player's real device, never a viewed board.
      await postScore({ name: trimmed, score, theme: ACTIVE_THEME, difficulty, platform: myPlatform })
      setSubmitState('done')
      loadPreview() // refresh so the player sees their entry
    } catch {
      setSubmitState('error')
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
      <h2 className="text-4xl font-bold text-slate-100 sm:text-5xl">
        You caught <span style={{ color: theme.accent }}>{score}</span>
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

      {/* Offline: submission is a dead end, not a fallback case (see file
          header note) — a clear message instead of a doomed name input/POST. */}
      {isOffline && (
        <p className="text-sm text-slate-400">
          You&apos;re offline — scores can&apos;t be submitted right now.
        </p>
      )}

      {/* Opt-in submit — shown when the score qualifies for the top 10 */}
      {canSubmit && submitState !== 'done' && (
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
            <span className="text-xs text-rose-400">Something went wrong. Try again</span>
          )}
        </div>
      )}
      {submitState === 'done' && (
        <p className="text-sm font-semibold text-emerald-400">Added to leaderboard! 🎉</p>
      )}

      {/* Top-5 preview for the difficulty just played, on the player's platform */}
      <div className="mt-1 flex flex-col items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-slate-500">
          Top scores: {cap(difficulty)} · {cap(myPlatform)}
        </span>
        <LeaderboardList status={status} entries={entries} limit={TOP_PREVIEW} />
      </div>

      <div className="mt-1 flex flex-col items-center gap-3">
        {/* Play Again stays the primary action; Menu is a secondary sibling that
            returns to the start screen (same transition as Pause → Quit, so
            attract mode resumes via App's mount logic). */}
        <div className="flex items-center gap-3">
          <button
            onClick={onPlayAgain}
            className="rounded-xl px-12 py-3 text-lg font-bold text-slate-900 transition active:scale-95"
            style={{ backgroundColor: theme.accent }}
          >
            Play Again
          </button>
          <button
            onClick={onMenu}
            className="rounded-xl border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-300 transition active:scale-95"
          >
            Menu
          </button>
        </div>
        <button
          onClick={() => setShowFull(true)}
          className="rounded-xl border border-slate-600 px-8 py-2 text-sm font-semibold text-slate-200 transition active:scale-95"
        >
          Full Leaderboard
        </button>
      </div>

      {showFull && (
        <LeaderboardOverlay
          difficulty={difficulty}
          platform={myPlatform}
          onClose={() => setShowFull(false)}
        />
      )}
    </div>
  )
}
