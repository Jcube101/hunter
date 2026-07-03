// settings.js — user settings: the SINGLE SOURCE OF TRUTH, read live.
//
// One module owns the glow + audio preferences. Values are cached in memory and
// mirrored to localStorage, so every consumer (settings panel, game render loop,
// audio hook, start/pause toggles) reads the SAME live value through these
// accessors rather than snapshotting it at some earlier moment. This is the fix
// for the glow bug: the render loop calls isGlowOn() every frame, so toggling the
// setting is reflected immediately and can never go stale.
//
// Both default ON: an unset key reads as true; only an explicit "false" is off.

const GLOW_KEY = 'hunter_setting_glow'
const AUDIO_KEY = 'hunter_setting_audio'

const readBool = (key) => localStorage.getItem(key) !== 'false'

let glowOn = readBool(GLOW_KEY)

// Audio defaults ON, but honor the legacy `hunter_mute` preference once: a user
// who had muted before this key existed should stay muted (migrated in).
let audioOn = readBool(AUDIO_KEY)
if (localStorage.getItem(AUDIO_KEY) === null && localStorage.getItem('hunter_mute') === 'true') {
  audioOn = false
  localStorage.setItem(AUDIO_KEY, 'false')
}

export const isGlowOn = () => glowOn
export const setGlowOn = (on) => {
  glowOn = !!on
  localStorage.setItem(GLOW_KEY, String(glowOn))
}

export const isAudioOn = () => audioOn
export const setAudioOn = (on) => {
  audioOn = !!on
  localStorage.setItem(AUDIO_KEY, String(audioOn))
}

// Keep the in-memory cache in sync if another tab changes a setting.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === GLOW_KEY) glowOn = readBool(GLOW_KEY)
    if (e.key === AUDIO_KEY) audioOn = readBool(AUDIO_KEY)
  })
}
