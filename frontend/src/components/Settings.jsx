// Settings.jsx — full-screen settings overlay. UI only, no game logic.
//
// One toggle (audio), default ON. It lives in the single source of truth
// (src/settings.js) and is read live by the audio hook — this panel just reads
// the current value and writes changes back through the shared accessor.
// (The glow toggle was removed in Session 15; glow is now permanent.)

import { theme } from '../constants/theme.js'
import { useCompactViewport } from '../hooks/useCompactViewport.js'

// Clean on/off switch — teal when on, grey when off; label left, switch right.
function Toggle({ label, description, on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className="flex w-72 items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3 text-left transition active:scale-[0.98]"
    >
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-slate-100">{label}</span>
        <span className="text-xs text-slate-400">{description}</span>
      </span>
      <span
        className="relative h-6 w-11 shrink-0 rounded-full transition"
        style={{ backgroundColor: on ? theme.accent : '#475569' }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: on ? '22px' : '2px' }}
        />
      </span>
    </button>
  )
}

// Both current screens (Settings, PauseScreen) fit comfortably under a 393px
// landscape-phone viewport even before any compact adjustment (ROADMAP.md
// B12: computed ~224px for Settings, well inside budget) — unlike EndScreen/
// Tutorial/LeaderboardOverlay, there was no clipping bug here to fix. The
// hook and a light version of the same compact reductions (smaller heading,
// tighter gaps) are still wired in for consistency with the other four
// screens and as headroom against future content, not because this screen
// needed rescuing. The scroll-fallback wrapper (overflow-y-auto on the root,
// min-h-full centering on the inner div — same pattern as EndScreen/
// Tutorial/LeaderboardOverlay, B6) is the same story: a safety net that
// isn't load-bearing today.
export function Settings({ onClose, audioOn, onToggleAudio }) {
  const isCompact = useCompactViewport()
  return (
    <div
      className="absolute inset-0 z-10 overflow-y-auto overscroll-contain"
      style={{ background: theme.background }}
    >
      <div
        className={`flex min-h-full flex-col items-center justify-center px-6 text-center ${
          isCompact ? 'gap-3 py-4' : 'gap-6'
        }`}
      >
        {/* Close — top-right, offset past the safe-area inset (B3) */}
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="absolute [right:calc(1rem_+_var(--safe-right))] [top:calc(1rem_+_var(--safe-top))] rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-300 transition active:scale-95"
        >
          ✕
        </button>

        <h1
          className={`font-extrabold tracking-[0.2em] ${isCompact ? 'text-2xl' : 'text-4xl'}`}
          style={{ color: theme.accent }}
        >
          SETTINGS
        </h1>

        <div className={`flex flex-col items-center ${isCompact ? 'gap-1.5' : 'gap-3'}`}>
          <span className="text-xs uppercase tracking-widest text-slate-500">Audio</span>
          <Toggle
            label="Sound"
            description="Ambient loop and effects"
            on={audioOn}
            onChange={onToggleAudio}
          />
        </div>

        <button
          onClick={onClose}
          className={`rounded-xl border border-slate-600 px-10 text-sm font-semibold text-slate-200 transition active:scale-95 ${
            isCompact ? 'py-1.5' : 'mt-2 py-2.5'
          }`}
        >
          Back
        </button>
      </div>
    </div>
  )
}
