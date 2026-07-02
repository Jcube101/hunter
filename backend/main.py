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
PLATFORMS = {"desktop", "mobile"}

# --- Paths (resolved relative to this file, not the cwd) ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "leaderboard.db")
DIST_DIR = os.path.join(BASE_DIR, "..", "frontend", "dist")

# Score sanity cap = the largest fish count across difficulties (Easy = 70).
MAX_SCORE = 70
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
    """Create the leaderboard table if absent.

    Session 11 added a required `platform` column and split each difficulty board
    into desktop/mobile. Platform is not comparable across old rows, so this is a
    clean reset: a pre-platform table is dropped once (wiping old scores) and
    recreated. Idempotent afterward — a table that already has `platform` is left
    untouched.
    """
    with get_connection() as conn:
        cols = [row[1] for row in conn.execute("PRAGMA table_info(leaderboard)").fetchall()]
        if cols and "platform" not in cols:
            conn.execute("DROP TABLE leaderboard")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS leaderboard (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                score       INTEGER NOT NULL,
                theme       TEXT    NOT NULL DEFAULT 'ocean',
                difficulty  TEXT    NOT NULL DEFAULT 'normal',
                platform    TEXT    NOT NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def fetch_top(difficulty, platform, limit=TOP_N):
    """Top scores for one difficulty+platform, score desc, earliest first on a tie."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, score, theme, difficulty, platform, created_at
            FROM leaderboard
            WHERE difficulty = ? AND platform = ?
            ORDER BY score DESC, created_at ASC
            LIMIT ?
            """,
            (difficulty, platform, limit),
        ).fetchall()
    return [dict(row) for row in rows]


def insert_entry(name, score, theme, difficulty, platform):
    """Insert a single leaderboard row."""
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO leaderboard (name, score, theme, difficulty, platform) "
            "VALUES (?, ?, ?, ?, ?)",
            (name, score, theme, difficulty, platform),
        )


# --- Request model ----------------------------------------------------------

class LeaderboardEntry(BaseModel):
    name: str = Field(..., min_length=1, max_length=20)
    score: int = Field(..., ge=0, le=MAX_SCORE)
    theme: str = Field(default="ocean")
    difficulty: str = Field(default="normal")
    platform: str  # required — 'desktop' or 'mobile' (validated below)

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
        if v not in DIFFICULTIES:
            raise ValueError("difficulty must be easy, normal, or hardcore")
        return v

    @field_validator("platform")
    @classmethod
    def validate_platform(cls, v):
        # Reject anything but the two allowed values (no silent coercion) -> 422.
        v = v.lower()
        if v not in PLATFORMS:
            raise ValueError("platform must be desktop or mobile")
        return v


# --- API routes (declared FIRST, before StaticFiles) ------------------------

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/leaderboard")
def get_leaderboard(difficulty: str | None = None, platform: str | None = None):
    """Top 10 for one difficulty+platform, highest first. Always an array.

    Both params are required. Each of the three difficulty boards is split by
    platform (desktop/mobile) because desktop play is harder — scores across
    platforms aren't comparable. Missing or invalid difficulty/platform -> 400.
    """
    if difficulty not in DIFFICULTIES:
        raise HTTPException(
            status_code=400,
            detail="difficulty query param required: easy, normal, or hardcore",
        )
    if platform not in PLATFORMS:
        raise HTTPException(
            status_code=400,
            detail="platform query param required: desktop or mobile",
        )
    return fetch_top(difficulty, platform)


@app.post("/api/leaderboard", status_code=201)
def post_leaderboard(entry: LeaderboardEntry):
    """Opt-in submit. Only called when a player chooses to add their score."""
    insert_entry(entry.name, entry.score, entry.theme, entry.difficulty, entry.platform)
    return {"status": "added"}


# --- Static files (mounted LAST — always) -----------------------------------
# Mounting before the API routes would let StaticFiles intercept /api/* -> 404.
# In dev there is no build output, so we only mount when dist/ actually exists;
# the Vite dev server serves the frontend and proxies /api here.
if os.path.isdir(DIST_DIR):
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")
