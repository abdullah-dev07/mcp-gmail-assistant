"""Centralised app configuration.

One Pydantic `Settings` instance reads every env var the backend cares about
at import time, validates types, and fails fast with a clear message if a
required value is missing. Anywhere in the codebase that used to do
`os.getenv("FOO")` should now do `from config import settings` and read
`settings.foo`.

The `.env` file lives next to this module (i.e. inside `backend/`) so the
config is found regardless of where the process is launched from
(`uvicorn` from repo root, Docker `CMD`, `make dev`, CI, etc.).
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

_THIS_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_THIS_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Don't blow up if the .env has unrelated / future keys.
        extra="ignore",
    )

    # ── Environment flag ────────────────────────────────────────────────
    # "prod" => cookies are SameSite=None; Secure (required for cross-site
    # auth between Vercel and Render). Anything else => SameSite=Lax for
    # friction-free localhost dev.
    env: Literal["dev", "prod"] = "dev"

    # ── Gemini ──────────────────────────────────────────────────────────
    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"

    # ── Google OAuth ────────────────────────────────────────────────────
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str

    # ── URLs / CORS ─────────────────────────────────────────────────────
    frontend_base_url: str = "http://localhost:3000"
    # Comma-separated list of additional origins (production frontend URLs
    # like https://mailmind.vercel.app). localhost:3000 is always allowed.
    frontend_origin: str = ""

    # ── API gate ────────────────────────────────────────────────────────
    # Empty disables the X-API-Key middleware (handy for `make dev`).
    api_key: str = ""

    # ── Sessions / encryption ───────────────────────────────────────────
    session_jwt_secret: str
    token_encryption_key: str

    # ── SQLite ──────────────────────────────────────────────────────────
    db_path: str = "./mailmind.db"

    # ── Derived helpers ─────────────────────────────────────────────────
    @property
    def is_prod(self) -> bool:
        return self.env == "prod"

    @property
    def cors_origins(self) -> list[str]:
        extras = [o.strip() for o in self.frontend_origin.split(",") if o.strip()]
        return ["http://localhost:3000", *extras]


# Single, module-level instance. Importing this module triggers env-var
# loading + validation, so a misconfigured deploy fails at startup rather
# than on the first request.
settings = Settings()  # type: ignore[call-arg]
