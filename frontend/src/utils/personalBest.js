// personalBest.js — pure comparison extracted from App.jsx's endGame closure
// (Session 18) so it can be unit tested directly. localStorage read/write and
// the per-difficulty key construction stay in App.jsx — this is just the
// "is this score a new best?" decision.

export function isNewPersonalBest(score, currentPB) {
  return score > currentPB
}
