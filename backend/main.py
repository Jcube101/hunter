"""Hunter — FastAPI backend.

Serves the leaderboard API and (in production) the built React frontend as
static files. Single service, single port (8013), same origin as the frontend.

Architecture notes (see SPEC.md / CLAUDE.md):
  - API routes are declared FIRST; StaticFiles is mounted LAST so it never
    intercepts /api/* requests.
  - No CORS — frontend and API share one origin in production; the Vite dev
    server proxies /api during development.
  - Raw sqlite3 (stdlib), no ORM. Schema created on startup if absent.
"""

import os
import sqlite3
from contextlib import asynccontextmanager, contextmanager

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

DIFFICULTIES = {"easy", "normal", "hardcore"}

# --- Paths (resolved relative to this file, not the cwd) ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "leaderboard.db")
DIST_DIR = os.path.join(BASE_DIR, "..", "frontend", "dist")

# Score sanity cap mirrors FISH_COUNT_DESKTOP in the frontend constants.
MAX_SCORE = 50
TOP_N = 10

@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Hunter Game API", lifespan=lifespan)


# --- Database helpers -------------------------------------------------------

@contextmanager
def get_connection():
    """Context-managed sqlite3 connection with row access by column name."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    """Create the leaderboard table if it does not already exist."""
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS leaderboard (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                score       INTEGER NOT NULL,
                theme       TEXT    NOT NULL DEFAULT 'ocean',
                difficulty  TEXT    NOT NULL DEFAULT 'normal',
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def fetch_top(difficulty, limit=TOP_N):
    """Top scores for one difficulty, ordered by score desc, earliest first on a tie."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, score, theme, difficulty, created_at
            FROM leaderboard
            WHERE difficulty = ?
            ORDER BY score DESC, created_at ASC
            LIMIT ?
            """,
            (difficulty, limit),
        ).fetchall()
    return [dict(row) for row in rows]


def insert_entry(name, score, theme, difficulty):
    """Insert a single leaderboard row."""
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO leaderboard (name, score, theme, difficulty) VALUES (?, ?, ?, ?)",
            (name, score, theme, difficulty),
        )


# --- Request model ----------------------------------------------------------

class LeaderboardEntry(BaseModel):
    name: str = Field(..., min_length=1, max_length=20)
    score: int = Field(..., ge=0, le=MAX_SCORE)
    theme: str = Field(default="ocean")
    difficulty: str = Field(default="normal")

    @field_validator("name")
    @classmethod
    def strip_name(cls, v):
        stripped = v.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, v):
        # v1 ships Ocean only (see GDD.md). Reject unknown themes.
        if v != "ocean":
            raise ValueError("theme must be 'ocean' in v1")
        return v

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, v):
        v = v.lower()
        if v not in {"easy", "normal", "hardcore"}:
            raise ValueError("difficulty must be easy, normal, or hardcore")
        return v


# --- API routes (declared FIRST, before StaticFiles) ------------------------

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/leaderboard")
def get_leaderboard(difficulty: str | None = None):
    """Top 10 for one difficulty, highest first. Always an array (possibly empty).

    `difficulty` is required (easy|normal|hardcore) — each mode has its own
    ranked list; cross-difficulty comparison is meaningless. Missing or invalid
    difficulty -> 400.
    """
    if difficulty not in DIFFICULTIES:
        raise HTTPException(
            status_code=400,
            detail="difficulty query param required: easy, normal, or hardcore",
        )
    return fetch_top(difficulty)


@app.post("/api/leaderboard", status_code=201)
def post_leaderboard(entry: LeaderboardEntry):
    """Opt-in submit. Only called when a player chooses to add their score."""
    insert_entry(entry.name, entry.score, entry.theme, entry.difficulty)
    return {"status": "added"}


# --- Static files (mounted LAST — always) -----------------------------------
# Mounting before the API routes would let StaticFiles intercept /api/* -> 404.
# In dev there is no build output, so we only mount when dist/ actually exists;
# the Vite dev server serves the frontend and proxies /api here.
if os.path.isdir(DIST_DIR):
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")
