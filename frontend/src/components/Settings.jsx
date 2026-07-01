// Settings.jsx — full-screen settings overlay. UI only, no game logic.
//
// One visual-assist toggle (glow on fleeing fish), default off and persisted in
// localStorage. App reads the key at game start; changing it takes effect on the
// next game.

import { useState } from 'react'
import { theme } from '../constants/theme.js'

const GLOW_KEY = 'hunter_setting_glow'

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

export function Settings({ onClose }) {
  const [glow, setGlow] = useState(() => localStorage.getItem(GLOW_KEY) === 'true')

  const toggle = (key, value, setter) => {
    setter(value)
    localStorage.setItem(key, String(value))
  }

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: theme.background }}
    >
      {/* Close — top-right */}
      <button
        onClick={onClose}
        aria-label="Close settings"
        className="absolute right-4 top-4 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-300 transition active:scale-95"
      >
        ✕
      </button>

      <h1 className="text-4xl font-extrabold tracking-[0.2em]" style={{ color: theme.accent }}>
        SETTINGS
      </h1>

      <div className="flex flex-col items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-slate-500">Visual Assists</span>
        <Toggle
          label="Glow on fleeing fish"
          description="Highlights fish within range"
          on={glow}
          onChange={(v) => toggle(GLOW_KEY, v, setGlow)}
        />
        <p className="mt-1 max-w-xs text-xs text-slate-500">
          These assist with visibility. Disabled by default.
        </p>
      </div>

      <button
        onClick={onClose}
        className="mt-2 rounded-xl border border-slate-600 px-10 py-2.5 text-sm font-semibold text-slate-200 transition active:scale-95"
      >
        Back
      </button>
    </div>
  )
}
