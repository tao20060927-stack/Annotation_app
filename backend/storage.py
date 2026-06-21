from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from .config import DATA_DIR, DB_PATH


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect_db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS annotations (
            image_id TEXT PRIMARY KEY,
            payload_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS current_draft_images (
            position INTEGER PRIMARY KEY,
            image_id TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )
    return conn
