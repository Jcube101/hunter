# GDD.md — Hunter: Game Design Document

> This is the canonical game design reference.
> All design decisions, parameters, and rationale live here.
> When a parameter is changed after playtesting, update this file.

---

## Concept

Hunter is a browser-based predator game built on the Boids flocking algorithm.
The player controls a predator trying to catch as many prey as possible in 60
seconds. The prey flock intelligently as a school — the emergent behavior of
the algorithm is the AI opponent. No scripted difficulty. The school teaches
the player what works through natural feedback.

**Core insight:** The player isn't fighting fish. They're fighting emergence.

---

## Themes

Two themes share identical physics. Only sprites, colors, and particles differ.

| Element | Ocean (v1) | Sky (v2) |
|---|---|---|
| Background | Dark navy `#0a1628` | Dusk gradient `#1a1a2e → #e8956d` |
| Prey | Silver/white chevron fish | Small V-shape birds |
| Predator | Canvas-drawn shark — streamlined body ellipse, dorsal fin triangle, tail fin, darker underside. Pure canvas shapes, no image files. Rotates smoothly with movement direction. | Brown eagle (larger V-shape) |
| Particles on catch | Bubble burst | Feather burst |
| Ambient | Faint caustic light pattern | Faint cloud shapes |

**v1 ships Ocean only. Sky is v2.**

---

## Game Loop

```text
Start Screen
  → Theme select (Ocean locked in v1)
  → Tap Play
  → Fullscreen + landscape lock
  → 60 second timer begins
  → Player hunts prey
  → Catch prey → score + particle burst
  → Timer hits 0:00 OR all prey caught → game ends
  → End Screen
      → Score displayed
      → Personal best check (localStorage) → "New personal best!" flourish
      → If score qualifies for top 10 → "Add to leaderboard?" prompt
  → Play Again / Menu
```

---

## Difficulty Modes

Selected on the start screen before Play is tapped. Controls fish behavior only —
shark speed is identical across all modes (3.8). The player's skill is constant;
fish intelligence scales.

| Mode | Fish Count | FLEE_WEIGHT | FLEE_RADIUS | Effect |
|---|---|---|---|---|
| Easy | 70 | 2.5 | 90px | More targets, slightly less panicky |
| Normal | 60 | 3.0 | 100px | Default behavior |
| Hardcore | 50 | 4.0 | 120px | Fewer fish, explosive scatter |

Default: Normal. Selection persisted in localStorage key `hunter_difficulty`.

Design rationale: a faster shark triggers flee earlier and harder — fish scatter
wider, making them harder to catch. Difficulty must scale fish intelligence,
not shark speed.

Fish count scales inversely with difficulty — Easy has more targets but
fish are calmer; Hardcore has fewer but each is explosively harder to catch.
The prestige condition (catching all fish) is genuinely hard on all modes.
Device-based fish count (30 mobile / 50 desktop) removed — the landscape
lock made mobile equivalent to desktop, breaking the split.

---

## Fish Sprites

Shape: compact kite/diamond (~16px long) — a sharp point at the nose (front)
and a sharp point at the rear, widest in the middle. A small separate rhombus
tail block sits just behind the rear point, drawn in a lighter colour. Straight
lines only, no eye.

Color states:
- Calm: body white/silver #E8EDF0, tail block #C0C8D0 — school not within flee radius
- Fleeing: body teal #00BCD4, tail block #00A0B4 — fish within FLEE_RADIUS of predator
- Glow on fleeing: canvas shadowBlur in teal on the body, settings-gated (default off)

---

## Predator Sprite

Angular silhouette (~56px long) — a single quadrilateral body (dark #0d1f2d),
widest toward the rear-top and tapering to a sharp nose, plus a forked V-tail
drawn as a separate sub-path with a small gap behind the body. Straight lines
only; a small red #FF4444 circle eye near the front for heading clarity is the
one non-straight shape.
Contrast via teal outline stroke (#00BCD4 at 60% opacity) and a soft teal shadow
glow (shadowBlur: 12, shadowColor: #00BCD4 at 40%) so the dark body reads at any
screen brightness while staying menacing.
Front nose tip is the catch point — aligns with SHARK_MOUTH_OFFSET = 28.

---

## Settings Panel

Accessible via gear icon on start screen, top-left corner.
Full-screen overlay, same dark navy background.

### Glow on fleeing prey (permanent, no toggle)
A bright pale-cyan halo (canvas shadowBlur 14, `#9BF6FF` — deliberately lighter
than the teal body so it reads as a distinct glow) is drawn on every fleeing fish,
unconditionally. The old glow toggle was removed in Session 15 (it wasn't worth
further UI/debug time); glow is now always on. Attract-mode background fish are the
one exception — they pass a local `glow=false` for smooth idle rendering.

### Audio
| Setting | Key | Default | Description |
|---|---|---|---|
| Sound | hunter_setting_audio | true | Ambient loop + all SFX. Off = full silence. Toggleable from the start-screen speaker icon, the Settings panel, and the pause screen. |

Audio is a single source of truth read live (see SPEC.md → Client-Side Storage):
toggling from any UI takes effect immediately everywhere. Flee-radius circle
removed — not useful enough to justify UI space.

### v2 Settings (not built yet)
- Sound volume slider

---

## Personal Best

Three separate PB keys — one per difficulty:
- hunter_pb_easy
- hunter_pb_normal
- hunter_pb_hardcore

PB compared against the key matching the difficulty just played.
The old global hunter_pb key is retired — ignored if present.
The "New personal best!" flourish triggers when the current game's score beats
the matching difficulty PB. (The leaderboard submit prompt is separate — it
triggers on top-10 qualification; see Opt-in Submit Flow.)

---

## Portrait Rotation Toast

Shown when a touch device is detected in portrait orientation.
Appears 1 second after the start screen loads.
Auto-dismisses after 4 seconds.
Shown once per session only — not on every orientation check.
Does not block any interaction.
Text: "Rotate your phone for the best experience 🔄"

---

## Start Screen Responsive Layout

The start screen adapts to constrained viewport height (landscape on phones).
When viewport height < 500px:
- Title font size reduced
- Vertical gaps and padding tightened
- All elements remain visible without scrolling
Detected via window.innerHeight on mount and on resize/orientation change.

---

## Win / Loss Conditions

- **Time limit:** 60 seconds. Game ends when timer hits zero.
- **Clear:** If all prey are caught before time runs out, game ends immediately.
  This is theoretically possible but extremely unlikely with Boids working
  correctly — treat it as a prestige condition, not an expected outcome.
- **No lives, no failure state.** The score IS the outcome. 0 is a valid score.

---

## World Design

### Size
- **World dimensions:** 1.3× viewport width × 1.2× viewport height
  (`WORLD_WIDTH_MULTIPLIER` / `WORLD_HEIGHT_MULTIPLIER`, reduced from an
  earlier 2.5×/2.0×, then 1.6×/1.4×, to leave less off-screen territory for
  fish to flee into)
- Fixed at game start based on device viewport. Does not resize mid-game.
- The world is a finite lake — large but bounded. Not infinite, not wrapping.

### Camera
- Camera follows the predator, centered on screen
- Clamped to world bounds — camera never shows outside the world
- No camera lag — 1:1 tracking with predator position

### Edge Behavior

**Prey (fish):** Soft repulsion. Fish approaching within 140px
(`EDGE_REPULSION_RADIUS`) of any world edge feel a turning force added to
their velocity, ramping up to `EDGE_REPULSION_WEIGHT` (6.0) at the wall. They
curve away naturally and, under normal conditions, never slam into walls.
Backstopped by a hard positional clamp (Session 22) that prevents a fish from
physically leaving the world regardless of velocity or whether the force
balance holds. A fish pinned against a wall by sustained predator pressure
was observed escaping off-screen before this was added; see ROADMAP.md
Session 22 Bug 3 and the Difficulty Parameters table below for the tuning
rationale.

**Predator (shark):** Hard stop. Predator velocity zeroes on world boundary
contact. Cornering fish against walls is an intentional and valid strategy.

### Minimap
- Small semi-transparent overlay, bottom-right corner
- Shows full world as a dark rectangle
- White dots = prey positions
- Colored dot (accent) = predator position
- Updates every frame
- Dimensions: ~15% of viewport width, proportional height

---

## Prey (Fish) — Boids Behavior

### Starting Conditions
- All prey spawn clustered near world center at game start
- Initial velocities randomised within ±1.5 px/frame
- School naturally drifts and disperses over time even without predator
  presence — by mid-game, remaining fish have spread naturally, creating
  organic late-game difficulty increase

### Count
| Difficulty | Prey Count |
|---|---|
| Easy | 70 |
| Normal | 60 |
| Hardcore | 50 |

Per-difficulty (`FISH_COUNT`), not per-device. See the Difficulty Modes table
above; the earlier device-based split (mobile 30 / desktop 50) was removed
once the landscape lock made mobile equivalent to desktop.

Determined once at game start. No respawning. School shrinks as prey are caught.

### Boids Forces (applied each frame per fish)

Each fish looks at neighbors within a defined radius and computes four forces:

| Force | What it does | Radius | Weight |
|---|---|---|---|
| Separation | Avoid crowding neighbors | 25px | 1.5 |
| Alignment | Match heading of neighbors | 60px | 1.0 |
| Cohesion | Drift toward group center | 100px | 1.1 |
| Flee | Escape predator | 100px | 3.0 |
| Edge repulsion | Turn away from world boundary | 140px | 6.0 |

**Flee weight (3.0) deliberately dominates all flocking forces** when the
predator is within range. This makes the school scatter convincingly on direct
approach — the player must learn to approach slowly or from angles.

### Speed
- **Base speed:** 2.5 px/frame
- **Flee speed:** up to 4.0 px/frame (speed increases proportionally as
  predator enters flee radius — closer = faster)
- Velocity clamped per frame. Fish never exceed flee speed.

### All Boids constants live in `frontend/src/constants/boids.js`. 
Never hardcode these values inline anywhere else.

---

## Predator (Shark) — Player Control

### Movement
- **Desktop:** Mouse position = predator target. Predator moves toward cursor.
- **Mobile:** Fixed virtual joystick, bottom-left corner. Thumb stays in one
  place. Shark moves in joystick direction proportional to stick displacement.
  Max displacement = JOYSTICK_RADIUS. Shark speed scales with displacement
  (0 at center, full SHARK_SPEED at rim).
- **Joystick parameters:**
  - `JOYSTICK_RADIUS`: 60px
  - `JOYSTICK_MARGIN`: 48px (from left and bottom edges; was 40, originally
    20; raised in Session 23 so the activation zone clears Android's
    gesture-navigation edge exclusion, see ROADMAP.md B9)
  - Base ring opacity: 0.4 (was 0.2)
  - Knob opacity: 0.6 (was 0.4)
- **Speed:** 3.8 px/frame. Faster than prey base speed but not flee speed —
  player must be tactical, not just fast.
- **Edge:** Hard stop at world boundary.

### Rendering
- Shark rendered at 56×28px (was 40×20px) — `SHARK_MOUTH_OFFSET` = 28px (half
  the body length) keeps the visual front tip aligned with the catch point.

### Orientation
- Predator sprite always rotates to face direction of travel
- Minimum velocity threshold before rotation updates (prevents jitter at rest)

### Catch Mechanic
- Predator has a defined **mouth point** at its front tip
- Each fish has a **hitbox radius of 12px** centered on its position
- Every frame: check Euclidean distance from mouth point to each fish center
- If distance < 12px → catch triggered
- All catch math is in CSS-pixel world space — `devicePixelRatio` is applied
  only to the canvas backing store and draw transform, never to simulation
  coordinates, so the hitbox is the same physical size on HiDPI displays

### On Catch
1. Fish removed from simulation immediately
2. Particle burst at fish position (bubbles, 8–12 particles)
3. Score counter increments and animates (+1 pop)
4. Subtle screen shake (3 frames, 4px offset)
5. Catch sound effect plays

---

## Controls & Platform

### Orientation
- Start screen renders in whatever orientation the device is in
- Tapping **Play** triggers `document.documentElement.requestFullscreen()`
  and `screen.orientation.lock('landscape')`
- Game runs in true fullscreen, landscape locked
- Android back gesture in fullscreen → intercepted → treated as **Pause**
- On fullscreen exit (deliberate or system-forced) → game pauses
- The orientation lock is released on exiting gameplay (Session 23), so it
  cannot persist onto the start screen or leaderboard
- If Fullscreen API unavailable (some iOS Safari): graceful fallback — game
  runs without lock, no error shown. "Best in landscape" nudge on start screen.
- **Standalone (installed) sessions:** pausing does not rely on fullscreen
  alone. A second, independent `visibilitychange` pause path (Session 23)
  covers the case where the back gesture backgrounds the app without firing
  `fullscreenchange`, which is possible once there is no browser chrome to
  exit. Device-verified on the S23 FE: the back gesture pauses correctly in
  standalone mode.

### Input Handling
- Touch and mouse handled separately — no unified pointer abstraction
- `touchmove` has `preventDefault()` to suppress page scroll during gameplay
- Touch events registered on the canvas element, not the window

---

## Scoring

- +1 per fish caught. No base multiplier in v1.
- Score displayed top-left during gameplay (minimal UI, no clutter)
- **Combo multiplier:** v2 feature — skip in v1

---

## Timer

- 60 seconds, counts down
- Displayed top-right during gameplay
- At 10 seconds remaining: timer text turns red and pulses
- At 0:00: game ends, end screen shown

---

## Screen Architecture

### Start Screen
- **Attract-mode background** — an autonomous Boids simulation runs behind the
  UI (see *Attract Mode* below). Purely decorative.
- Game title: **HUNTER**
- Theme selector: hidden in v1 (Ocean is the only theme; the selector, with the
  locked Sky button, is commented out and returns in v2)
- One-line tagline: *"Outmaneuver. Outsmart. Outscore."*
- **Play** button (triggers fullscreen + game start)
- **Leaderboard** button (shows global top 10 overlay)
- "Best in landscape" nudge (subtle, not a hard block)

### Game Screen
- Full canvas — world + camera system
- **Score** — top-left, minimal
- **Timer** — top-right, minimal, red pulse under 10s
- **Minimap** — bottom-right corner overlay
- No other UI during gameplay
- Canvas rendering stops completely when game ends — game loop halted,
  canvas hidden behind end screen overlay. Fish must not render behind UI.

### Pause Screen (back gesture / fullscreen exit)
- Semi-transparent overlay on canvas
- **PAUSED** text
- **Resume** and **Quit** buttons
- Timer frozen while paused

### End Screen
- **"You caught X"** — large, prominent
- **Personal best** — pulled from localStorage
- If new personal best: **"New personal best! 🎉"**
- If the score qualifies for the top 10 (see Opt-in Submit Flow): **"Add to
  leaderboard?"** → name input (max 20 chars) → Submit
- **Top 5 preview for the difficulty just played** (fetched from API)
- **Play Again** and **Menu** buttons
- **Full Leaderboard** button → shared overlay (difficulty tabs + platform toggle)

---

## Attract Mode (Start-Screen Background)

A decorative, autonomous Boids simulation that plays behind the start-screen UI,
showing the flocking algorithm in motion before the player takes control. It is
**not** a real round: no score, no timer, no leaderboard, no personal best, no
sound, and no player input.

- **Trigger:** runs whenever the start screen is visible — starts on mount, with
  no idle timer or separate state machine. Stops when the player taps Play and
  restarts on return to the start screen (quit-to-menu or reload). Pauses while
  the browser tab is hidden (`visibilitychange`) to save CPU/battery.
- **Fish:** reuse the exact game Boids math (separation / alignment / cohesion /
  edge repulsion / anchor) and flee from the autonomous predator. A lighter,
  fixed count (`ATTRACT_FISH_COUNT`), independent of `FISH_COUNT` /
  `DIFFICULTY_SETTINGS`, so difficulty rebalancing never affects the idle scene.
- **Predator AI:** semi-intelligent — seeks the nearest fish blended with a
  wandering heading (`ATTRACT_WANDER_WEIGHT` / `ATTRACT_WANDER_TURN`) so it never
  moves robotically. On proximity (`ATTRACT_CATCH_RADIUS`) it "catches" a fish,
  which **respawns elsewhere** — nothing is removed, no score, no particles.
  Confined to the visible viewport (no extended world, no camera-follow).
- **Rendering:** reuses `drawFish()` / `drawShark()` unchanged; glow is off in
  attract mode for smooth idle performance. Canvas is `pointer-events: none` and
  layered beneath all UI so it never intercepts taps.
- **Isolation:** its own `<canvas>` + `requestAnimationFrame` loop
  (`AttractBackground.jsx` + pure `game/attract.js`), completely separate from the
  real game's `useGameLoop` / `useBoids` / camera. All tuning in
  `constants/boids.js` under the `ATTRACT_*` prefix.

---

## First-Play Tutorial

Shown once only — on first ever visit (no `hunter_tutorial_seen` in localStorage).
Three-slide overlay, shown before the start screen.
Swipeable left/right, skip button top-right.

Slide 1: "Chase the school" — illustration of shark approaching fish
Slide 2: "Use the joystick" — illustration of thumb on joystick bottom-left
Slide 3: "Catch as many as you can in 60 seconds" — score counter illustration

After last slide or skip: set localStorage `hunter_tutorial_seen` = true.
Never shown again. Accessible again via "How to play" link on start screen.

---

## Leaderboard

Six separate leaderboards — three difficulties (Easy / Normal / Hardcore) each
split by platform (desktop / mobile). Scores are never compared across
difficulties (Easy 34 vs Hardcore 8 is meaningless) nor across platforms
(desktop play is meaningfully harder than mobile). Each difficulty×platform
combination has its own ranked list.

Platform is auto-detected from the player's device (touch device → mobile,
else desktop — the same `navigator.maxTouchPoints` check the rotation toast
uses, factored into `utils/platform.js`).

End screen shows the board for the difficulty just played, on the player's own
platform. Full leaderboard view has three difficulty tabs plus an independent
desktop/mobile platform toggle (view-only, session state — it never changes the
platform a score is submitted under, which is always the player's real device).
Defaults: the mode just played + the player's detected platform.

API: GET /api/leaderboard?difficulty=easy|normal|hardcore&platform=desktop|mobile
     POST /api/leaderboard — body includes required `platform`

### Storage
- **Personal best:** localStorage keys `hunter_pb_<difficulty>` (one per
  difficulty — see "Personal Best" above) — score as integer. Never sent to
  server unless player opts in.
- **Global leaderboard:** SQLite on Pi at `backend/leaderboard.db`

### Schema
```sql
CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    theme TEXT NOT NULL DEFAULT 'ocean',
    difficulty TEXT NOT NULL DEFAULT 'normal',
    platform TEXT NOT NULL,             -- 'desktop' | 'mobile' (Session 11)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
The `platform` column was added in Session 11; adding it wiped all prior scores
(no migration/backfill — platform isn't knowable for old rows).

### Opt-in Submit Flow
1. Game ends
2. The end screen fetches the player's own board (difficulty + platform, top 10)
3. **Qualification check** (Session 16): the "Add to leaderboard?" prompt shows if
   the score would make the top 10 — the board has fewer than 10 entries, or the
   score is ≥ the 10th-place score (ties qualify; the backend resolves ordering).
   This is independent of personal best — a PB that doesn't crack the top 10 shows
   no prompt; a top-10 score that isn't a PB does.
4. Player enters name (max 20 chars) → Submit
5. POST /api/leaderboard with {name, score, theme, difficulty, platform}
6. Confirmation shown — "Added!"
7. If it doesn't qualify or the player skips: nothing is sent. Ever.

Personal best (`hunter_pb_<difficulty>`, localStorage) is still tracked and still
drives the "New personal best! 🎉" flourish — that flourish and the submit prompt
are now two independent things.

The **start-screen Leaderboard button** and the end-screen "Full Leaderboard"
button both open the same overlay (difficulty tabs + view-only platform toggle).

### API Endpoints

```text
GET  /api/leaderboard?difficulty=easy|normal|hardcore&platform=desktop|mobile
                         → top 10 for that difficulty+platform, score desc
                         → both params required; missing/invalid → 400
POST /api/leaderboard    → {name, score, theme, difficulty, platform} → 201
                         → platform must be desktop|mobile, else 422
```

Top 10 per difficulty+platform (6 boards). No pagination. No delete. No auth.

POST /api/leaderboard score max is per-difficulty (Session 18), matching each
mode's fish count: Easy ≤70, Normal ≤60, Hardcore ≤50. A single global cap of
70 previously let an impossible score through on Normal/Hardcore boards.

---

## Sound Design

Real mp3 assets in `public/audio/`. Audio on/off is a single setting
(`hunter_setting_audio`, default ON), toggleable from three places that share
state: the start-screen speaker icon, the Settings panel, and the Pause screen.
Off = full silence (ambient **and** all SFX).

| Sound | Trigger | Character |
|---|---|---|
| Ambient loop | Start screen + gameplay + pause | Light atmospheric texture — suggests water without being eerie |
| Catch | Prey caught | Short satisfying pop |
| Timer end | 0:00 reached | Distinct end tone |
| Congrats | New personal best | Short celebratory sting |

The ambient loop plays on the start screen (behind attract mode) and **carries
through into gameplay seamlessly** — it is never stopped/restarted on the
start→play or play↔pause transitions, only on game-over. Audio cannot autoplay
before a user gesture (browser policy), so the first interaction anywhere on the
page unlocks it (one-time listener); a direct toggle tap also starts it.

---

## Difficulty Parameters (Tuning Reference)

All values in `frontend/src/constants/boids.js`. Adjust here and in this table
together after playtesting, and commit the change with a `tune:` prefix and a
brief reason (see CONTRIBUTING.md "Tuning Discipline").

| Parameter | v1 Value | Notes |
|---|---|---|
| `FISH_COUNT` | easy 70 / normal 60 / hardcore 50 | Per-difficulty, not per-device. The old device-based split (`FISH_COUNT_MOBILE` 30 / `FISH_COUNT_DESKTOP` 50) was removed once the landscape lock made mobile equivalent to desktop; see the Difficulty Modes table above |
| `FISH_BASE_SPEED` | 2.5 | px/frame |
| `FISH_FLEE_SPEED` | 4.0 | px/frame — at predator contact |
| `SHARK_SPEED` | 3.8 | px/frame — constant across all difficulty modes |
| `FLEE_RADIUS` | 100 | px — fish notice predator within this (tightened from 120 so the player can get closer before scatter) |
| `FLEE_WEIGHT` | 3.0 | Dominates all other forces |
| `SEPARATION_RADIUS` | 25 | px |
| `SEPARATION_WEIGHT` | 1.5 | |
| `ALIGNMENT_RADIUS` | 60 | px |
| `ALIGNMENT_WEIGHT` | 1.0 | |
| `COHESION_RADIUS` | 100 | px — wider cohesion pull (from 80) |
| `COHESION_WEIGHT` | 1.1 | Reduced post-playtest — school was too tight, easy to herd once learned |
| `ANCHOR_WEIGHT` | 0.02 | Weak center-pull — lowered from 0.05 (too strong, school clumped unnaturally) |
| `EDGE_REPULSION_RADIUS` | 140 | px from world boundary — raised from 120 (Session 22 tune: fish, 120/3.0, could be pushed off-screen by sustained Hardcore flee pressure at a corner — see ROADMAP.md Session 22) |
| `EDGE_REPULSION_WEIGHT` | 6.0 | Raised from 3.0. Must exceed the worst-case FLEE_WEIGHT (4.0, Hardcore) with real margin, since flee is a constant-strength force while edge repulsion only ramps up near the wall; a hard positional clamp in updateFish() also backstops this regardless of tuning |
| `HITBOX_RADIUS` | 12 | px — fish catch detection (raised from 8: prevents single-frame tunnelling past a fish at high closing speed) |
| `SHARK_OFFSET_MOBILE` | 80 | px above touch point. Legacy, pre-joystick; superseded by `JOYSTICK_RADIUS`/`JOYSTICK_MARGIN` (see the Predator/Player Control section above) |
| `WORLD_WIDTH_MULTIPLIER` | 1.3 | × viewport width (reduced 2.5 → 1.6 → 1.3 — less off-screen territory for fish to flee into) |
| `WORLD_HEIGHT_MULTIPLIER` | 1.2 | × viewport height (reduced 2.0 → 1.4 → 1.2 — same) |
| `GAME_DURATION` | 60 | seconds |
| `LOW_TIME_THRESHOLD` | 10 | seconds — timer turns red |
| `GRACE_PERIOD` | 2000 | ms — catch disabled at game start to prevent spawn kills |

---

## v2 Roadmap (Out of Scope for v1)

- Sky theme (eagle + murmuration)
- Combo multiplier (2× for 2 catches within 1.5s, 3× for 3, etc.)
- Option B mode — play as a fish, survive the predator
- Difficulty select on start screen (adjusts flee weight + fish speed)
- Particle variety per theme
- Background parallax layers
- Mobile haptic feedback on catch

### Meta-progression (Coins)
- Earn 1 coin per fish caught, persisted in localStorage
- Spend coins to unlock visual assists:
  - Flee radius circle: 50 coins
  - Glow on fleeing fish: 100 coins
- Once unlocked, available as settings toggles
- Adds depth without paywalls

### Visual Customisation
- Fleeing fish color options in settings: teal (default), pink, gold, red
- Purely cosmetic, no gameplay change