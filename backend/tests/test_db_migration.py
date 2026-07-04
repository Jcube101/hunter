"""D11d (Session 17 audit): init_db()'s one-time destructive migration.

Pins the documented behavior in SPEC.md/main.py: a pre-`platform` table is
dropped and recreated exactly once (old scores wiped, since platform isn't
knowable for old rows); a table that already has `platform` is left alone on
later calls. Each test points main.DB_PATH at its own throwaway sqlite file
(via monkeypatching the module global directly) so it never touches the
shared test DB the other suites use, and restores it afterward.

Run:  cd backend && .venv/bin/python -m pytest -q
"""

import sqlite3

import main as main_module


def test_init_db_is_idempotent_on_an_already_migrated_table(tmp_path):
    db_path = tmp_path / "already_migrated.db"
    original = main_module.DB_PATH
    main_module.DB_PATH = str(db_path)
    try:
        main_module.init_db()
        main_module.insert_entry("Job", 10, "ocean", "easy", "desktop")
        main_module.init_db()  # second call on an already-`platform` table -> no-op
        rows = main_module.fetch_top("easy", "desktop")
        assert len(rows) == 1
        assert rows[0]["name"] == "Job"
    finally:
        main_module.DB_PATH = original


def test_init_db_drops_and_recreates_a_pre_platform_table(tmp_path):
    db_path = tmp_path / "pre_platform.db"
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        """
        CREATE TABLE leaderboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            score INTEGER NOT NULL,
            theme TEXT NOT NULL DEFAULT 'ocean',
            difficulty TEXT NOT NULL DEFAULT 'normal',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute("INSERT INTO leaderboard (name, score) VALUES ('OldScore', 99)")
    conn.commit()
    conn.close()

    original = main_module.DB_PATH
    main_module.DB_PATH = str(db_path)
    try:
        main_module.init_db()  # detects missing `platform` col -> drop + recreate

        conn = sqlite3.connect(str(db_path))
        cols = [row[1] for row in conn.execute("PRAGMA table_info(leaderboard)").fetchall()]
        rows = conn.execute("SELECT * FROM leaderboard").fetchall()
        conn.close()

        assert "platform" in cols
        assert rows == []  # the old pre-platform row was wiped, not migrated
    finally:
        main_module.DB_PATH = original
