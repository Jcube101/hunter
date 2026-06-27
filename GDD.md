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
| Predator | Grey shark (triangle + fin) | Brown eagle (larger V-shape) |
| Particles on catch | Bubble burst | Feather burst |
| Ambient | Faint caustic light pattern | Faint cloud shapes |

**v1 ships Ocean only. Sky is v2.**

---

## Game Loop

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

→ Personal best check (localStorage)

→ If new PB → "Add to leaderboard?" prompt

→ Play Again

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
- **World dimensions:** 2.5× viewport width × 2× viewport height
- Fixed at game start based on device viewport. Does not resize mid-game.
- The world is a finite lake — large but bounded. Not infinite, not wrapping.

### Camera
- Camera follows the predator, centered on screen
- Clamped to world bounds — camera never shows outside the world
- No camera lag — 1:1 tracking with predator position

### Edge Behavior

**Prey (fish):** Soft repulsion. Fish approaching within 80px of any world
edge feel a gentle turning force added to their velocity. They curve away
naturally. They never slam into walls. This looks organic and is consistent
with Boids behavior.

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
| Device | Prey Count |
|---|---|
| Mobile (viewport width < 768px) | 30 |
| Desktop | 50 |

Determined once at game start. No respawning. School shrinks as prey are caught.

### Boids Forces (applied each frame per fish)

Each fish looks at neighbors within a defined radius and computes four forces:

| Force | What it does | Radius | Weight |
|---|---|---|---|
| Separation | Avoid crowding neighbors | 25px | 1.5 |
| Alignment | Match heading of neighbors | 60px | 1.0 |
| Cohesion | Drift toward group center | 80px | 1.0 |
| Flee | Escape predator | 120px | 3.0 |
| Edge repulsion | Turn away from world boundary | 80px | 2.0 |

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
- **Mobile:** Touch position = target. Predator moves toward finger.
- **Offset (mobile):** Predator renders ~80px above the touch point so the
  player's finger never obscures the predator or its catch zone.
- **Speed:** 4.5 px/frame. Faster than prey base speed but not flee speed —
  player must be tactical, not just fast.
- **Edge:** Hard stop at world boundary.

### Orientation
- Predator sprite always rotates to face direction of travel
- Minimum velocity threshold before rotation updates (prevents jitter at rest)

### Catch Mechanic
- Predator has a defined **mouth point** at its front tip
- Each fish has a **hitbox radius of 8px** centered on its position
- Every frame: check Euclidean distance from mouth point to each fish center
- If distance < 8px → catch triggered

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
- If Fullscreen API unavailable (some iOS Safari): graceful fallback — game
  runs without lock, no error shown. "Best in landscape" nudge on start screen.

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
- Game title: **HUNTER**
- Theme selector: Ocean button (active, v1) / Sky button (locked, v2)
- One-line instruction: *"Chase the school. Catch as many as you can."*
- **Play** button (triggers fullscreen + game start)
- **Leaderboard** button (shows global top 10 overlay)
- "Best in landscape" nudge (subtle, not a hard block)

### Game Screen
- Full canvas — world + camera system
- **Score** — top-left, minimal
- **Timer** — top-right, minimal, red pulse under 10s
- **Minimap** — bottom-right corner overlay
- No other UI during gameplay

### Pause Screen (back gesture / fullscreen exit)
- Semi-transparent overlay on canvas
- **PAUSED** text
- **Resume** and **Quit** buttons
- Timer frozen while paused

### End Screen
- **"You caught X fish"** — large, prominent
- **Personal best** — pulled from localStorage
- If new personal best: **"New personal best! 🎉"**
- If new PB: **"Add to leaderboard?"** → name input (max 20 chars) → Submit
- **Global top 5 preview** (fetched from API)
- **Play Again** button
- **Full Leaderboard** button

---

## Leaderboard

### Storage
- **Personal best:** localStorage key `hunter_pb` — score as integer.
  Never sent to server unless player opts in.
- **Global leaderboard:** SQLite on Pi at `backend/leaderboard.db`

### Schema
```sql
CREATE TABLE leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    theme TEXT NOT NULL DEFAULT 'ocean',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Opt-in Submit Flow
1. Game ends
2. New PB detected (local check only)
3. "Add to leaderboard?" shown with name input
4. Player enters name (max 20 chars) → Submit
5. POST /api/leaderboard with {name, score, theme}
6. Confirmation shown — "Added!"
7. If not new PB or player skips: nothing is sent. Ever.

### API Endpoints
GET  /api/leaderboard         → top 10 scores [{name, score, theme, created_at}]

POST /api/leaderboard         → {name, score, theme} → 201 on success

Top 10 only. No pagination. No delete. No auth.

---

## Sound Design

Three sounds in v1. All optional — mute toggle on start screen.
Mute state persisted in localStorage key `hunter_mute`.

| Sound | Trigger | Character |
|---|---|---|
| Ambient loop | Game running | Underwater hum, subtle |
| Catch | Fish caught | Short satisfying chomp |
| Timer end | 0:00 reached | Distinct, recognisable end tone |

Use Tone.js for generated sounds or CC0 audio files.
Sounds must not autoplay before user interaction (browser policy).

---

## Difficulty Parameters (Tuning Reference)

All values in `frontend/src/constants/boids.js`. Adjust here and in this table
together after playtesting.

| Parameter | v1 Value | Notes |
|---|---|---|
| `FISH_COUNT_MOBILE` | 30 | Viewport width < 768px |
| `FISH_COUNT_DESKTOP` | 50 | |
| `FISH_BASE_SPEED` | 2.5 | px/frame |
| `FISH_FLEE_SPEED` | 4.0 | px/frame — at predator contact |
| `SHARK_SPEED` | 4.5 | px/frame |
| `FLEE_RADIUS` | 120 | px — fish notice predator within this |
| `FLEE_WEIGHT` | 3.0 | Dominates all other forces |
| `SEPARATION_RADIUS` | 25 | px |
| `SEPARATION_WEIGHT` | 1.5 | |
| `ALIGNMENT_RADIUS` | 60 | px |
| `ALIGNMENT_WEIGHT` | 1.0 | |
| `COHESION_RADIUS` | 80 | px |
| `COHESION_WEIGHT` | 1.0 | |
| `EDGE_REPULSION_RADIUS` | 80 | px from world boundary |
| `EDGE_REPULSION_WEIGHT` | 2.0 | |
| `HITBOX_RADIUS` | 8 | px — fish catch detection |
| `SHARK_OFFSET_MOBILE` | 80 | px above touch point |
| `WORLD_WIDTH_MULTIPLIER` | 2.5 | × viewport width |
| `WORLD_HEIGHT_MULTIPLIER` | 2.0 | × viewport height |
| `GAME_DURATION` | 60 | seconds |
| `LOW_TIME_THRESHOLD` | 10 | seconds — timer turns red |

---

## v2 Roadmap (Out of Scope for v1)

- Sky theme (eagle + murmuration)
- Combo multiplier (2× for 2 catches within 1.5s, 3× for 3, etc.)
- Option B mode — play as a fish, survive the predator
- Difficulty select on start screen (adjusts flee weight + fish speed)
- Particle variety per theme
- Background parallax layers
- Mobile haptic feedback on catch