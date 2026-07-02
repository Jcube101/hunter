// platform.js — single source of truth for device/platform detection.
//
// Uses the same touch check the rotation toast already relied on
// (navigator.maxTouchPoints > 0). Reused by RotationToast and the leaderboard so
// there is exactly one detection method: a touch device counts as 'mobile',
// everything else as 'desktop'. Platform is baked into a leaderboard submission
// from the player's real device — never from whatever board they're viewing.

export const isTouchDevice = () => navigator.maxTouchPoints > 0

export const getPlatform = () => (isTouchDevice() ? 'mobile' : 'desktop')
