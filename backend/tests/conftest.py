"""Pytest fixtures for the leaderboard API.

Every test runs against a throwaway SQLite DB (HUNTER_DB_PATH) so the real
leaderboard.db is never touched, and the table is emptied before each test.
"""

import os
import pathlib
import sys
import tempfile

# Point the app at a throwaway DB and put backend/ on the path BEFORE importing it.
_BACKEND = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))
os.environ["HUNTER_DB_PATH"] = os.path.join(tempfile.mkdtemp(prefix="hunter-test-"), "test.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


@pytest.fixture()
def client():
    main.init_db()
    with main.get_connection() as conn:
        conn.execute("DELETE FROM leaderboard")
    with TestClient(main.app) as c:
        yield c


def valid_entry(**overrides):
    """A valid POST body; override individual fields per test."""
    body = {
        "name": "Job",
        "score": 20,
        "theme": "ocean",
        "difficulty": "easy",
        "platform": "desktop",
    }
    body.update(overrides)
    return body
