// PauseScreen.jsx — semi-transparent overlay shown on fullscreen exit / back
// gesture. UI only. Timer is frozen by the loop being stopped (see App.jsx).

import { theme } from '../constants/theme.js'
import { useCompactViewport } from '../hooks/useCompactViewport.js'

// Fits comfortably under a 393px landscape-phone viewport even before any
// compact adjustment (ROADMAP.md B12: computed ~172px, well inside budget) —
// there was no clipping bug here to fix. The hook and a light version of the
// same compact reductions (smaller heading, tighter gaps) are wired in for
// consistency with the other four screens, not because this one needed
// rescuing. Same story for the scroll-fallback wrapper (B6 pattern): a
// safety net, not load-bearing today.
export default function PauseScreen({ onResume, onQuit, audioOn, onToggleAudio }) {
  const isCompact = useCompactViewport()
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain bg-slate-950/70 backdrop-blur-sm">
      <div
        className={`flex min-h-full flex-col items-center justify-center ${
          isCompact ? 'gap-3 py-4' : 'gap-8'
        }`}
      >
        {/* Audio toggle — mute mid-game without quitting. Same shared state as
            the start-screen and settings toggles. Offset past the safe-area
            inset (B3), matching the same corner control on every other
            screen. */}
        <button
          onClick={onToggleAudio}
          aria-label={audioOn ? 'Turn sound off' : 'Turn sound on'}
          aria-pressed={audioOn}
          className="absolute [right:calc(1rem_+_var(--safe-right))] [top:calc(1rem_+_var(--safe-top))] rounded-lg border border-slate-700 px-3 py-2 text-xl leading-none text-slate-200 transition active:scale-95"
        >
          {audioOn ? '🔊' : '🔇'}
        </button>

        <h2
          className={`font-bold tracking-[0.3em] text-slate-100 ${isCompact ? 'text-2xl' : 'text-4xl'}`}
        >
          PAUSED
        </h2>
        <div className={`flex flex-col items-center ${isCompact ? 'gap-1.5' : 'gap-3'}`}>
          <button
            onClick={onResume}
            className={`rounded-xl font-bold text-slate-900 transition active:scale-95 ${
              isCompact ? 'px-8 py-2 text-base' : 'px-10 py-3 text-lg'
            }`}
            style={{ backgroundColor: theme.accent }}
          >
            Resume
          </button>
          <button
            onClick={onQuit}
            className={`rounded-xl border border-slate-600 font-semibold text-slate-200 transition active:scale-95 ${
              isCompact ? 'px-6 py-1.5 text-sm' : 'px-8 py-2 text-sm'
            }`}
          >
            Quit
          </button>
        </div>
      </div>
    </div>
  )
}
