from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth_session import current_refresh_token
from services.gemini_service import suggest_reply
from services.mcp_service import call_mcp_tool

router = APIRouter()


class SuggestReplyRequest(BaseModel):
    emailId: str = Field(..., min_length=1)
    instruction: str | None = None


class SuggestReplyResponse(BaseModel):
    draft: str


@router.post("/suggest-reply", response_model=SuggestReplyResponse)
async def suggest_reply_endpoint(
    req: SuggestReplyRequest,
    refresh_token: str = Depends(current_refresh_token),
) -> SuggestReplyResponse:
    try:
        email_text = await call_mcp_tool(
            "gmail_read_message", {"messageId": req.emailId}, refresh_token
        )
        draft = await suggest_reply(email_text, req.instruction)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return SuggestReplyResponse(draft=draft)
