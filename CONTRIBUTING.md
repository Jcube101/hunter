# CONTRIBUTING.md — Hunter

> Coding conventions for this project.
> Solo project — this exists so future-me is consistent with past-me.

---

## General Principles

- Readable over clever. If it needs a comment to understand, simplify it first.
- No premature abstraction. Extract only when the same logic appears three times.
- Surgical edits. Change the minimum needed to achieve the goal.
- Never refactor and add features in the same commit.

---

## File Conventions

### Naming
| Thing | Convention | Example |
|---|---|---|
| React components | PascalCase | `StartScreen.jsx` |
| Hooks | camelCase, `use` prefix | `useGameLoop.js` |
| Pure JS modules | camelCase | `boids.js`, `renderer.js` |
| Constants files | camelCase | `boids.js` |
| Python files | snake_case | `main.py` |

### One responsibility per file
- `boids.js` (game/) — simulation math only. No rendering.
- `renderer.js` — drawing only. No simulation math.
- `particles.js` — particle lifecycle only.
- `camera.js` — coordinate transforms only.

If a file is doing two things, split it.

---

## JavaScript / React Conventions

### Constants
- All tuning parameters in `frontend/src/constants/boids.js`
- All theme values in `frontend/src/constants/theme.js`
- Never hardcode magic numbers inline — always reference a named constant

```js
// ✅ correct
if (distance < HITBOX_RADIUS) { ... }

// ❌ wrong
if (distance < 8) { ... }
```

### Game loop
- Game state lives in refs during the loop, not React state
- React state updated only on meaningful events (catch, timer tick, game end)
- Never call `setState` inside `requestAnimationFrame` on every frame

```js
// ✅ correct — ref during loop, state on event
const scoreRef = useRef(0)
const [displayScore, setDisplayScore] = useState(0)

// on catch:
scoreRef.current += 1
setDisplayScore(scoreRef.current)

// ❌ wrong — triggers re-render every frame
setScore(s => s + 1)  // inside rAF loop
```

### Boids functions
- Pure functions only — take state in, return new state
- No side effects inside boids update functions
- Every force is a separate function: `separation()`, `alignment()`,
  `cohesion()`, `flee()`, `edgeRepulsion()`

```js
// ✅ correct
function flee(fish, predator, radius, weight) {
  // returns a velocity vector
}

// ❌ wrong — mutates fish directly inside force function
function flee(fish, predator) {
  fish.vel.x -= ...  // side effect
}
```

### Components
- UI components only in `src/components/` — no game logic
- No canvas manipulation inside React components
- Props over context for simple parent → child data flow
- Context only for genuinely global state (mute, theme)

---

## Python Conventions

### FastAPI
- Route handlers are thin — logic in helper functions
- Raw sqlite3 only — no ORM, no SQLAlchemy
- Pydantic models for all request bodies
- Always validate and sanitise input (name length, score bounds)

```python
# ✅ correct
class LeaderboardEntry(BaseModel):
    name: str = Field(..., min_length=1, max_length=20)
    score: int = Field(..., ge=0, le=50)
    theme: str = Field(default="ocean")

# ❌ wrong
@app.post("/api/leaderboard")
def post(name: str, score: int):  # no validation
```

### Database
- Use context manager for all sqlite3 connections
- Always `CREATE TABLE IF NOT EXISTS` on startup — never assume schema exists
- No transactions needed for single-row inserts at this scale

```python
# ✅ correct
with sqlite3.connect("leaderboard.db") as conn:
    conn.execute("INSERT INTO leaderboard ...")
```

### Error handling
- Return meaningful HTTP status codes — 201 for created, 422 for validation,
  500 only for genuine unexpected errors
- Never swallow exceptions silently

---

## Git Conventions

### Commit messages

feat: add particle burst on catch

fix: shark offset not applying on first touch

tune: increase flee weight to 3.5 after playtesting

refactor: extract camera transform to camera.js

docs: update tuning table in GDD.md after playtesting

deploy: session 1 complete — core Boids simulation working

Prefixes: `feat` `fix` `tune` `refactor` `docs` `deploy` `chore`

### When to commit
- After each working phase — not mid-phase
- Before starting a new Claude Code session
- After any tuning change (so parameters are always in version history)
- Never commit broken state

### What never gets committed
- `frontend/dist/` — built output, always generated on Pi
- `backend/leaderboard.db` — live data, gitignored
- `.env` files
- `node_modules/`
- `backend/.venv/`

---

## Tuning Discipline

Boids parameters will need adjustment after playtesting.
When a parameter changes:

1. Change the value in `frontend/src/constants/boids.js`
2. Update the matching row in the tuning table in `GDD.md`
3. Commit with prefix `tune:` and a brief note on why

This keeps GDD.md accurate as the canonical reference.

---

## What Not to Do

- Don't add CORSMiddleware — frontend and API are same-origin
- Don't add Cloudflare Access — this is a public game
- Don't commit `dist/` — always build on the Pi
- Don't hardcode tuning values outside `constants/boids.js`
- Don't put game logic inside React components
- Don't call setState inside the rAF loop
- Don't add dependencies without a clear reason
  (current frontend deps: React, Vite, Tailwind — that's it; audio is plain HTML5 Audio)