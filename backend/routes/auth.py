from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow

from auth_session import (
    clear_session_cookie,
    current_user_id,
    issue_session_cookie,
)
from config import settings
from db import delete_user, get_email, upsert_user

router = APIRouter()

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]


def _flow() -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri,
        autogenerate_code_verifier=False,
    )


@router.get("/login")
def login():
    flow = _flow()
    auth_url, _state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        # Force Google to return a refresh_token every time. Without this,
        # Google only emits one on a user's very first consent, and you get
        # blank refresh_tokens on reconnect.
        prompt="consent",
    )
    return RedirectResponse(auth_url)


@router.get("/callback")
async def callback(code: str):
    flow = _flow()
    # google-auth-oauthlib logs a warning when we don't validate scopes
    # 1-for-1 (Google sometimes normalises them); that's fine here.
    flow.fetch_token(code=code)
    creds = flow.credentials

    if not creds.refresh_token:
        raise HTTPException(
            status_code=400,
            detail=(
                "Google did not return a refresh token. Revoke Mailmind's "
                "access at https://myaccount.google.com/permissions and try "
                "again."
            ),
        )

    # Learn which Google account this is so we can key rows by email
    # instead of minting a fresh user_id on every reconnect.
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {creds.token}"},
        )
        r.raise_for_status()
        email = r.json().get("email")

    if not email:
        raise HTTPException(status_code=502, detail="Google did not return an email address")

    user_id = upsert_user(email=email, refresh_token=creds.refresh_token)

    resp = RedirectResponse(url=f"{settings.frontend_base_url}/?connected=1")
    issue_session_cookie(resp, user_id)
    return resp


@router.get("/me")
def me(user_id: str = Depends(current_user_id)):
    return {"userId": user_id, "email": get_email(user_id)}


@router.post("/logout")
def logout(response: Response, user_id: str = Depends(current_user_id)):
    delete_user(user_id)
    clear_session_cookie(response)
    return {"ok": True}
