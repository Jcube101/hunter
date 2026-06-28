# Hunter

🔴 **Live at [hunter.job-joseph.com](https://hunter.job-joseph.com)**

**Hunter** is a browser-based predator game built on the Boids flocking algorithm. You control a shark hunting a school of fish, and your only goal is to catch as many as you can in 60 seconds. There's no scripted AI and no difficulty curve — the school's intelligence is pure emergence. Approach head-on and it scatters; learn to herd, corner, and cut angles, and the fish teach you how to hunt them. You're not fighting fish. You're fighting emergence.

🎮 **Play it live:** [hunter.job-joseph.com](https://hunter.job-joseph.com)

---

## Features

- 🎯 Emergent Boids AI — the school flees, regroups, and corners itself; no scripted difficulty
- 📱 Mobile + desktop — drag-to-steer touch control and mouse, with fullscreen + landscape lock
- 🔊 Generated audio — underwater ambience plus catch and game-over cues (Tone.js), with a mute toggle
- 🏆 Global leaderboard — opt-in score submit and top-10 standings (FastAPI + SQLite)
- ⏱️ 60-second runs with a locally-saved personal best

---

## Tech Stack

- **Frontend** — React 18 + Vite 6 for the UI shells (start, end, pause, HUD), with the entire game simulation running on a raw HTML Canvas at 60fps. React renders the canvas once and hands it off; the game loop never triggers a re-render. Tailwind CSS 4 styles the UI screens.
- **Backend** — FastAPI (Python 3.11) serving both the static frontend build and a small leaderboard API, backed by SQLite. Hosted on a Raspberry Pi behind a Cloudflare Tunnel — no Nginx, no external host.
- **AI** — There is no model and no scripting. The "opponent" is the [Boids](https://en.wikipedia.org/wiki/Boids) flocking algorithm: each fish follows four simple local rules (separation, alignment, cohesion, and flee), and intelligent group behavior emerges on its own.

---

## Running Locally

### Frontend (dev server)

```bash
cd frontend
npm install
npm run dev        # Vite dev server at localhost:5173
```

The Vite dev server proxies `/api` → `localhost:8013`, so run the backend alongside it.

### Backend (API + static serving)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8013
```

In production the frontend is served from the same origin as the API, so no `VITE_API_URL` is needed.

---

## Deploying to the Pi

Hunter runs as a `systemd` service (`hunter`) on the Pi, with FastAPI serving the built frontend as static files. A Cloudflare Tunnel routes `hunter.job-joseph.com` → `localhost:8013`.

**First deploy only:**

```bash
cd ~/projects/hunter/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
sudo cp /home/jcube/projects/hunter/backend/hunter.service /etc/systemd/system/hunter.service
sudo systemctl daemon-reload
sudo systemctl enable hunter
sudo systemctl start hunter
```

**After a frontend change:**

```bash
cd ~/projects/hunter/frontend
npm run build
sudo systemctl restart hunter
```

**After a backend change:**

```bash
sudo systemctl restart hunter
```

**Verify:**

```bash
sudo systemctl status hunter
curl https://hunter.job-joseph.com/api/leaderboard
curl -s https://hunter.job-joseph.com | grep "<title>"
```

---

## License

MIT
