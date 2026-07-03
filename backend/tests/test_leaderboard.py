"""Safety + validation tests for the leaderboard API, focused on the untrusted
name-entry path (the submit endpoint is public and unauthenticated).

Run:  cd backend && .venv/bin/python -m pytest -q
"""

from conftest import valid_entry


# --- Name: acceptance + normalization --------------------------------------

def test_valid_name_accepted_and_returned(client):
    r = client.post("/api/leaderboard", json=valid_entry(name="Job"))
    assert r.status_code == 201
    board = client.get("/api/leaderboard?difficulty=easy&platform=desktop").json()
    assert [e["name"] for e in board] == ["Job"]


def test_name_is_trimmed(client):
    client.post("/api/leaderboard", json=valid_entry(name="   Job   "))
    board = client.get("/api/leaderboard?difficulty=easy&platform=desktop").json()
    assert board[0]["name"] == "Job"


def test_internal_whitespace_collapsed(client):
    client.post("/api/leaderboard", json=valid_entry(name="Big    Bob"))
    board = client.get("/api/leaderboard?difficulty=easy&platform=desktop").json()
    assert board[0]["name"] == "Big Bob"


def test_name_exactly_max_length_accepted(client):
    r = client.post("/api/leaderboard", json=valid_entry(name="A" * 20))
    assert r.status_code == 201


# --- Name: rejection --------------------------------------------------------

def test_blank_name_rejected(client):
    assert client.post("/api/leaderboard", json=valid_entry(name="")).status_code == 422


def test_whitespace_only_name_rejected(client):
    assert client.post("/api/leaderboard", json=valid_entry(name="    ")).status_code == 422


def test_invisible_only_name_rejected(client):
    # Zero-width + BOM only -> cleans to empty -> rejected.
    assert client.post("/api/leaderboard", json=valid_entry(name="​‌﻿")).status_code == 422


def test_name_too_long_rejected(client):
    assert client.post("/api/leaderboard", json=valid_entry(name="A" * 21)).status_code == 422


def test_oversized_payload_rejected(client):
    # Above the raw ceiling -> rejected before cleaning.
    assert client.post("/api/leaderboard", json=valid_entry(name="A" * 500)).status_code == 422


# --- Name: sanitization of unsafe characters --------------------------------

def test_control_chars_stripped(client):
    client.post("/api/leaderboard", json=valid_entry(name="a\nb\tc\r"))
    board = client.get("/api/leaderboard?difficulty=easy&platform=desktop").json()
    assert board[0]["name"] == "abc"


def test_bidi_override_stripped(client):
    # U+202E RIGHT-TO-LEFT OVERRIDE would visually reverse the name — stripped.
    client.post("/api/leaderboard", json=valid_entry(name="ab‮cd"))
    board = client.get("/api/leaderboard?difficulty=easy&platform=desktop").json()
    assert board[0]["name"] == "abcd"


def test_zero_width_chars_stripped(client):
    client.post("/api/leaderboard", json=valid_entry(name="a​b‌c"))
    board = client.get("/api/leaderboard?difficulty=easy&platform=desktop").json()
    assert board[0]["name"] == "abc"


def test_null_byte_stripped(client):
    client.post("/api/leaderboard", json=valid_entry(name="a\x00b"))
    board = client.get("/api/leaderboard?difficulty=easy&platform=desktop").json()
    assert board[0]["name"] == "ab"


# --- Name: injection / XSS are neutralized ----------------------------------

def test_sql_injection_name_is_stored_literally(client):
    # Parameterized insert: the quote/semicolon must NOT break the query or drop
    # the table. Kept under the length limit so it reaches the DB layer.
    payload = "x'); DROP--"
    assert client.post("/api/leaderboard", json=valid_entry(name=payload)).status_code == 201
    # A second insert still works -> table intact -> injection did not execute.
    assert client.post("/api/leaderboard", json=valid_entry(name="After", score=5)).status_code == 201
    board = client.get("/api/leaderboard?difficulty=easy&platform=desktop").json()
    names = {e["name"] for e in board}
    assert payload in names and "After" in names


def test_html_is_stored_raw_not_encoded(client):
    # The server stores the raw string; XSS is prevented at render time (React
    # auto-escapes). Angle brackets are legitimate name characters, so kept.
    client.post("/api/leaderboard", json=valid_entry(name="<b>hi</b>"))
    board = client.get("/api/leaderboard?difficulty=easy&platform=desktop").json()
    assert board[0]["name"] == "<b>hi</b>"


# --- Score / enum validation ------------------------------------------------

def test_score_bounds(client):
    assert client.post("/api/leaderboard", json=valid_entry(score=-1)).status_code == 422
    assert client.post("/api/leaderboard", json=valid_entry(score=71)).status_code == 422
    assert client.post("/api/leaderboard", json=valid_entry(score=0)).status_code == 201
    assert client.post("/api/leaderboard", json=valid_entry(score=70)).status_code == 201


def test_score_must_be_integer(client):
    assert client.post("/api/leaderboard", json=valid_entry(score="abc")).status_code == 422


def test_platform_required_and_validated(client):
    body = valid_entry()
    body.pop("platform")
    assert client.post("/api/leaderboard", json=body).status_code == 422
    assert client.post("/api/leaderboard", json=valid_entry(platform="switch")).status_code == 422
    # Uppercase is normalized, not rejected.
    assert client.post("/api/leaderboard", json=valid_entry(platform="DESKTOP")).status_code == 201


def test_difficulty_validated_and_normalized(client):
    assert client.post("/api/leaderboard", json=valid_entry(difficulty="extreme")).status_code == 422
    assert client.post("/api/leaderboard", json=valid_entry(difficulty="EASY")).status_code == 201


def test_theme_validated(client):
    assert client.post("/api/leaderboard", json=valid_entry(theme="sky")).status_code == 422


# --- GET validation + board isolation ---------------------------------------

def test_get_requires_valid_params(client):
    assert client.get("/api/leaderboard").status_code == 400
    assert client.get("/api/leaderboard?difficulty=easy").status_code == 400
    assert client.get("/api/leaderboard?difficulty=easy&platform=switch").status_code == 400


def test_get_returns_top_10_sorted_desc(client):
    for i in range(12):
        client.post("/api/leaderboard", json=valid_entry(name=f"P{i}", score=i))
    board = client.get("/api/leaderboard?difficulty=easy&platform=desktop").json()
    assert len(board) == 10
    scores = [e["score"] for e in board]
    assert scores == sorted(scores, reverse=True)
    assert scores[0] == 11 and scores[-1] == 2  # top 10 of 0..11


def test_boards_are_isolated_by_difficulty_and_platform(client):
    client.post("/api/leaderboard", json=valid_entry(name="D", difficulty="easy", platform="desktop"))
    client.post("/api/leaderboard", json=valid_entry(name="M", difficulty="easy", platform="mobile"))
    client.post("/api/leaderboard", json=valid_entry(name="N", difficulty="normal", platform="desktop"))
    ed = client.get("/api/leaderboard?difficulty=easy&platform=desktop").json()
    em = client.get("/api/leaderboard?difficulty=easy&platform=mobile").json()
    assert [e["name"] for e in ed] == ["D"]
    assert [e["name"] for e in em] == ["M"]
