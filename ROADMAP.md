# Roadmap — Hunter

Canonical scope lives in [GDD.md](GDD.md). This is the condensed view.

---

## v1 — Current (first build)

Ocean theme only. Everything below is in scope for the initial release.

- **Core loop** — start screen → 60s hunt → end screen → play again
- **Boids simulation** — separation, alignment, cohesion, flee, and edge repulsion, all running on Canvas at 60fps
- **Predator control** — mouse (desktop) / touch with offset (mobile); hard stop at world edges
- **Catch mechanic** — mouth-point vs fish hitbox, with particle burst, score pop, screen shake, and catch sound
- **World + camera** — finite bounded lake (2.5× × 2× viewport), predator-centered camera clamped to bounds
- **Minimap** — bottom-right overlay of prey + predator positions
- **Adaptive count** — 30 prey on mobile, 50 on desktop
- **Timer** — 60s countdown, red pulse under 10s
- **Scoring** — +1 per catch (no multiplier)
- **HUD** — score (top-left), timer (top-right), minimal
- **Pause** — on fullscreen exit / Android back gesture, with resume + quit
- **Fullscreen + landscape lock** — with graceful fallback for iOS Safari
- **Sound** — ambient loop, catch, and timer-end (Tone.js), with persisted mute toggle
- **Personal best** — stored in `localStorage`
- **Leaderboard** — opt-in submit on new PB; global top 10 via FastAPI + SQLite

---

## v2 — Planned

Committed direction, out of scope for v1.

- **Sky theme** — eagle predator + bird murmuration (shares v1 physics)
- **Combo multiplier** — 2× for 2 catches within 1.5s, 3× for 3, etc.
- **Option B mode** — play as a fish and survive the predator
- **Difficulty select** — start-screen option adjusting flee weight + fish speed
- **Mobile haptics** — vibration feedback on catch
- **Particle variety per theme**
- **Background parallax layers**

---

## v3 — Ideas

Worth considering, not committed.

- **Leaderboard moderation** — filtering / reporting for submitted names
- **Tournament mode** — time-boxed competitive runs
- **Embed on job-joseph.com** — surface Hunter directly in the portfolio site
