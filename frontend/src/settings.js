// settings.js — user settings: the SINGLE SOURCE OF TRUTH, read live.
//
// Owns the audio preference. Cached in memory and mirrored to localStorage, so
// every consumer (settings panel, audio hook, start/pause toggles) reads the SAME
// live value through these accessors rather than snapshotting it.
//
// (Session 15 removed the glow toggle — glow on fleeing fish is now permanent and
// applied unconditionally by the renderer, so it has no setting here.)
//
// Audio defaults ON: an unset key reads as true; only an explicit "false" is off.

const AUDIO_KEY = 'hunter_setting_audio'

const readBool = (key) => localStorage.getItem(key) !== 'false'

// Audio defaults ON, but honor the legacy `hunter_mute` preference once: a user
// who had muted before this key existed should stay muted (migrated in).
let audioOn = readBool(AUDIO_KEY)
if (localStorage.getItem(AUDIO_KEY) === null && localStorage.getItem('hunter_mute') === 'true') {
  audioOn = false
  localStorage.setItem(AUDIO_KEY, 'false')
}

export const isAudioOn = () => audioOn
export const setAudioOn = (on) => {
  audioOn = !!on
  localStorage.setItem(AUDIO_KEY, String(audioOn))
}

// Keep the in-memory cache in sync if another tab changes the setting.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === AUDIO_KEY) audioOn = readBool(AUDIO_KEY)
  })
}
