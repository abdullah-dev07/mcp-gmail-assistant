from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.gemini_service import chat_once, execute_pending

try:
    from google.genai import errors as genai_errors

    _GEMINI_CLIENT_ERROR: tuple[type[BaseException], ...] = (genai_errors.ClientError,)
except Exception:
    _GEMINI_CLIENT_ERROR = ()

router = APIRouter()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class PendingAction(BaseModel):
    tool: str
    args: dict[str, Any]


class ChatResponse(BaseModel):
    reply: str
    pendingAction: PendingAction | None = None


class ConfirmResponse(BaseModel):
    reply: str


@router.get("/health")
def chat_health():
    return {"chat": "ok"}


def _friendly_gemini_error(exc: BaseException) -> str | None:
    """Translate Gemini client errors into a short user-facing message."""
    if not _GEMINI_CLIENT_ERROR or not isinstance(exc, _GEMINI_CLIENT_ERROR):
        return None
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if code == 429:
        return (
            "Gemini rate limit hit (free tier = 20 requests/day). "
            "Wait a bit, switch to a paid key, or set GEMINI_MODEL to a model "
            "with a higher quota."
        )
    if code in (401, 403):
        return "Gemini rejected the API key. Check GEMINI_API_KEY in backend/.env."
    return None


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    try:
        result = await chat_once(req.message)
    except Exception as exc:
        friendly = _friendly_gemini_error(exc)
        if friendly is not None:
            raise HTTPException(status_code=503, detail=friendly)
        raise HTTPException(status_code=500, detail=str(exc))
    pending = (
        PendingAction(**result.pending_action)
        if result.pending_action
        else None
    )
    return ChatResponse(reply=result.reply, pendingAction=pending)


@router.post("/confirm", response_model=ConfirmResponse)
async def confirm(req: PendingAction) -> ConfirmResponse:
    try:
        text = await execute_pending({"tool": req.tool, "args": req.args})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return ConfirmResponse(reply=text)
