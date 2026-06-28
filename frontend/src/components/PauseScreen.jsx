// PauseScreen.jsx — semi-transparent overlay shown on fullscreen exit / back
// gesture. UI only. Timer is frozen by the loop being stopped (see App.jsx).

import { theme } from '../constants/theme.js'

export default function PauseScreen({ onResume, onQuit }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-slate-950/70 backdrop-blur-sm">
      <h2 className="text-4xl font-bold tracking-[0.3em] text-slate-100">PAUSED</h2>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onResume}
          className="rounded-xl px-10 py-3 text-lg font-bold text-slate-900 transition active:scale-95"
          style={{ backgroundColor: theme.accent }}
        >
          Resume
        </button>
        <button
          onClick={onQuit}
          className="rounded-xl border border-slate-600 px-8 py-2 text-sm font-semibold text-slate-200 transition active:scale-95"
        >
          Quit
        </button>
      </div>
    </div>
  )
}
