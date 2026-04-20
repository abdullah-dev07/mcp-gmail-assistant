from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.gemini_service import chat_once, execute_pending

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


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    try:
        result = await chat_once(req.message)
    except Exception as exc:
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
