# SPEC.md — Hunter: Technical Specification

> Quick-reference for the tech stack, API contracts, data models, and
> infrastructure. If you're returning to this project after a gap, start here
> and GDD.md — everything else follows from these two.

---

## Stack Overview

| Layer | Technology | Why |
|---|---|---|
| Game engine | HTML Canvas (vanilla JS) | 60fps with 50+ agents requires direct canvas control — no React re-renders in the game loop |
| Frontend framework | React 18 + Vite 6 | UI shells only (start/end/pause screens) — game loop runs outside React |
| Styling | Tailwind CSS 3 | UI screens only — canvas styled directly |
| Backend | FastAPI (Python 3.11) | Standard Pi stack, serves both API and static frontend |
| Database | SQLite 3 | Single-table leaderboard, no concurrent writes, no migration complexity |
| Audio | Tone.js | Generated sounds, no audio file hosting needed |
| Server | systemd service `hunter` | Type=simple, auto-restart, same pattern as all Pi services |
| Tunnel | Cloudflare Tunnel `pi-home` | hunter.job-joseph.com → localhost:8013 |

---

## Repository Layout

```text
hunter/                              ← repo root
    frontend/
        src/
            components/              ← React UI components
                StartScreen.jsx
                EndScreen.jsx
                PauseScreen.jsx
                Minimap.jsx
                HUD.jsx              ← score + timer overlay
            hooks/
                useGameLoop.js       ← requestAnimationFrame loop
                useBoids.js          ← simulation state + update logic
                useInput.js          ← mouse + touch unified input
                useSound.js          ← Tone.js audio management
                useFullscreen.js     ← Fullscreen API + orientation lock
            constants/
                boids.js             ← ALL tuning parameters (see GDD.md)
                theme.js             ← Ocean color palette + sprite config
            game/
                boids.js             ← Boids update functions (pure JS, no React)
                renderer.js          ← Canvas draw functions
                particles.js         ← Particle system
                camera.js            ← Camera/viewport transform
            App.jsx                  ← Screen router (start → game → end)
            main.jsx
        public/
            favicon.ico
        index.html
        vite.config.js
        tailwind.config.js
        package.json
    backend/
        main.py                      ← FastAPI app
        leaderboard.db               ← SQLite (gitignored, auto-created)
        hunter.service               ← systemd unit
        requirements.txt
    CLAUDE.md
    GDD.md
    SPEC.md
    README.md
    ROADMAP.md
    CONTRIBUTING.md
    .gitignore
```

---

## Frontend Architecture

### The React / Canvas Boundary

This is the most important architectural decision in the codebase.

**React owns:** Start screen, end screen, pause overlay, HUD (score + timer),
minimap. Anything that is UI, not game.

**Canvas owns:** The entire game simulation — fish positions, shark position,
particle effects, world rendering, camera transform. The canvas element is
rendered once by React and then handed off. React never touches it again
during gameplay.

The game loop runs in `useGameLoop.js` via `requestAnimationFrame`. It reads
input from refs (not state), updates simulation, and draws to canvas — all
without triggering React re-renders. Score and timer are written to refs
during the loop and synced to React state only at meaningful intervals
(every second for timer, on each catch for score). This keeps the UI
responsive without killing frame rate.

### Vite Config

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8013'   // dev only — same-origin in production
    }
  },
  build: {
    outDir: 'dist'
  }
})
```

No PWA plugin. Hunter is not a PWA — it is a page within job-joseph.com's
world. No service worker, no manifest, no install prompt.

---

## Backend Architecture

### FastAPI — main.py structure

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import sqlite3, os

app = FastAPI()

# --- API routes FIRST ---

@app.get("/api/leaderboard")
def get_leaderboard(): ...

@app.post("/api/leaderboard", status_code=201)
def post_leaderboard(entry: LeaderboardEntry): ...

@app.get("/api/health")
def health(): return {"status": "ok"}

# --- Static files LAST — always ---
# Mounting before API routes causes StaticFiles to intercept /api/* → 404
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
```

### No CORS

Frontend and API share the same origin (hunter.job-joseph.com). No
CORSMiddleware. Do not add it.

### Python Dependencies

```text
fastapi
uvicorn[standard]
pydantic
```

No ORM. Raw sqlite3 (stdlib). No SQLAlchemy.

### systemd Unit

```ini
[Unit]
Description=Hunter Game API
After=network.target

[Service]
Type=simple
User=jcube
WorkingDirectory=/home/jcube/projects/hunter/backend
ExecStart=/home/jcube/projects/hunter/backend/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8013
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## API Contracts

### GET /api/leaderboard

Returns global top 10 scores, ordered by score descending.

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "Job",
    "score": 23,
    "theme": "ocean",
    "created_at": "2026-06-28T10:30:00"
  }
]
```

Always returns an array. Empty array if no entries yet. Max 10 items.

---

### POST /api/leaderboard

Submit an opt-in leaderboard entry. Only called when player explicitly
chooses to add their score.

**Request body:**
```json
{
  "name": "Job",
  "score": 23,
  "theme": "ocean"
}
```

**Validation:**
- `name`: string, 1–20 characters, stripped of leading/trailing whitespace
- `score`: integer, 0–50 (capped at FISH_COUNT_DESKTOP as sanity check)
- `theme`: enum — `"ocean"` only in v1

**Response 201:**
```json
{ "status": "added" }
```

**Response 422:** Pydantic validation failure (malformed request).

No authentication. No rate limiting in v1.

---

### GET /api/health

```json
{ "status": "ok" }
```

Used for manual verification after deploy and external monitoring (e.g. UptimeRobot).

---

## Data Model

### leaderboard table

```sql
CREATE TABLE IF NOT EXISTS leaderboard (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    score       INTEGER NOT NULL,
    theme       TEXT    NOT NULL DEFAULT 'ocean',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Single table. No migrations framework — schema created on startup if not
exists. If schema needs to change in future: drop and recreate (leaderboard
data is not critical).

---

## Client-Side Storage

| Key | Type | Value | When set |
|---|---|---|---|
| `hunter_pb` | localStorage | integer | On game end if score > current PB |
| `hunter_mute` | localStorage | `"true"` / `"false"` | On mute toggle |

No cookies. No session storage. No IndexedDB.

---

## Infrastructure

| Item | Value |
|---|---|
| Pi hostname | jobpi |
| Pi user | jcube |
| Pi local IP | 192.168.1.63 |
| Project path | ~/projects/hunter/ |
| Port | 8013 |
| Service name | hunter |
| Public URL | https://hunter.job-joseph.com |
| Tunnel | pi-home (41ef69c7-77c9-449c-9c0b-5cfb09a18dae) |
| Tunnel config | ~/.cloudflared/config.yml |
| Auth | None — public game, no Cloudflare Access |

---

## Development Environment

### Pi (runtime)
- Python 3.11
- venv at `backend/.venv`
- Node.js (for build only — `npm run build` during deploy)

### Windows (development)
- VS Code or Cursor via local IP `192.168.1.63`
- Node.js + npm for frontend dev server
- `npm run dev` at localhost:5173 with Vite proxy → Pi backend

### Workflow

```text
Write code on Pi (VS Code)
  → git push
  → git pull on Windows (optional)
  → npm run build (frontend)
  → sudo systemctl restart hunter
  → curl /api/health to verify
```

---

## Browser Support

| Browser | Support |
|---|---|
| Android Chrome | Primary target |
| Desktop Chrome | Full support |
| Desktop Firefox | Full support |
| iOS Safari | Supported with fullscreen fallback (orientation lock unavailable) |
| Other | Best effort |

Fullscreen API + `screen.orientation.lock()` not available on all iOS Safari
versions. Game runs without it — just not landscape-locked. No error shown.