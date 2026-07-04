// time.js — shared time-formatting helpers. Extracted from HUD.jsx (Session
// 18) so it can be unit tested directly; behavior unchanged.

export function formatTime(seconds) {
  const t = Math.max(0, Math.ceil(seconds))
  const mm = Math.floor(t / 60)
  const ss = String(t % 60).padStart(2, '0')
  return `${mm}:${ss}`
}
