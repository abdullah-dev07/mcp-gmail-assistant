"""Wire-format models for /emails endpoints."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class SendEmailRequest(BaseModel):
    to: EmailStr
    subject: str = Field(..., min_length=1, max_length=998)
    body: str = Field(..., min_length=1)
    # Accepted for forward-compat with threaded replies; the MCP send tool
    # currently creates a new thread regardless.
    inReplyTo: str | None = None


class SendEmailResponse(BaseModel):
    ok: bool = True
    detail: str


class EmailSummary(BaseModel):
    """One row in the inbox list. `from` is reserved in Python, so the
    field is named `sender` and aliased back to `from` on the wire."""

    id: str
    sender: str = Field(..., alias="from")
    subject: str
    date: str

    model_config = {"populate_by_name": True}
