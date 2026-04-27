"""Wire-format models for /ai endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SuggestReplyRequest(BaseModel):
    emailId: str = Field(..., min_length=1)
    instruction: str | None = None


class SuggestReplyResponse(BaseModel):
    draft: str
