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

import { useCallback, useEffect, useRef, useState } from 'react'
import { theme, ACTIVE_THEME } from '../constants/theme.js'
import { getPlatform } from '../utils/platform.js'
import { useCompactViewport } from '../hooks/useCompactViewport.js'
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
const COMPACT_TOP_PREVIEW = 3 // ROADMAP.md B1 — cut rows so compact mode fits at 393px
const BOARD_SIZE = 10 // top-N kept per board (matches backend LIMIT)

export default function EndScreen({ score, personalBest, isNewPB, difficulty, onPlayAgain, onMenu }) {
  // Compact layout for constrained heights (landscape phones) — see B1/B6/O25
  // below. Full content (heading + mode + PB + new-PB + name input + 5-row
  // preview + actions) can exceed 580 CSS px against a ~393px landscape
  // viewport; compact mode brings the worst realistic case (a qualifying,
  // new-PB round) under that without needing to scroll. The scroll container
  // on the root (below) stays as a fallback for anything not accounted for
  // here, not as the primary fit strategy.
  const isCompact = useCompactViewport()
  const topPreviewLimit = isCompact ? COMPACT_TOP_PREVIEW : TOP_PREVIEW

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
  // Guards against a stale in-flight request clobbering a newer one (Session
  // 22 Bug 2). A round ending offline starts a fetch that can stay pending
  // for a long time before it actually rejects (real network timeouts, not
  // an instant failure). If the player reconnects before that rejection
  // arrives, loadPreview() is called again and can succeed FIRST — but the
  // original, now-stale request's rejection still lands afterward and (with
  // nothing guarding it) would flip status back to 'error' right after it
  // was correctly set to 'ready', which read as "Couldn't load scores"
  // persisting despite a healthy reconnect. Each call captures a fresh id;
  // a request only applies its result if it's still the most recent one.
  const previewRequestIdRef = useRef(0)

  const loadPreview = useCallback(async () => {
    const requestId = ++previewRequestIdRef.current
    setStatus('loading')
    try {
      const data = await getLeaderboard(difficulty, myPlatform)
      if (previewRequestIdRef.current !== requestId) return // superseded — ignore
      setEntries(data)
      setStatus('ready')
    } catch {
      if (previewRequestIdRef.current !== requestId) return // superseded — ignore
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
    // Root is a scroll container, not the flex/centering element itself (B6):
    // the inner div below centers via min-h-full when content fits, and the
    // page scrolls when it doesn't, rather than silently clipping. Compact
    // mode (below) is what keeps this from actually being needed at 393px in
    // the realistic worst case — this is the fallback net, not the fit
    // strategy. overscroll-contain stops a drag here from reaching the
    // pull-to-refresh gesture behind it.
    <div className="absolute inset-0 overflow-y-auto overscroll-contain">
      <div
        className={`flex min-h-full flex-col items-center justify-center px-6 text-center ${
          isCompact ? 'gap-2 py-4' : 'gap-5'
        }`}
      >
        <h2
          className={`font-bold text-slate-100 ${isCompact ? 'text-2xl' : 'text-4xl sm:text-5xl'}`}
        >
          You caught <span style={{ color: theme.accent }}>{score}</span>
        </h2>
        {difficulty && (
          <p
            className={`font-medium uppercase tracking-wider text-slate-500 ${
              isCompact ? 'text-xs' : '-mt-3 text-sm'
            }`}
          >
            {cap(difficulty)} mode
          </p>
        )}

        <p className={isCompact ? 'text-xs text-slate-400' : 'text-sm text-slate-400'}>
          Personal best: <span className="font-semibold text-slate-200">{personalBest}</span>
        </p>

        {isNewPB && (
          <p
            className={`font-semibold ${isCompact ? 'text-sm' : 'text-lg'}`}
            style={{ color: theme.accent }}
          >
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

        {/* Opt-in submit — shown when the score qualifies for the top 10.
            Compact: input and button sit side by side instead of stacked,
            since 851px of width is not the constraint here, 393px of height
            is (B1) — that alone cuts this block's footprint roughly in half. */}
        {canSubmit && submitState !== 'done' && (
          <div className="flex flex-col items-center gap-2">
            <div className={`flex items-center gap-2 ${isCompact ? 'flex-row' : 'flex-col'}`}>
              <input
                type="text"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className={`rounded-lg border border-slate-600 bg-slate-900 text-center text-slate-100 outline-none focus:border-slate-400 ${
                  isCompact ? 'w-36 py-1.5' : 'w-56 py-2'
                }`}
              />
              <button
                onClick={handleSubmit}
                disabled={submitState === 'posting' || !name.trim()}
                className={`rounded-lg px-6 text-sm font-bold text-slate-900 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                  isCompact ? 'py-1.5' : 'py-2'
                }`}
                style={{ backgroundColor: theme.accent }}
              >
                {submitState === 'posting' ? 'Adding…' : 'Add to leaderboard'}
              </button>
            </div>
            {submitState === 'error' && (
              <span className="text-xs text-rose-400">Something went wrong. Try again</span>
            )}
          </div>
        )}
        {submitState === 'done' && (
          <p className="text-sm font-semibold text-emerald-400">Added to leaderboard! 🎉</p>
        )}

        {/* Top preview for the difficulty just played, on the player's platform.
            5 rows normally; 3 in compact (B1) — rows are single-line
            (LeaderboardList truncates names), so this is the one place row
            count actually controls the section's height. */}
        <div className={`flex flex-col items-center gap-2 ${isCompact ? 'mt-0' : 'mt-1'}`}>
          <span className="text-xs uppercase tracking-widest text-slate-500">
            Top scores: {cap(difficulty)} · {cap(myPlatform)}
          </span>
          <LeaderboardList status={status} entries={entries} limit={topPreviewLimit} />
        </div>

        {/* Play Again stays the primary action; Menu is a secondary sibling that
            returns to the start screen (same transition as Pause → Quit, so
            attract mode resumes via App's mount logic). Compact: all three
            actions share one row instead of two (B1's "one row" suggestion) —
            851px of width comfortably fits three buttons. */}
        <div className={`flex flex-col items-center ${isCompact ? 'mt-0 gap-2' : 'mt-1 gap-3'}`}>
          {isCompact ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onPlayAgain}
                className="rounded-xl px-6 py-2 text-base font-bold text-slate-900 transition active:scale-95"
                style={{ backgroundColor: theme.accent }}
              >
                Play Again
              </button>
              <button
                onClick={onMenu}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition active:scale-95"
              >
                Menu
              </button>
              <button
                onClick={() => setShowFull(true)}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition active:scale-95"
              >
                Full Leaderboard
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        {showFull && (
          <LeaderboardOverlay
            difficulty={difficulty}
            platform={myPlatform}
            onClose={() => setShowFull(false)}
          />
        )}
      </div>
    </div>
  )
}
