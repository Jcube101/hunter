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
import re
import sqlite3
import unicodedata
from contextlib import asynccontextmanager, contextmanager

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator, model_validator

DIFFICULTIES = {"easy", "normal", "hardcore"}
PLATFORMS = {"desktop", "mobile"}

# --- Paths (resolved relative to this file, not the cwd) ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# HUNTER_DB_PATH lets tests point at a throwaway DB; prod uses the default.
DB_PATH = os.environ.get("HUNTER_DB_PATH", os.path.join(BASE_DIR, "leaderboard.db"))
# HUNTER_DIST_DIR lets tests point at a throwaway fixture dir (so the
# StaticFiles-mounted-last invariant can be tested without touching the real
# production frontend/dist/); prod uses the default.
DIST_DIR = os.environ.get("HUNTER_DIST_DIR", os.path.join(BASE_DIR, "..", "frontend", "dist"))

# Per-difficulty score ceiling = that difficulty's fish count (mirrors
# frontend/src/constants/boids.js FISH_COUNT). A score above a mode's own fish
# count is impossible and would otherwise be silently accepted by a single
# global cap (Session 18 fix — see SPEC.md).
MAX_SCORE_BY_DIFFICULTY = {"easy": 70, "normal": 60, "hardcore": 50}
# Top-level Field ceiling (the loosest of the three); the real per-difficulty
# check runs in LeaderboardEntry.check_score_ceiling below.
MAX_SCORE = max(MAX_SCORE_BY_DIFFICULTY.values())
TOP_N = 10

# --- Display-name safety ----------------------------------------------------
# Public, unauthenticated submit -> treat the name as untrusted. The React client
# escapes on render (no XSS) and all SQL is parameterized (no injection), but we
# still sanitize server-side as defense-in-depth and for clean data:
#   - an early length ceiling rejects oversized payloads before we process them
#   - control chars, bidi overrides (e.g. U+202E RLO), and zero-width/BOM chars
#     are stripped (they enable display spoofing and broken layout, never a
#     legitimate display name)
#   - Unicode is normalized (NFC) and internal whitespace collapsed
#   - the real 1..MAX_NAME_LENGTH limit is enforced AFTER cleaning
MAX_NAME_LENGTH = 20
NAME_RAW_CEILING = 200  # reject absurd payloads before cleaning


def _is_unsafe_name_char(ch):
    """True for characters never valid in a public display name."""
    o = ord(ch)
    return (
        o < 0x20                      # C0 control chars (incl. tab/newline/NUL)
        or 0x7F <= o <= 0x9F          # DEL + C1 controls
        or 0x200B <= o <= 0x200F      # zero-width space/joiners + LRM/RLM
        or 0x202A <= o <= 0x202E      # bidi embeddings/overrides (LRE..RLO)
        or 0x2066 <= o <= 0x2069      # bidi isolates (LRI..PDI)
        or o == 0x2060                # word joiner
        or o == 0xFEFF                # BOM / zero-width no-break space
    )


def clean_name(raw):
    """Canonicalize + strip unsafe/invisible chars + collapse whitespace + trim."""
    text = unicodedata.normalize("NFC", raw)
    text = "".join(ch for ch in text if not _is_unsafe_name_char(ch))
    text = re.sub(r"\s+", " ", text).strip()
    return text


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
    # NAME_RAW_CEILING is an early guard against oversized payloads; the real
    # 1..MAX_NAME_LENGTH limit is enforced after cleaning in the validator.
    name: str = Field(..., min_length=1, max_length=NAME_RAW_CEILING)
    score: int = Field(..., ge=0, le=MAX_SCORE)
    theme: str = Field(default="ocean")
    difficulty: str = Field(default="normal")
    platform: str  # required — 'desktop' or 'mobile' (validated below)

    @field_validator("name")
    @classmethod
    def clean_and_check_name(cls, v):
        cleaned = clean_name(v)
        if not cleaned:
            raise ValueError("name must not be blank")
        if len(cleaned) > MAX_NAME_LENGTH:
            raise ValueError(f"name must be at most {MAX_NAME_LENGTH} characters")
        return cleaned

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

    @model_validator(mode="after")
    def check_score_ceiling(self):
        # Runs after every field validator, so self.difficulty is already
        # normalized/validated. Per-difficulty ceiling (Session 18 fix): a
        # score above a mode's own fish count is impossible.
        ceiling = MAX_SCORE_BY_DIFFICULTY.get(self.difficulty, MAX_SCORE)
        if self.score > ceiling:
            raise ValueError(f"score must be at most {ceiling} for difficulty '{self.difficulty}'")
        return self


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

    Normalized to lowercase before validation (Session 18 fix) so this behaves
    the same as the POST body's difficulty/platform fields, which already
    lowercase — previously `?difficulty=EASY` was rejected as invalid while
    POST {"difficulty": "EASY"} was accepted.
    """
    if difficulty is not None:
        difficulty = difficulty.lower()
    if platform is not None:
        platform = platform.lower()
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
