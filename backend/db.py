"""Per-user refresh-token storage.

Schema is intentionally minimal: one row per connected Google account,
keyed by a UUID we generate ourselves. The refresh token is encrypted
at rest with Fernet so a DB dump can't be replayed against Gmail.
"""

from __future__ import annotations

import sqlite3
import threading
import time
import uuid

from cryptography.fernet import Fernet, InvalidToken

from config import settings

_DB_PATH = settings.db_path
_FERNET = Fernet(settings.token_encryption_key.encode())

_LOCK = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(_DB_PATH, check_same_thread=False)
    c.execute("PRAGMA journal_mode=WAL;")
    return c


def init_db() -> None:
    with _LOCK, _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id     TEXT PRIMARY KEY,
                email       TEXT NOT NULL UNIQUE,
                refresh_enc BLOB NOT NULL,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL
            );
            """
        )


def upsert_user(email: str, refresh_token: str) -> str:
    """Insert or update by email. Returns the stable user_id."""
    enc = _FERNET.encrypt(refresh_token.encode())
    now = int(time.time())
    with _LOCK, _conn() as c:
        row = c.execute(
            "SELECT user_id FROM users WHERE email = ?", (email,)
        ).fetchone()
        if row:
            user_id = row[0]
            c.execute(
                "UPDATE users SET refresh_enc=?, updated_at=? WHERE user_id=?",
                (enc, now, user_id),
            )
        else:
            user_id = str(uuid.uuid4())
            c.execute(
                "INSERT INTO users (user_id, email, refresh_enc, created_at, updated_at) "
                "VALUES (?,?,?,?,?)",
                (user_id, email, enc, now, now),
            )
        return user_id


def get_refresh_token(user_id: str) -> str | None:
    with _LOCK, _conn() as c:
        row = c.execute(
            "SELECT refresh_enc FROM users WHERE user_id=?", (user_id,)
        ).fetchone()
    if not row:
        return None
    try:
        return _FERNET.decrypt(row[0]).decode()
    except InvalidToken:
        # Fernet key was rotated without re-connecting: treat as disconnected.
        return None


def get_email(user_id: str) -> str | None:
    with _LOCK, _conn() as c:
        row = c.execute(
            "SELECT email FROM users WHERE user_id=?", (user_id,)
        ).fetchone()
    return row[0] if row else None


def delete_user(user_id: str) -> None:
    with _LOCK, _conn() as c:
        c.execute("DELETE FROM users WHERE user_id=?", (user_id,))
