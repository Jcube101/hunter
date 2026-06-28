// theme.js — visual theme palettes for Hunter.
//
// Two themes share identical physics (see GDD.md "Themes"). Only colors,
// sprites, and particles differ. v1 ships Ocean only; Sky is v2.
//
// Structure: each theme is a self-contained palette object keyed by name in
// THEMES. Adding the Sky theme in v2 means adding one entry here and flipping
// ACTIVE_THEME — no consumer needs to change shape. Read colors via `theme`.

export const THEMES = {
  ocean: {
    name: 'Ocean',
    locked: false,
    // Solid dark navy world fill (GDD: #0a1628)
    background: '#0a1628',
    // Silver/white chevron fish
    fish: {
      fill: '#e8eef2',
      stroke: '#9fb2c0',
    },
    // Grey shark — triangle body + fin
    shark: {
      body: '#c0c0c0', // light grey body
      underside: '#a0a0a0', // slightly darker belly
      fin: '#c0c0c0', // dorsal + tail fins, same grey as body
      eye: '#15181c', // near-black eye
      outline: '#8a8a8a', // subtle edge definition
    },
    // Bubble burst on catch
    particle: {
      color: '#bfe9ff',
    },
    // Accent used for the predator dot on the minimap + UI highlights
    accent: '#4fd1e0',
    hud: {
      text: '#f2f6f8',
      timerLow: '#ff4d4d',
    },
    minimap: {
      background: 'rgba(8, 18, 33, 0.65)',
      border: 'rgba(255, 255, 255, 0.15)',
      fish: '#ffffff',
      predator: '#4fd1e0',
    },
  },

  // sky: { ... }  // v2 — eagle + murmuration, dusk gradient. Not shipped in v1.
}

// The theme active in v1. Sky select is locked until v2.
export const ACTIVE_THEME = 'ocean'

// Convenience: the resolved active palette. Most consumers import this directly.
export const theme = THEMES[ACTIVE_THEME]
