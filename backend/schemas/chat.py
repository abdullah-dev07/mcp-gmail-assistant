"""Wire-format models for /chat endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class PendingAction(BaseModel):
    """A tool call (currently only `gmail_send_message`) that the model
    wanted to execute but which we hold back until the user confirms in
    the UI. Doubles as the request body for `POST /chat/confirm`."""

    tool: str
    args: dict[str, Any]


class ChatResponse(BaseModel):
    reply: str
    pendingAction: PendingAction | None = None


class ConfirmResponse(BaseModel):
    reply: str
