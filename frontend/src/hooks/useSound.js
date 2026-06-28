// useSound.js — Tone.js audio management.
//
// DEFERRED TO SESSION 3. This stub exists so the file is present per SPEC.md's
// repository layout. It returns no-op handlers so callers can wire sound later
// without code changes. No audio is initialised in the v1 build.

export function useSound() {
  return {
    muted: false,
    toggleMute: () => {},
    playCatch: () => {},
    startAmbient: () => {},
    stopAmbient: () => {},
    playTimerEnd: () => {},
  }
}
