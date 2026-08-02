# Roadmap — Hunter

Canonical scope lives in [GDD.md](GDD.md). This is the condensed view.

---

## v1 — Shipped (June 2026)

Ocean theme only. Live at [hunter.job-joseph.com](https://hunter.job-joseph.com).

- ✅ **Core loop** — start screen → 60s hunt → end screen → play again
- ✅ **Boids simulation** — separation, alignment, cohesion, flee, and edge repulsion, all running on Canvas at 60fps
- ✅ **Predator control** — mouse (desktop) / drag-to-steer touch with offset (mobile); hard stop at world edges
- ✅ **Catch mechanic** — mouth-point vs fish hitbox, with particle burst, score pop, screen shake, and catch sound
- ✅ **World + camera** — finite bounded lake (viewport-scaled), predator-centered camera clamped to bounds
- ✅ **Minimap** — bottom-right overlay of prey + predator positions
- ✅ **Adaptive count** — 30 prey on mobile, 50 on desktop
- ✅ **Timer** — 60s countdown, red pulse under 10s
- ✅ **Scoring** — +1 per catch (no multiplier)
- ✅ **HUD** — score (top-left), timer (top-right), minimal
- ✅ **Pause** — on fullscreen exit / Android back gesture, with resume + quit
- ✅ **Fullscreen + landscape lock** — with graceful fallback for iOS Safari
- ✅ **Sound** — ambient loop, catch, and timer-end (Tone.js), with persisted mute toggle
- ✅ **Personal best** — stored in `localStorage`
- ✅ **Leaderboard** — opt-in submit on new PB; global top 10 via FastAPI + SQLite
- ✅ **Difficulty modes** — Easy / Normal / Hardcore (shark speed 4.0 / 3.8 / 3.6)

---

## v2 — Planned

Committed direction, out of scope for v1.

- **Sky theme** — eagle predator + bird murmuration (shares v1 physics)
- **Combo multiplier** — 2× for 2 catches within 1.5s, 3× for 3, etc.
- **Option B mode** — play as a fish and survive the predator
- **Screensaver / attract mode** — autonomous shark patrol as animated start screen background. Shark wanders by itself, fish flee naturally. "Tap to play" overlay on top. Shows the Boids algorithm in pure form before the player takes control.
- **Mobile haptics** — vibration feedback on catch
- **Particle variety per theme**
- **Background parallax layers**
- **Meta-progression coins system** — earn coins per catch, spend to unlock flee radius circle (50 coins) and glow on fleeing fish (100 coins)
- **Fleeing fish color options in settings** — teal default, pink, gold, red

---

## v3 — Ideas

Worth considering, not committed.

- **Leaderboard moderation** — filtering / reporting for submitted names
- **Tournament mode** — time-boxed competitive runs
- **Embed on job-joseph.com** — surface Hunter directly in the portfolio site

---

# Session 19 — Mobile Optimization Audit

Report-only audit of the frontend for phone play, targeting a Samsung Galaxy
S23 FE (Android / Chrome). Nothing in this section is implemented. Landscape is
the primary orientation (the game locks to it on play), so the working
assumption throughout is a **short viewport: ~851 × 393 CSS px at DPR ≈ 2.75**.

Every item is tagged:

- **[code]** — confirmed by reading the source; the cause is in the code as written.
- **[device]** — hypothesis that needs verification on the real S23 FE before acting.

---

## Finding 0 — Hunter is not actually a PWA (read this first)

**[code]** There is no web app manifest and no service worker anywhere in the
repo or in the deployed build:

- `frontend/index.html` has icons and `viewport-fit=cover`, but **no
  `<link rel="manifest">`**.
- `frontend/public/` contains only `favicon.ico`, `icon-192.png`,
  `icon-512.png`, and `audio/` — no `manifest.json`, no `sw.js`.
- No service worker registration exists in `main.jsx` or `App.jsx`.
- `SPEC.md:115` states this explicitly: *"No PWA plugin. Hunter is not a PWA…
  No service worker, no manifest, no install prompt."*
- Live verification: `https://hunter.job-joseph.com/manifest.json` → **404**,
  `/sw.js` → **404**.

What is almost certainly installed on the phone is Chrome's generic **"Add to
Home screen" shortcut**, which any HTTPS page can produce. It gets an icon and
a home-screen entry, but with no manifest it opens as a normal Chrome tab (with
the URL bar), not in `standalone` display mode, and there is no offline shell —
"working offline" would be ordinary HTTP cache, which expires. **[device]**
Worth confirming on the phone: does the launched app show the Chrome URL bar
and does it still load with the Pi's service stopped?

This matters for the rest of the audit because **several bugs below are caused
or worsened by the browser URL bar being present** — which is exactly what a
real manifest would remove. The branch name (`pwa`) is apt: adding a real
manifest is both the PWA fix and a partial layout fix.

**Proposed fix (deferred to your review):** add
`frontend/public/manifest.json` with `display: "standalone"` (or
`display_override: ["fullscreen", "standalone"]`), `orientation: "landscape"`,
`background_color`/`theme_color: "#0a1628"`, `start_url: "/"`, and a maskable
512px icon; link it from `index.html`. Optionally a minimal service worker for
the app shell. This contradicts `SPEC.md:115`, so SPEC.md needs updating in the
same change.

---

## Part 1 — Bugs

### B1. End screen overflows a landscape viewport; "Play Again" is clipped — [code]

**This is the reported bug, and the cause is confirmed by reading the code.**

**Where:** `frontend/src/components/EndScreen.jsx:78` — the root is
`absolute inset-0 flex flex-col items-center justify-center gap-5`, with no
scroll and no compact/short-viewport variant. Clipping is enforced by
`frontend/src/App.jsx:386` (`overflow-hidden`) and `frontend/src/index.css`
(`html, body, #root { height: 100%; overflow: hidden }`).

**Cause:** the End screen's content is roughly **550–600 CSS px tall**, against
**~393 px** of landscape viewport (less if the URL bar is showing — see B2).
Rough budget, top to bottom:

| Element | ≈ height |
|---|---|
| `You caught N` (`text-4xl`) | 40 |
| `Normal mode` label (`-mt-3`) | 8 |
| `Personal best: N` | 20 |
| `New personal best! 🎉` (conditional) | 28 |
| Name input + Add button (conditional) | 86 |
| Top-5 preview (label + 5 rows) | 174 |
| Play Again / Menu row + Full Leaderboard | 104 |
| 6 × `gap-5` (20px) | 120 |
| **Total** | **≈ 580** |

Because the container is `justify-center`, the ~190 px of overflow is split
evenly between top and bottom, cutting **~95 px off the bottom** — which lands
precisely on the Play Again / Menu row, leaving only its top edge visible.
`Full Leaderboard` below it is fully off-screen.

Note this is *not* primarily a safe-area or `100vh` issue — those make it worse
(B2, B3) but the content overflows even a perfect 393 px viewport. It is also
**worst on the exact runs the player cares about**: a qualifying score adds the
name-input block (+86) and the new-PB line (+28), pushing 114 px more content
in at the moment they most want to hit Play Again.

**Proposed fix:** a short-viewport layout for the End screen, matching the
pattern `StartScreen.jsx:25` already uses (`window.innerHeight < 500` →
`isCompact`). Under compact: reduce to `gap-2`, drop the heading to `text-2xl`,
cut the top-N preview from 5 to 3 rows, and put the action buttons on one row.
Additionally, make the container safe to overflow — `justify-start` with
`overflow-y-auto` and `overscroll-contain` rather than `justify-center` — so
that if content ever exceeds the height again, it scrolls instead of silently
hiding the primary action. Ideally factor the `isCompact` logic into a shared
`useCompactViewport()` hook rather than duplicating StartScreen's.

### B2. `height: 100%` / `100vh` semantics — layout is sized to the *large* viewport — [code]

**Where:** `frontend/src/index.css` — `html, body, #root { height: 100% }`.

On Chrome for Android the layout viewport (ICB) is the **large viewport** — the
height with the URL bar hidden. `height: 100%` therefore resolves to the taller
value even while the URL bar is visible, so the bottom ~56 px of every screen
sits underneath browser chrome. This applies to the start screen, end screen,
tutorial, settings, and the leaderboard overlay whenever the game is **not** in
fullscreen — which includes the moment `endGame()` calls `exit()`
(`App.jsx:301`) and drops back out of fullscreen with the End screen showing.
So B1's clipping is compounded by roughly another 56 px at exactly the wrong
moment.

**Proposed fix:** `height: 100dvh` with a `height: 100%` fallback, or drive
layout from `visualViewport.height`. A real manifest with `display: standalone`
(Finding 0) also removes the URL bar entirely and eliminates the discrepancy —
but the CSS fix should land regardless, since the game is also played in a
plain browser tab.

### B3. `viewport-fit=cover` is set but no `env(safe-area-inset-*)` is used anywhere — [code]

**Where:** `frontend/index.html` sets `viewport-fit=cover`; a repo-wide search
finds **zero** uses of `env(safe-area-inset-*)` in any CSS, Tailwind class, or
inline style.

`viewport-fit=cover` deliberately extends the page **into** the display cutout,
rounded corners, and gesture-bar region, on the promise that the app will pad
itself back out. Nothing does. Consequences, all in landscape:

- `StartScreen.jsx:54` (settings gear, `left-4 top-4`) and `:65` (audio toggle,
  `right-4 top-4`) sit 16 px from the physical edge — inside the rounded-corner
  arc and, in one landscape rotation, inside the cutout inset.
- `Tutorial.jsx:258` (Skip) and `Settings.jsx:45` (✕) have the same
  `right-4 top-4` placement.
- `Minimap.jsx:14` (`bottom-3 right-3`) and the joystick's base
  (`JOYSTICK_MARGIN = 40` from the bottom-left, `constants/boids.js:69`) sit in
  the Android gesture-bar strip.
- `StartScreen.jsx:158` ("Best played in landscape", `bottom-6`) and
  `RotationToast.jsx:46` (`bottom-8`) likewise.

**[device]** Exactly how much is lost depends on how Chrome reports insets on
the S23 FE in fullscreen vs. standalone vs. tab; the S23 FE has a centered
punch-hole rather than a notch, so the left/right inset in landscape may be
small — but the rounded-corner and gesture-bar insets are real.

**Proposed fix:** either drop `viewport-fit=cover` (simplest — the browser then
letterboxes away from the unsafe regions), or keep it and add a safe-area pad
on the app root plus explicit `env()` offsets on the corner-anchored controls,
the minimap, and the joystick base. Recommend keeping cover (it looks better
fullscreen) and adding the padding, with the joystick base offset by
`env(safe-area-inset-bottom)` / `env(safe-area-inset-left)` inside
`useInput.js`'s `baseCenter()` so touch and any future visual stay in sync.

### B4. Leaderboard overlay is badly clipped in landscape, and its Close button is off-screen — [code]

**Where:** `frontend/src/components/Leaderboard.jsx:91-144`
(`LeaderboardOverlay`) — `flex items-center justify-center` around a card with
`px-8 py-7`, `gap-4`, and `LeaderboardList … limit={10}`.

Height budget with a full board: title 32 + difficulty tabs 34 + platform
toggle 32 + 10 rows × ~30 with gaps ≈ 320 + Close 40 + `py-7` padding 56 + four
`gap-4` = 16 → **≈ 530 px** against ~393. With the card centered and no scroll,
roughly 70 px is cut off the top and 70 off the bottom, taking the **Close
button and the last two or three ranked rows** with it. Dismissal still works
(the backdrop `onClick={onClose}` at `:94`), so the player isn't trapped — but
the labelled affordance is invisible, and on a phone a backdrop tap is easy to
land inside the card by accident.

This affects the start screen's Leaderboard button and the End screen's "Full
Leaderboard" equally.

**Proposed fix:** make the card `max-h-[90dvh]` with the ranked list in its own
`overflow-y-auto overscroll-contain` region, so the header, tabs, and Close stay
pinned and only the rows scroll. Add compact spacing under the short-viewport
rule (`gap-2`, `px-5 py-4`).

### B5. Tutorial overflows in landscape — [code]

**Where:** `frontend/src/components/Tutorial.jsx:250` — `gap-8` (32 px) with a
fixed-size illustration canvas whose height comes from `SLIDES` (`:18-37`;
120–130 px), plus title, body, dots, and a `py-3 px-12` button.

Budget: canvas 130 + title 36 + `gap-3` 12 + body up to 3 wrapped lines ~72 +
dots 8 + button 52 + three `gap-8` 96 ≈ **406 px** — already over ~393 before
the URL bar or safe area, and slide 2 has the longest body text ("On mobile,
press and drag anywhere in the bottom-left corner…"), which wraps to 3–4 lines
in a `max-w-sm` container. The Next/Play button is the bottom-most element and
is the first thing to go. Because this is the **first-run** screen (auto-shown
via `hunter_tutorial_seen` in `App.jsx:57`), a new phone player may hit a
tutorial whose only forward affordance is partly clipped — though Skip
(`:256`) and swipe-left (`:241`) still work.

**Proposed fix:** short-viewport variant — `gap-3`, scale the illustration
canvas down (multiply `SLIDES[i].w/h` by ~0.7), `text-2xl` title, `text-sm`
body. Consider a side-by-side layout in landscape (illustration left, text +
button right), which uses the wide-and-short shape properly instead of fighting
it.

### B6. No `overflow`/scroll escape hatch on any overlay screen — [code]

**Where:** systemic. `App.jsx:386` is `overflow-hidden`; `index.css` sets
`overflow: hidden` on `html, body, #root`; every screen component
(`StartScreen`, `EndScreen`, `Tutorial`, `Settings`, `PauseScreen`,
`LeaderboardOverlay`) is `absolute inset-0 … justify-center` with no
`overflow-y`.

This is the *reason* B1/B4/B5 present as invisible controls rather than as a
scrollbar. Any content that exceeds the viewport is silently and symmetrically
truncated, with no feedback to the player that anything is missing. The
`overflow: hidden` is correct for the game canvas; it is wrong for text-and-
button screens.

**Proposed fix:** keep `overflow: hidden` on `html/body` (the canvas needs it),
but give each overlay screen `overflow-y-auto overscroll-contain` and switch
from `justify-center` to `justify-center` *with* `my-auto` on the inner content
(centers when it fits, scrolls when it doesn't). This is the single change that
makes all three clipping bugs fail safe.

### B7. Soft keyboard covers the name input on the End screen — [code] / [device]

**Where:** `EndScreen.jsx:101-108` — the name input sits mid-column in a
non-scrollable `justify-center` container.

Focusing it raises the Android soft keyboard, which shrinks the **visual**
viewport but not the layout viewport. With no scroll container (B6) and nothing
listening to `visualViewport`, the browser cannot scroll the focused field into
view. In landscape the keyboard occupies most of the screen, so the input, the
"Add to leaderboard" button, or both may end up hidden behind it. Chrome on
Android *may* fall back to full-screen "extract mode" text editing in landscape,
which would mask the problem.

**[device]** Needs confirming on the S23 FE with a qualifying score: does the
keyboard open in extract mode (a full-screen editor), or inline over the page?

**Proposed fix:** the B6 scroll container plus a `visualViewport` resize
listener that keeps the focused input above the keyboard. Alternative, and
probably better on a phone: move name entry into its own focused modal step
(one input, one Submit, one Skip) so the keyboard has nothing to collide with.

### B8. Stale joystick state can make the shark drive itself after an interruption — [code]

**Where:** `frontend/src/hooks/useInput.js:104-112` (`onTouchEnd`) and
`frontend/src/App.jsx` — there is no `visibilitychange` handler for the game.

`inputPosRef` retains the last joystick vector indefinitely; it is only zeroed
when the owning finger's `touchend`/`touchcancel` fires (`:110`). If a round is
interrupted mid-drag — incoming call, notification shade pulled down, app
switch, screen-off — and that event doesn't deliver a `touchcancel`, the ref
keeps its last non-zero `{dx, dy}`. `requestAnimationFrame` stops while hidden,
so nothing happens *during* the interruption, but on return the loop resumes and
the shark immediately swims at the stale heading with no finger on the screen.

Related and worth deciding on: the main game has **no visibility-based pause at
all**. `AttractBackground.jsx:91` does exactly this for the idle sim
(`onVisibility`), but `useGameLoop` does not. Because rAF halts when hidden and
the timer advances from `dtSeconds` per frame, backgrounding the app currently
**freezes the round clock** — a player can pause a 60 s run indefinitely by
switching apps, which is a competitive-integrity hole in a leaderboard game.

**Proposed fix:** two parts. (1) In `useInput`, clear `touchIdRef` and zero
`inputPosRef`/`joystickRef` on `visibilitychange` → hidden and on window `blur`.
(2) In `App.jsx`, add a `visibilitychange` listener that calls `pauseGame()` when
the document hides during play, mirroring the existing fullscreen-exit → pause
path (`App.jsx:115`). That fixes the stale input and makes the interruption
explicit to the player rather than a silent free pause.

### B9. Android edge-swipe zones overlap the joystick activation area — [device]

**Where:** `constants/boids.js:68-74` — base center at
`(JOYSTICK_MARGIN + JOYSTICK_RADIUS)` = **(100, height − 100)**, with
`JOYSTICK_ACTIVATE_RADIUS = 80`.

The activation circle therefore spans **x ∈ [20, 180]** and, in a 393 px-tall
landscape viewport, **y ∈ [213, 373]** — i.e. it reaches to within 20 px of the
left edge and 20 px of the bottom edge. Android gesture navigation claims a
~20–24 px strip on the left edge (back) and the bottom strip (home / recents).
A player grabbing the low-left of the stick may trigger a back gesture instead.
Chrome's fullscreen immersive mode usually demotes the first swipe to a "peek",
which mitigates but does not eliminate this — and it does **not** apply when the
game is running in a plain tab because `requestFullscreen` was refused.

**[device]** Needs real-hand testing: hold the phone two-handed in landscape and
sweep the stick to its bottom-left rim repeatedly.

**Proposed fix:** raise `JOYSTICK_MARGIN` (40 → ~72) and/or offset the base by
`env(safe-area-inset-left/bottom)`, so the activation circle clears the gesture
strips. Both `useInput.js:48` and any future joystick rendering derive from the
same constants, so this is a one-line tuning change.

### B10. `RotationToast` only ever evaluates orientation once, at mount — [code]

**Where:** `frontend/src/components/RotationToast.jsx:19-20` — `isPortrait` is
read inside a `useEffect` with `[]` deps and never recomputed.

If the start screen mounts in landscape and the player then rotates to portrait,
the hint never appears. Conversely, if it mounts in portrait, the 1 s timer
fires and shows "Rotate your phone" even if the player has already rotated to
landscape in the meantime. Given the component's whole job is orientation
guidance on phones, it currently gives it based on a single stale sample.

**Proposed fix:** subscribe to `orientationchange` / `matchMedia('(orientation:
portrait)')` and re-evaluate, with the `sessionStorage` once-per-session guard
kept as-is.

### B11. Orientation lock is never released — [code]

**Where:** `frontend/src/hooks/useFullscreen.js:24-31` calls
`screen.orientation.lock('landscape')`; there is no matching
`screen.orientation.unlock()` in `exit()` (`:33-41`).

Chrome releases the lock implicitly when fullscreen ends, so in the normal path
this is harmless. It becomes real in the two paths where fullscreen was never
entered or was already exited: a browser that grants the orientation lock but
refuses fullscreen, and — relevantly for Finding 0 — a future `standalone` PWA,
where an explicit lock can persist across the whole session and pin the start
screen and leaderboard to landscape too.

**Proposed fix:** call `screen.orientation.unlock()` in `exit()`, guarded in a
`try/catch` like the lock. Once a manifest exists, prefer declaring
`"orientation": "landscape"` there and drop the imperative lock.

### B12. `PauseScreen` has no short-viewport handling and its toggle sits in the unsafe corner — [code]

**Where:** `frontend/src/components/PauseScreen.jsx:8` (`gap-8`) and `:15`
(`right-4 top-4`).

The content is light (title + two buttons ≈ 200 px), so it fits — this one is
about consistency rather than a live clipping bug: the audio toggle shares B3's
unsafe-corner placement, and the screen has no compact variant if content is
ever added to it.

**Proposed fix:** fold into the shared safe-area padding and compact-viewport
rules from B3/B6 rather than fixing in isolation.

### B13. `maximum-scale=1.0, user-scalable=no` blocks pinch-zoom — [code]

**Where:** `frontend/index.html` viewport meta.

Correct for the gameplay canvas, wrong for the text screens: it prevents a
player with low vision from zooming the leaderboard, tutorial body text, or the
`text-xs` (12 px) labels that appear throughout. It is also a documented
accessibility failure (WCAG 1.4.4). Chrome on Android honours it. Note that the
canvas already suppresses gestures independently via `touch-action: none`
(`index.css`), so the meta restriction is largely redundant for its stated
purpose.

**Proposed fix:** drop `maximum-scale` / `user-scalable` from the meta tag and
rely on `touch-action: none` on the canvas plus `overscroll-behavior: none` on
the body to keep gameplay gesture-free.

### B14. `sizeCanvas` runs on `resize` only while playing/paused — [code]

**Where:** `frontend/src/App.jsx:331-341` — `onResize` early-returns unless
`stateRef.current` is `'playing'` or `'paused'`.

The main canvas is always mounted (`App.jsx:391`) but only *visible* during
play, so this is deliberate and mostly fine. The gap: `startGame` calls
`sizeCanvas()` (`:244`) immediately after `await enter()`, and on Android the
fullscreen + orientation-lock transition is animated and **completes after the
promise resolves**. The viewport read at that instant can be the pre-rotation
portrait size, which then seeds `world` (`:247-250`), the minimap dimensions
(`:255-257`), and the initial camera (`:266`) — all of which are fixed for the
whole round. The later `resize` event does re-run `sizeCanvas`, so the camera
and backing store recover, but **the world dimensions do not** — a round started
from portrait can get a portrait-shaped world (tall and narrow) rendered into a
landscape viewport.

**[device]** Needs confirming: start a round from portrait on the S23 FE and
check whether the world/minimap aspect looks wrong (the minimap is the tell —
it's drawn to the world's aspect ratio at `App.jsx:256`).

**Proposed fix:** after `enter()`, wait for the viewport to settle before
sizing — either await an `orientationchange`/`resize` with a short timeout, or
double-`requestAnimationFrame` — then call `sizeCanvas()` and derive the world.

---

## Part 2 — Mobile optimization opportunities

### Touch targets & ergonomics

**O1. Most controls are below the 44–48 px minimum touch target. [code]**
Measured from the Tailwind classes:

| Control | Where | ≈ height |
|---|---|---|
| Difficulty buttons (`py-1.5 text-sm`) | `StartScreen.jsx:113` | ~30 px |
| "How to play" (bare text link) | `StartScreen.jsx:143` | ~20 px |
| Settings gear / audio toggle (`px-3 py-2`) | `StartScreen.jsx:54, 65` | ~40 × 36 px |
| Leaderboard difficulty tabs (`py-1.5`) | `Leaderboard.jsx:110` | ~30 px |
| Platform toggle (`py-1 text-xs`) | `Leaderboard.jsx:127` | ~26 px |
| Skip / ✕ (`py-1.5 text-sm`) | `Tutorial.jsx:258`, `Settings.jsx:45` | ~30 px |
| Full Leaderboard / Menu (`py-2`) | `EndScreen.jsx:148, 155` | ~36 px |

Only the primary Play / Play Again / Resume buttons (`py-3`, ~52 px) clear the
bar. Fix: introduce a shared touch-target class (`min-h-11 min-w-11`, i.e.
44 px) applied on touch devices, or add invisible padding via a `::before`
expander so visual density is preserved while the hit area grows. The three
difficulty buttons at `gap-2` (8 px apart) are also the most mis-tap-prone
group on the start screen — widen to `gap-3` and pad vertically.

**O2. The game is effectively left-hand-only, with no handedness option. [code]**
The joystick is hard-pinned bottom-left (`JOYSTICK_BASE_X/Y`,
`constants/boids.js:72-73`) and there is no second input — the right hand does
nothing. Meanwhile the minimap sits bottom-right (`Minimap.jsx:14`), the only
place a resting right thumb would naturally sit, so it gets occluded for no
benefit. Fix: add a left/right handedness setting (persisted alongside audio in
`settings.js`) that mirrors both the joystick base and the minimap. Since
`useInput.js:48` and `Minimap.jsx` both derive placement from single sources,
this is a small change with a large ergonomic payoff.

**O3. Fixed joystick position vs. floating/dynamic joystick. [device]**
The stick is fixed and *invisible* (`renderer.js:9-10`, Session 8), so the
player must remember where it is and land within
`JOYSTICK_ACTIVATE_RADIUS = 80` px of a point they can't see. A touch outside
that circle does nothing at all (`useInput.js:87`) — silent failure, no
feedback. Fix worth trialling: a **floating** joystick, where the base is
created wherever the thumb first lands in the left half of the screen and
recentres on each new touch. This is the dominant pattern in modern mobile
action games precisely because it removes the "find the invisible stick"
problem, and it makes B9's gesture-strip overlap much less likely since the
player naturally lands inboard.

**O4. No joystick visual feedback at all. [code]**
`joystickRef` is fully populated with `{ active, dx, dy }` every frame
(`useInput.js:63`) and passed out of the hook, but **nothing consumes it** —
`App.jsx`'s `onFrameDraw` never draws it, and `renderer.js:9-10` documents the
omission as intentional. `Tutorial.jsx:65` even contains a complete
`drawJoystick()` that could be reused. Fix: draw a low-opacity ring + knob
while `active` (fading in on touch, out on release). It costs one render call,
uses state that already exists, and directly addresses O3's discoverability
problem without changing the control scheme.

**O5. No joystick dead zone. [code]**
`applyStick` (`useInput.js:50-70`) maps displacement linearly to velocity with
no dead zone and no response curve, so a thumb resting a few px off centre
produces slow constant drift, and fine aiming near the centre is twitchy. Fix:
a small dead zone (~8 px) plus a mild input curve (square the magnitude,
preserve direction) for precision near centre and full speed at the rim.

**O6. Catch hitbox is tuned for a mouse. [code]**
`HITBOX_RADIUS = 12` (`constants/boids.js:63`) with the comment explaining it
was raised from 8 to prevent tunnelling. Joystick control is inherently less
precise than a mouse — the shark chases a direction rather than a point — so
mobile play is measurably harder at the same hitbox. Fix: a platform-scaled
hitbox (e.g. ×1.3 on touch), which `getPlatform()` (`utils/platform.js:11`)
already makes trivial to branch on. Note this interacts with the leaderboard:
the boards are already split by platform (`Leaderboard.jsx:16`), so mobile
tuning cannot pollute desktop standings.

**O7. No haptics on catch. [code]**
Already on the v2 list above; calling it out here as the single highest
value-per-line mobile addition. `navigator.vibrate(15)` inside the existing
catch block (`App.jsx:174`, next to `playCatch()`) gives tactile confirmation
that lands even when the player's thumb is covering the score. Guard behind the
audio/settings preference or its own toggle.

### Performance, frame pacing, and battery

**O8. `devicePixelRatio` is used unclamped. [code]**
`App.jsx:134` — `const dpr = window.devicePixelRatio || 1`. On the S23 FE
(DPR ≈ 2.75) a landscape canvas becomes **2340 × 1080 ≈ 2.5 M pixels**, cleared
and refilled every frame, with per-fish shadow blur on top (O9). This is the
single largest mobile GPU cost in the game and it buys almost nothing visually —
the art is flat fills and 1.5 px strokes, not fine detail. Fix: clamp to
`Math.min(window.devicePixelRatio || 1, 2)`, or clamp on touch devices only. A
DPR of 2 cuts pixel count by ~47 %. Worth exposing as a constant in
`constants/boids.js` alongside the other tuning values.

**O9. `shadowBlur` per fleeing fish is the hot path. [code]**
`renderer.js:52-57` sets `shadowColor` + `shadowBlur = 14` for every fish inside
the flee radius, every frame. Canvas shadow blur is one of the most expensive
2D operations there is, and it's applied per-object rather than once. In
hardcore mode `FLEE_RADIUS = 120` with 50 fish means a large fraction of the
school can be glowing simultaneously during the exact moments (a big scatter)
when frame budget is tightest. The codebase already knows this —
`AttractBackground.jsx:58-60` explicitly passes `glow=false` calling it "the
costly path". Fix options, in preference order: (a) pre-render the glowing fish
once to an offscreen canvas/`ImageBitmap` and `drawImage` it, (b) replace the
blur with a cheap two-pass draw (a larger translucent kite behind the body),
(c) cap the number of simultaneously-glowing fish. Glow behaviour itself is
out of scope for this session per the brief — this is a rendering-cost note, not
a proposal to change how glow looks.

**O10. 120 Hz display doubles the workload for no gameplay benefit. [device]**
The S23 FE runs at up to 120 Hz. `useGameLoop.js:23-39` is uncapped rAF with
frame-normalised `dt`, so *motion* is correct at any refresh rate — but the
simulation, the O(n²) boids pass, and the full-canvas repaint all run twice as
often as needed, roughly doubling CPU and GPU draw for a 60 s round. That is the
most likely cause of thermal throttling and battery drain, and ironically of
*worse* consistency (a device that can hold 60 Hz comfortably may stutter trying
for 120). Fix: an optional frame cap — accumulate elapsed time and skip the
update/draw when under ~16.6 ms — ideally on by default for touch devices, with
the cap value in `constants/boids.js`.

**O11. Per-frame allocation churn drives GC jank. [code]**
Every frame the game allocates: a whole new fish array with a new object per
fish (`boids.js:190-201`, `fish.map(...)` returning `{x, y, vx, vy}`), a new
predator object (`predator.js:50`), a new particle array with a spread-copied
object per particle (`particles.js:41-56`), plus a `worldToScreen` object per
fish and per particle per frame (`renderer.js:87`, `particles.js:62`). At 60
fish and 120 Hz that is on the order of **20–30 k short-lived objects per
second**. On desktop the generational GC absorbs it; on a phone it shows up as
periodic frame-time spikes. Fix: mutate in place in the hot loops (the purity is
valuable for the unit tests, so keep the pure functions and add mutating
`*InPlace` variants used only by the game loop), and return scalars rather than
`{x, y}` objects from `worldToScreen` in the render path.

**O12. Boids is O(n²) with four separate full passes. [code]**
`updateFish` (`boids.js:153+`) calls `separation`, `alignment`, and `cohesion`,
each of which iterates the entire neighbour list independently (`:50`, `:72`,
`:93`). At 70 fish (easy mode, `FISH_COUNT.easy`) that is 70 × 70 × 3 ≈
**14 700 distance computations per frame**, ×120 fps = 1.76 M/s. Fix: a uniform
spatial grid keyed on the largest radius (`COHESION_RADIUS = 100`), or at
minimum a single fused neighbour pass that accumulates all three forces in one
loop — a ~3× reduction for a contained change inside `boids.js`.

**O13. Canvas context is not created with `alpha: false`. [code]**
`App.jsx:200` and `AttractBackground.jsx:29` both call `getContext('2d')` with
no options. The game draws an opaque navy background over the full canvas every
frame (`renderer.js:22-25`), so the alpha channel is pure overhead in
compositing. Fix: `getContext('2d', { alpha: false })`. Consider
`desynchronized: true` as well for lower touch-to-photon latency on the joystick
— worth an A/B on device.

**O14. `getContext('2d')` is called inside the draw loop. [code]**
`App.jsx:200` re-fetches the context on every frame, as does the minimap path
(`App.jsx:228`). It's cached by the browser and cheap, but it's a per-frame call
in the hottest function for no reason. Fix: hoist into a ref set once in
`sizeCanvas`.

**O15. Minimap redraws at full frame rate. [code]**
`App.jsx:226-229` calls `drawMinimap` every frame, which clears, fills, strokes,
and then draws one `fillRect` per fish plus an arc (`renderer.js:157-178`). It's
a ~127 × 100 px canvas showing coarse dots — 10 Hz is indistinguishable from 120
Hz. Fix: throttle to every Nth frame (constant in `constants/boids.js`).

**O16. Two independent rAF loops can overlap on the start screen. [code]**
`AttractBackground` runs its own uncapped loop with 40 fish
(`ATTRACT_FISH_COUNT`, `AttractBackground.jsx:67-77`), and `Tutorial`'s slide 3
runs a third (`Tutorial.jsx:220-227`). On first run, a phone sits on the start
screen with the attract sim *and* the tutorial's animated timer both running,
with the tutorial's opaque background (`Tutorial.jsx:251`) completely hiding the
attract sim. Fix: pause `AttractBackground` while the tutorial, settings, or
leaderboard overlay is open — the component already has a clean
start/stop mechanism (`startLoop`/`stopLoop`, `:79-88`) and already pauses on
`visibilitychange`, so this is wiring an existing capability to an existing
signal.

**O17. Attract mode runs indefinitely on the start screen. [code]**
Nothing stops the idle sim after a period of inactivity, so a phone left on the
start screen burns CPU/GPU and battery forever (screen-off is caught by
`visibilitychange`, but screen-on-and-idle is not). Fix: fade the attract sim to
a static frame after ~60 s of no interaction, resuming on any touch.

**O18. One-shot sounds allocate a new `Audio` element per catch. [code]**
`useSound.js` `playOneShot` constructs `new Audio(src)` per invocation. At a
high score that's dozens of media elements created and decoded during a round.
**Audio is explicitly out of scope for this session per the brief** — noting it
only so it isn't lost; the fix would be a small pre-decoded buffer pool.

### Orientation, fullscreen, and the standalone experience

**O19. Fullscreen entry is silent when it fails. [code]**
`useFullscreen.js:16-31` swallows both the fullscreen and orientation-lock
failures by design (graceful fallback per GDD). The consequence on a phone is
that a player can end up mid-round in a portrait, URL-bar-visible browser tab
with a world sized for that shape, and nothing ever tells them or offers a
retry. Fix: track whether `enter()` actually succeeded (check
`document.fullscreenElement` after the await) and, on failure with a touch
device in portrait, surface a persistent, dismissible "rotate to landscape" hint
rather than the one-shot `RotationToast`.

**O20. The rotation hint is one-shot and pre-game only. [code]**
`RotationToast.jsx` shows for 4 s, once per session, on the start screen only
(`App.jsx:423` gates it on `screen === 'start'`). If the player rotates to
portrait *during* a round in a browser where the orientation lock failed, there
is no guidance at all. Fix: a persistent portrait-blocking overlay during play
when the lock isn't held — this is the standard mobile-game pattern and it also
prevents the world/viewport mismatch from B14.

**O21. Standalone mode changes the pause trigger, and nothing accounts for it. [code] / [device]**
The pause path is entirely fullscreen-driven: `handleFullscreenExit`
(`App.jsx:115`) fires from `fullscreenchange` and is the only way the Android
back gesture reaches the game. In a real `standalone` PWA (Finding 0) there is
no browser chrome, `requestFullscreen` may be a no-op because the app is already
fullscreen, and **the back gesture may close or background the app instead of
firing `fullscreenchange`** — meaning the round is lost with no pause. Fix:
don't rely on fullscreen as the pause signal. Add the `visibilitychange` pause
from B8, and add a `history.pushState` guard so `popstate` (back gesture) pauses
rather than exits. This should land in the same change as the manifest.

**O22. No explicit pause control during play. [code]**
`HUD.jsx:14` is `pointer-events-none` and contains only score and timer. On
desktop, Escape pauses (`App.jsx:319-326`); on a phone the *only* way to pause
is to exit fullscreen via a system gesture, which is exactly the gesture that
risks leaving the game (O21). Fix: a small pause button in the HUD — top-centre,
away from both the joystick and the minimap, with `pointer-events-auto` on just
that element.

### Legibility, scale, and polish

**O23. `text-xs` (12 px) is used for real information. [code]**
`StartScreen.jsx:104` ("Difficulty"), `:158` ("Best played in landscape"),
`HUD.jsx:20` (mode label), `EndScreen.jsx:128` (top-scores header),
`Leaderboard.jsx:127` (platform toggle), `Settings.jsx:20, 55`. At phone
viewing distance with the compact landscape layout, 12 px uppercase tracked text
is genuinely hard to read, and B13 prevents zooming in to check. Fix: floor
informational text at 14 px on touch devices; reserve 12 px for decorative
labels only.

**O24. The compact-layout rule exists in exactly one component. [code]**
`StartScreen.jsx:25, 34-42` implements a `window.innerHeight < 500` breakpoint
with its own resize/orientationchange listeners. `EndScreen`, `Tutorial`,
`Settings`, `PauseScreen`, and `LeaderboardOverlay` have no equivalent — which
is the root cause of B1, B4, and B5. Fix: extract `useCompactViewport()` into
`hooks/`, use it in all six screens, and unit-test it alongside the Session 18
suite. This is the structural fix that the individual bug fixes should be built
on rather than patched around.

**O25. Tailwind's `sm:` breakpoints are width-based and useless here. [code]**
`EndScreen.jsx:79` (`sm:text-5xl`) and `Tutorial.jsx:269` (`sm:text-4xl`) scale
type up at ≥640 px **width**. A phone in landscape is ~851 px wide and ~393 px
tall, so it matches `sm:` and gets the *large* type — precisely the wrong
direction, and an active contributor to B1 and B5. Fix: replace width-based
`sm:` type scaling on these screens with the height-based compact rule from O24.

**O26. Overscroll / pull-to-refresh is not explicitly disabled. [code]**
`index.css` sets `overflow: hidden` on `html, body` and `touch-action: none` on
`canvas`, but never sets `overscroll-behavior`. The overlay screens (start, end,
tutorial, settings, leaderboard) are ordinary divs with no `touch-action`, so a
downward swipe on the End screen can reach Chrome's pull-to-refresh. `overflow:
hidden` usually suppresses it, but this becomes a live risk the moment B6 adds
scrollable containers. Fix: `overscroll-behavior: none` on `html, body`, added
in the same change as B6.

**O27. `theme-color` is not set. [code]**
`index.html` has no `<meta name="theme-color">`. In a browser tab the Android
status bar and URL bar stay default-light against the game's `#0a1628`, and a
future standalone PWA would show a mismatched status bar. Fix:
`<meta name="theme-color" content="#0a1628">`, matching `theme.background`, plus
the same value in the manifest from Finding 0.

**O28. `getPlatform()` treats any touch-capable device as mobile. [code]**
`utils/platform.js:9-11` — `navigator.maxTouchPoints > 0`. A touchscreen laptop
or a Windows tablet with a mouse submits to the **mobile** leaderboard while
playing with a mouse at desktop precision. That's a leaderboard-fairness issue
that a mobile-tuned hitbox (O6) would amplify. Fix: combine the touch check with
`matchMedia('(pointer: coarse)')`, and consider classifying by the input actually
used in the round (which control path fed `inputPosRef`) rather than by device
capability.

---

# Session 19 — Addendum: three additional audit areas

Appended after the original 42 findings (Finding 0, B1–B14, O1–O28). Items here
are numbered **A1–A…** so they never merge into that list. Same rules: audit
only, nothing implemented, no data modified. Same confidence tags —
**[code]** = confirmed by reading source, **[device]** = needs S23 FE
verification.

---

## Gap 1 — Round timer and leaderboard integrity

### A1. Correction to B8: the clock does **not** freeze when backgrounded — [code]

The original B8 claimed backgrounding the app freezes the 60-second clock and
called it "a free pause." **That is wrong, and the code says so plainly.** In
[useGameLoop.js:30-31](frontend/src/hooks/useGameLoop.js#L30-L31):

```js
const dt = Math.min(elapsedMs / (1000 / 60), 3)  // capped
const dtSeconds = elapsedMs / 1000                // NOT capped
```

Only `dt` (motion) is capped. `dtSeconds` (the timer) is raw wall-clock, and
`App.jsx:182` decrements `timeLeftRef` by it directly. Because
`elapsedMs = now - lastRef.current` telescopes across frames, the timer's total
is exactly the wall-clock time since the round began. `requestAnimationFrame`
halts while the page is hidden, so `lastRef.current` retains the pre-hide
timestamp and the **first frame after returning carries the entire hidden
duration in a single `dtSeconds`**.

So the timer is honest wall-clock and there is **no timer exploit**. Repeated
background/foreground cycling cannot extend a round — each cycle is billed in
full on return.

### A2. The real behavior is the opposite bug: interruptions destroy the round — [code]

The same uncapped `dtSeconds` means that backgrounding for 30 s of a 60 s round
returns the player to a game that instantly loses 30 seconds — and if the
interruption outlasts the remaining time, `App.jsx:189` fires `endGame()` on the
very first frame back. The player sees the End screen before they see a frame of
gameplay.

Worse, it is *asymmetric*: `dt` is capped at 3, so the world advances only three
frames while the clock advances 30 seconds. The player is charged wall-clock time
for a world that was frozen. This is a strictly-punishing bug, and it is far more
severe on mobile than desktop — phones interrupt constantly (calls, notification
shade, app switch, screen timeout), and a 60-second round has no slack.

**Proposed fix:** pause on `visibilitychange → hidden` rather than trying to
correct after the fact, which is the same fix B8 proposed for the stale-joystick
problem. As a defensive backstop, also clamp `dtSeconds` (e.g. to 0.25 s) so that
a single frame can never consume a meaningful fraction of the round even if the
pause path is somehow missed. Both are client-side.

### A3. Desktop is largely protected by an accident of the fullscreen pause — [code] / [device]

The same uncapped `dtSeconds` exists on desktop, but desktop rarely reaches it:
alt-tabbing out of a fullscreen window causes Chrome to exit fullscreen, which
fires `fullscreenchange` → `handleFullscreenExit` ([App.jsx:115](frontend/src/App.jsx#L115))
→ `pauseGame()` → `stop()`. The loop is cancelled, so no giant `dtSeconds` frame
is ever delivered. `Escape` ([App.jsx:319-326](frontend/src/App.jsx#L319-L326))
covers the windowed case.

There is no `blur` handler, so a desktop case that switches away *without*
leaving fullscreen (a second monitor, an OS overlay) would still hit A2. **[device]**
On Android the equivalent question is whether an app switch exits fullscreen and
fires `fullscreenchange` — if it does, mobile is accidentally protected too and
A2 is narrower than it looks; if it doesn't, mobile is fully exposed. This is
the single most valuable thing to check on the S23 FE for this gap. It is also
exactly the concern raised in O21 about standalone mode, where fullscreen may
not be a meaningful state at all.

### A4. Live leaderboard data shows nothing anomalous — [code, read-only]

Read via `GET /api/leaderboard` for all six boards. No data touched.

| Board | Entries | Top score | Ceiling |
|---|---|---|---|
| easy / desktop | 2 | 36 | 70 |
| easy / mobile | 10 | 52 | 70 |
| normal / desktop | 6 | 21 | 60 |
| normal / mobile | 6 | 26 | 60 |
| hardcore / desktop | 1 | 4 | 50 |
| hardcore / mobile | 4 | 14 | 50 |

Nothing is at or near a per-difficulty ceiling; the highest score on any board
(52 on easy/mobile) sits 18 below its cap. The easy/mobile board's recent run
(28 → 39 → 41 → 43 → 52 across ~15 minutes on 2026-08-02, one player) reads as
ordinary skill progression, not manipulation — and per A1 there is no timer
exploit that could have produced it anyway. **No evidence of exploitation, and
no basis for removing any entry.**

One unrelated observation worth noting: **mobile boards outscore desktop boards
in every difficulty** (easy 52 vs 36, normal 26 vs 21, hardcore 14 vs 4). That
inverts the assumption stated in [backend/main.py](backend/main.py)'s
`get_leaderboard` docstring — *"desktop play is harder"* — which is the stated
justification for splitting the boards by platform. Small sample, and confounded
by who played on what, but the premise deserves a second look. It also bears on
**O6** (a platform-scaled hitbox for touch): the data gives no support for mobile
needing a handicap.

### A5. The score ceiling is the *only* server-side plausibility check — [code]

`POST /api/leaderboard` is unauthenticated by design (public game, no
Cloudflare Access per CLAUDE.md). The server validates name safety, theme,
difficulty, platform, and the Session 18 per-difficulty score ceiling
(`MAX_SCORE_BY_DIFFICULTY`, [backend/main.py](backend/main.py)) — but the score
itself is a client-asserted integer with no relationship to a played round.
Anyone with `curl` can post a 70 on easy/mobile, and it is indistinguishable
from a legitimate submission. There is also no rate limit, so the boards can be
flooded.

This is worth stating plainly because it bounds how much the client-side fixes
above are worth: **A2's fix improves fairness for honest players; it does not
make the leaderboard tamper-proof, and nothing short of server-side round
validation would.** For a game of this scale that trade is entirely reasonable —
the ceiling already blocks the absurd cases, and the per-difficulty split makes a
forged score at least internally consistent.

**Proposed fix (optional, backend — out of scope this session):** a simple
per-IP rate limit on POST, and optionally a minimum plausible round duration
enforced by having the client send round length alongside the score. Neither is
recommended as urgent. Recording it so the trade-off is a decision rather than
an oversight.

---

## Gap 2 — Offline behavior once a real service worker exists

All of the following is currently latent — it becomes live the moment a service
worker lands (Finding 0).

### A6. The offline fallback silently discards qualifying scores — [code]

[EndScreen.jsx:60-61](frontend/src/components/EndScreen.jsx#L60-L61):

```js
const canSubmit = status === 'ready' ? qualifies : status === 'error' ? isNewPB : false
```

Offline today, the full path is: `getLeaderboard()` throws → `status = 'error'`
→ `canSubmit` falls back to `isNewPB` → the name input renders → the player types
their name and taps "Add to leaderboard" → `postScore()` throws →
`submitState = 'error'` → *"Something went wrong. Try again"* → **the score is
gone.** Retrying does nothing, because the network is still down, and there is no
persistence anywhere in the component.

This design is defensible today, when offline is an anomaly. It becomes wrong in
an offline-capable PWA, where offline is a **normal operating state**: the app
loads from cache, plays a complete round, and then invites the player to enter
their name for a submission it already knows cannot succeed. That is the worst of
the three possible behaviors — it costs the player effort *and* loses the score.

**Proposed fix:** distinguish "the fetch failed" from "we are offline" using
`navigator.onLine` plus the `online`/`offline` events. Then:

- **Offline + score would plausibly qualify** → queue it. Persist
  `{name, score, theme, difficulty, platform, playedAt}` to `localStorage` (or
  IndexedDB) and show *"Saved — will be added when you're back online"*. Flush on
  the next `online` event or next app start, ideally via a Background Sync
  registration with a plain event-listener fallback (Background Sync is
  Chromium-only, which is fine for the S23 FE target).
- **Offline + can't tell whether it qualifies** → still queue. The server is the
  authority on ordering anyway; a queued score that turns out not to rank is
  harmless.
- **Online but the fetch failed** → keep today's `isNewPB` fallback. That is a
  genuine transient error and "try again" is the right advice.

Two consequences to design around, both real: a queued score submitted days later
gets a server-side `created_at` of the flush time, which changes tie-break
ordering (`ORDER BY score DESC, created_at ASC` in `fetch_top`) — worth sending
the client's `playedAt` if that matters. And a queue is a tampering surface, so
it should stay subject to the same per-difficulty ceiling on flush (it already
is, server-side).

### A7. Confirming your caching prior — with one narrow amendment — [code]

**Your prior is right, and for a sharper reason than "stale standings are
misleading."** A stale cached `/api/leaderboard` would corrupt the *qualification
logic*, not just the display. `qualifies()`
([Leaderboard.jsx:40-42](frontend/src/components/Leaderboard.jsx#L40-L42))
compares the score against `entries[entries.length - 1].score` — the 10th-place
cutoff. Feed it a stale board and it fails in both directions: it offers the
submit prompt for a score that no longer qualifies (player submits, never
appears, looks broken), or it hides the prompt for a score that does qualify
(player silently loses a legitimate placement). A stale *display* is a cosmetic
annoyance; a stale *cutoff* is a correctness bug. **Do not runtime-cache the
qualification fetch. Network-only.**

The one amendment: the same endpoint serves two different purposes. The End
screen's fetch feeds `qualifies()` and must be network-only. But
`LeaderboardOverlay` ([Leaderboard.jsx:76](frontend/src/components/Leaderboard.jsx#L76))
is pure display — browsing standings from the start screen. There, showing a
cached board **explicitly labelled** *"Last updated 2 hours ago — offline"* is
strictly better than "Couldn't load scores," and it makes the offline PWA feel
finished rather than broken. If you take this, it must be an opt-in
stale-while-revalidate on the display path only, never on the End screen's
`loadPreview`. If that split feels like more machinery than it's worth,
network-only everywhere is a perfectly good answer — the amendment is optional
and your instinct is the safe default.

Recommended routing overall:

| Route | Strategy | Why |
|---|---|---|
| `/index.html` | **Network-first**, cache fallback | See A8 — cache-first here strands users on an old build |
| `/assets/*.js`, `*.css` | Cache-first, precache | Content-hashed by Vite; immutable, safe forever |
| `/audio/*.mp3` | Cache-first, precache — see A9 | Static, small, never change |
| `/favicon.ico`, `/icon-*.png` | Cache-first, precache | Static |
| `/api/leaderboard` (End screen) | **Network-only** | Feeds `qualifies()` — staleness is a correctness bug |
| `/api/leaderboard` (overlay) | Network-only, or labelled SWR (A7) | Display only |
| `/api/health` | **Never cache** | A cached 200 makes a dead backend look alive |

### A8. `index.html` cache strategy is the deploy-breaking decision — [code]

The Pi deploy is `npm run build` + `systemctl restart hunter` (CLAUDE.md). Vite
content-hashes `/assets/*` (the live build serves `index-z6yPhDhW.js`), so those
are safe to cache forever — but **`index.html` keeps the same URL across every
deploy** and is the only thing pointing at the new hashes. A cache-first
`index.html` would pin every installed user to whatever build they first
installed, permanently, with no way to update short of clearing site data. The
game would appear to stop receiving updates.

**Proposed fix:** network-first for `index.html` with a short timeout falling
back to cache, plus a versioned precache name and `skipWaiting()` +
`clients.claim()` so a new worker takes over promptly. Worth pairing with a
visible "Update available — tap to reload" affordance, since a mid-round
`skipWaiting` reload would be hostile.

### A9. Audio files are small enough to precache, with one Range-request caveat — [code] / [device]

Total audio is **184 KB** (`Ambient_Loop.mp3` 120 KB, `Game_Over.mp3` 25 KB,
`Congrats.mp3` 17 KB, `Bubble_Pop.mp3` 9 KB), against **204 KB** for the entire
JS/CSS bundle and 24 KB of icons. The complete precache is **~410 KB** — trivial.
Precache all four; there is no case for lazy-loading anything at this size, and
the ambient loop starting instantly offline is most of the "feels installed"
effect.

The caveat is the classic service-worker media gotcha: browsers often request
media with a `Range` header, and a naive `caches.match()` returns a full `200`
response to a request expecting `206 Partial Content`, which some browsers reject
outright. It bites Safari hardest and Chrome least, and these files are small
enough that Chrome will usually fetch them whole — but the failure mode is
*silent audio in the installed app only*, which is miserable to debug after the
fact. **[device]** Explicitly test all four sounds in the installed PWA with the
network disabled once a worker lands. If it does misbehave, the standard fix is a
Range-aware fetch handler that slices the cached `ArrayBuffer` and synthesizes a
`206`.

Second, smaller interaction: `useSound.js` constructs `new Audio(src)` per
one-shot (noted in **O18**). Each construction issues a request that the service
worker must handle — dozens per round at a high score. Cache hits are fast, but
this makes O18's buffer-pool fix more worthwhile once a worker is in play, not
less.

### A10. Offline state is invisible to the player — [code]

Nothing in the codebase reads `navigator.onLine` or listens for `online`/`offline`
(confirmed by search). Today that's acceptable — offline means "the page didn't
load." In an installed PWA the app launches fine and the player only discovers
they're offline when the leaderboard shows *"Couldn't load scores"*
([Leaderboard.jsx:48](frontend/src/components/Leaderboard.jsx#L48)), an error
message that describes a server problem rather than their own connectivity.

**Proposed fix:** a small persistent offline indicator on the start screen, and
connectivity-aware copy on the leaderboard ("You're offline" vs "Couldn't load
scores"). Pairs directly with A6's queued-submission messaging.

---

## Gap 3 — Test suite impact

Current state: **21 files, 189 frontend tests, all passing** (verified by running
the suite), plus 40 backend tests = the 229 from Session 18.

### A11. Tests that would break loudly (good — they're doing their job)

These fail immediately on the corresponding fix, which is the desired outcome:

| Fix | Test that breaks | Why |
|---|---|---|
| **B9** raise `JOYSTICK_MARGIN` 40 → ~72 | `useInput.test.js` — *"grabs the stick when a touch lands within the activation zone"*, *"ignores a touch that lands outside…"*, *"clamps displacement to JOYSTICK_RADIUS…"* | All three compute expected coords from `JOYSTICK_BASE_X/Y`. They import the constants rather than hardcoding, so they may **silently keep passing** — see A13. |
| **B11** add `orientation.unlock()` | `useFullscreen.test.js` — *"calls exitFullscreen only when currently fullscreen"*, *"does not call exitFullscreen when not currently fullscreen"* | New call inside `exit()`; the stub has no `unlock`, so it throws unless mocked. |
| **B10** re-evaluate orientation on change | `RotationToast.test.jsx` — *"never mounts in landscape"* | The component would now subscribe and could mount later; the assertion becomes timing-dependent. |
| **O5** joystick dead zone + response curve | `useInput.test.js` — *"clamps displacement to JOYSTICK_RADIUS and normalizes to [-1,1]"*; `predator.test.js` — *"joystick mode: velocity is proportional to stick displacement"* | Both assert a strictly linear map. A curve breaks the proportionality assertion by design. |
| **O6** platform-scaled hitbox | `predator.test.js` — *"catches a fish within HITBOX_RADIUS"*, *"does not catch a fish outside HITBOX_RADIUS"* | `resolveCatches` becomes platform-dependent; needs a platform argument or injected radius. |
| **O11** in-place mutation in hot loops | `predator.test.js` *"returns a new object and does not mutate the input"*; `particles.test.js` *"…returning a new array"*; `boids.test.js` (several purity assertions) | These assert non-mutation **explicitly**. Correct approach: keep the pure functions and their tests untouched, add separate `*InPlace` variants with their own tests — do **not** relax the existing purity tests. |
| **O15** throttle minimap | No direct test today (`renderer.test.js` has only 3 tests, none on `drawMinimap`) | Would need a new one. |
| **B14** defer `sizeCanvas` after `enter()` | No `App.jsx` integration test exists | Untested surface — see A14. |

### A12. Fixes needing entirely new tests

| Fix | What the new test should assert |
|---|---|
| **B1 / B4 / B5 / B6 / O24** compact layout + scroll | Given `innerHeight = 393`, `EndScreen` renders its compact variant, the Play Again button is in the document, and the container carries `overflow-y-auto`. Mirror `StartScreen.test.jsx`'s existing *"uses the compact layout when viewport height is under 500px"* and *"responds to a resize crossing the compact threshold"* — that pattern already works and should be the template for all five screens. Note jsdom has no layout, so **a test cannot detect actual clipping** — it can only assert the compact class/branch was chosen. Real clipping stays a device check. |
| **`useCompactViewport()` hook (O24)** | Threshold boundary (499/500/501), resize response, orientationchange response, listener cleanup on unmount. |
| **A2 / B8** visibility pause | `document.visibilityState = 'hidden'` + dispatch `visibilitychange` during play → `stop()` called, `inputPosRef` zeroed, `touchIdRef` cleared. |
| **A2** `dtSeconds` clamp | A 5-second frame gap yields a `dtSeconds` no greater than the clamp. **This is the assertion that does not exist today** — see A13. |
| **A6** offline submit queue | Offline + qualifying score → entry persisted, confirmation copy shown, no POST attempted; on `online` → exactly one POST per queued entry, queue cleared; a failed flush leaves the queue intact. |
| **A7** SW routing | If a worker lands: `/api/leaderboard` is never served from cache; `index.html` is network-first; asset requests hit the precache. Needs a SW test harness — see A14. |
| **O4** joystick rendering | `onFrameDraw` invokes the joystick draw only when `joystickRef.current.active`. |
| **O8** DPR clamp | `devicePixelRatio = 3` → canvas backing store is sized at 2×, not 3×. |
| **O10** frame cap | Two rAF fires 8 ms apart produce exactly one `update`/`draw` pair when the cap is on. |
| **B3** safe-area padding | Assert the `env(safe-area-inset-*)` styles are applied; jsdom won't compute them, so this is a "the class/style is present" test, not a geometry test. |

### A13. ⚠ Tests that would keep passing while asserting now-wrong behavior

**This is the dangerous category. Four cases, in descending severity.**

**1. `useGameLoop.test.js` — *"caps dt at 3 after a long stall"* — already
half-blind, today.** The test fires a 5-second frame gap and asserts only:

```js
const [dt] = update.mock.calls[1]
expect(dt).toBe(3)
```

It destructures **only `dt`**. The second argument — `dtSeconds = 5.0`, the value
that causes A2's entire round-destroying behavior — is delivered to `update()` and
**never asserted by any test in the suite**. The test's name says
"spiral-of-death guard" and its passing green tick implies long stalls are
handled, while the exact scenario it constructs is the one that silently eats 5
seconds off the round clock. If A2's clamp is added, **this test still passes
unchanged** — it would not verify the fix, and it would not have caught the bug.
Any work on A2 must start by extending this test to assert `dtSeconds`.

**2. `useInput.test.js` joystick geometry — passes through a `JOYSTICK_MARGIN`
change without noticing.** All three activation-zone tests import
`JOYSTICK_BASE_X`/`JOYSTICK_BASE_Y` and compute expectations from them, so
raising the margin (B9) moves both the code and the expectations together and the
suite stays green. That's correct behavior for a *tuning* change — but it means
the tests provide **zero** protection for the property B9 actually cares about:
that the activation circle clears the Android gesture strips. A test asserting
`JOYSTICK_BASE_X - JOYSTICK_ACTIVATE_RADIUS >= SAFE_EDGE_MARGIN` would encode the
real invariant; nothing like it exists.

**3. `EndScreen.test.jsx` — *"falls back to the personal-best rule when the
preview fetch fails."*** This test pins the exact behavior A6 argues is wrong
offline. It mocks a rejected fetch and asserts the submit prompt appears. After
A6, that same input should produce a *queued* submission with different copy —
but if A6 is implemented by adding an offline branch *before* the error branch,
this test's mock (a plain rejection with `navigator.onLine` still true) takes the
unchanged path and **passes while no longer describing what happens to a real
offline player**. It would need an explicit `navigator.onLine = false` sibling
test to stay meaningful.

**4. `Leaderboard.test.jsx` `qualifies()` unit tests (4 tests).** These are pure
and correct and will pass forever. But they test the function in isolation, and
A7's whole point is that `qualifies()` is only as good as the freshness of the
entries handed to it. If a cached board is ever wired into `loadPreview`, all
four tests stay green while the qualification logic silently produces wrong
answers in production. The gap is that nothing asserts *provenance* — that the
End screen's entries came from the network.

Lower-severity same-shape cases worth noting: `platform.test.js` (4 tests) pins
`maxTouchPoints > 0` and would keep passing through **O28**'s `pointer: coarse`
refinement if the refinement is added as an additional condition; and
`renderer.test.js` (3 tests) asserts nothing about `shadowBlur`, so **O9**'s glow
rewrite could change rendering cost or appearance with the suite fully green.

### A14. Currently untestable in the Vitest/jsdom setup

The setup is minimal — [vitest.config.js](frontend/vitest.config.js) is jsdom +
globals, and [src/test/setup.js](frontend/src/test/setup.js) is a single
`jest-dom` import. Everything below needs new infrastructure:

| Capability | Status | What's needed |
|---|---|---|
| `visualViewport` (**B7**) | **Absent in jsdom.** No polyfill, no stub. | A stub object with `height`/`width`/`offsetTop` and a dispatchable `resize`. Note jsdom can't simulate a keyboard at all — the test can only verify the listener wiring reacts correctly, never that the input is actually visible. |
| `document.visibilityState` (**A2/B8**) | Partially available — `AttractBackground.test.jsx` already does this successfully (*"pauses on visibilitychange (hidden) and resumes when visible again"*). | Reusable. Extract that file's approach into a shared helper rather than reimplementing. **This is the one hard case that's already solved.** |
| `screen.orientation` (**B10/B11**) | `useFullscreen.test.js` hand-stubs `window.screen.orientation` per test. | Extend the stub with `unlock` and an `orientationchange` dispatcher; promote it into `setup.js` so `RotationToast` can share it. |
| `devicePixelRatio` variation (**O8**) | Writable on jsdom's `window`, so mechanically easy. | No infra needed, but the canvas mock must record the `width`/`height` actually assigned — `renderer.test.js` already uses a context spy that could be extended. |
| Service worker registration (**A7/A8**) | **Fully absent.** No `navigator.serviceWorker`, no `Cache`, no `CacheStorage`, no `FetchEvent` in jsdom. | The largest new dependency. Options: `service-worker-mock` for unit-testing the fetch handler in isolation, or accept that SW routing is verified by real-device/Lighthouse checks only. Recommend the latter to start — mocking a whole SW environment to test a routing table is poor value. |
| `navigator.onLine` + `online`/`offline` events (**A6/A10**) | `navigator.onLine` is defined but not writable directly. | `Object.defineProperty` override plus `window.dispatchEvent(new Event('offline'))`. Straightforward; belongs in `setup.js`. |
| Background Sync (**A6**) | Absent. | Not worth mocking — test the queue's persistence and flush logic directly against `localStorage`, and treat the Sync registration as a thin untested wrapper. |
| Real layout / clipping (**B1/B4/B5**) | **Structurally impossible.** jsdom has no layout engine; `offsetHeight` is 0 and `getBoundingClientRect` returns zeros — which is exactly why `useInput.test.js` stubs it (documented in its header as "audit decision D7"). | No fix. Tests can assert *which layout branch was chosen*, never that content fits. **Verifying B1 is actually fixed requires the S23 FE, or Playwright against a real browser at a 851×393 viewport.** Worth considering a small Playwright layer for the mobile-layout fixes specifically — the `window.__hunter` dev hook already exists for exactly this purpose. |

### A15. Suggested sequencing

Independent of priority (yours to set), one ordering constraint is worth
recording: **A13's four blind-spot tests should be tightened *before* the
corresponding fixes land**, not after. Extending
`useGameLoop.test.js` to assert `dtSeconds` while it still fails is what turns
A2 from "a change we believe is right" into "a change we can prove works." Fixing
first and testing after produces a green suite that never demonstrated the bug.
