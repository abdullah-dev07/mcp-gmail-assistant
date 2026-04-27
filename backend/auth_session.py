"""Session handling.

The session cookie is a JWT whose only claim is `sub = user_id`. The actual
Gmail refresh token lives in SQLite (see db.py) and is pulled on demand.

Why a JWT and not a random opaque token:
  * no extra DB round-trip just to resolve "is this cookie valid?"
  * rotating SESSION_JWT_SECRET instantly logs everyone out
"""

from __future__ import annotations

import time

import jwt
from fastapi import Cookie, Depends, HTTPException, Response

from config import settings
from db import get_refresh_token

_SECRET = settings.session_jwt_secret

_ALG = "HS256"
_COOKIE_NAME = "mm_session"
_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days

# In production (Vercel <-> Render = cross-site) the browser will only send
# the cookie back if it's SameSite=None; Secure. For local http://localhost
# dev, fall back to Lax so you don't need HTTPS to log in.
_COOKIE_SAMESITE = "none" if settings.is_prod else "lax"
_COOKIE_SECURE = settings.is_prod


def issue_session_cookie(resp: Response, user_id: str) -> None:
    now = int(time.time())
    token = jwt.encode(
        {"sub": user_id, "iat": now, "exp": now + _TTL_SECONDS},
        _SECRET,
        algorithm=_ALG,
    )
    resp.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        max_age=_TTL_SECONDS,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE,
        path="/",
    )


def clear_session_cookie(resp: Response) -> None:
    resp.delete_cookie(
        _COOKIE_NAME,
        path="/",
        samesite=_COOKIE_SAMESITE,
        secure=_COOKIE_SECURE,
    )


def _decode(token: str) -> str | None:
    try:
        payload = jwt.decode(token, _SECRET, algorithms=[_ALG])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def current_user_id(mm_session: str | None = Cookie(default=None)) -> str:
    """FastAPI dependency: 401 unless a valid session cookie is present."""
    if not mm_session:
        raise HTTPException(status_code=401, detail="Not connected to Gmail")
    user_id = _decode(mm_session)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session")
    return user_id


def current_refresh_token(user_id: str = Depends(current_user_id)) -> str:
    """Dependency returning the caller's Gmail refresh token. 401 if their
    row disappeared (e.g. they logged out, or the Fernet key was rotated)."""
    tok = get_refresh_token(user_id)
    if not tok:
        raise HTTPException(status_code=401, detail="Gmail connection missing")
    return tok
