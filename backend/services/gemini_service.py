"""Gemini-driven chat that can call MCP tools (Gmail) as functions.

Uses the new `google-genai` SDK. Automatic function-calling is disabled so we
can route tool invocations through the existing MCP stdio client.

Deferred tools
--------------
`gmail_send_message` is intercepted: instead of being executed the model's
call is captured as a `pending_action` returned to the caller. The UI shows
it to the user for confirmation, then calls `execute_pending()` to actually
send. This avoids silent outbound mail from a chat prompt.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

from services.mcp_service import call_mcp_tool, get_mcp_tools

load_dotenv()

_API_KEY = os.getenv("GEMINI_API_KEY")
_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

if not _API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set in backend/.env")

_client = genai.Client(api_key=_API_KEY)

# Tools that MUST NOT fire without explicit user confirmation.
DEFERRED_TOOLS: set[str] = {"gmail_send_message"}

_MAX_TOOL_ROUNDS = 6

SYSTEM_INSTRUCTION = (
    "You are Mailmind, an assistant for a personal Gmail inbox.\n"
    "You have tools to list, read, and send email and to fetch a whole thread.\n"
    "\n"
    "When to call which tool:\n"
    "- Listing mail: call gmail_list_messages with a sensible Gmail search query\n"
    "  (examples: 'is:unread', 'from:alice', 'newer_than:7d').\n"
    "- Reading one mail: call gmail_read_message with its message id.\n"
    "- Sending a NEW email (the user gives you a recipient and what to say,\n"
    "  e.g. 'email alice@x.com about lunch tomorrow'): call gmail_send_message\n"
    "  DIRECTLY with to/subject/body. Do NOT call gmail_list_messages or\n"
    "  gmail_read_message first - they are not needed for fresh outbound mail.\n"
    "- Replying: call gmail_read_message first for context, then call\n"
    "  gmail_send_message with the same Subject prefixed by 'Re: ' if needed.\n"
    "\n"
    "Filling gmail_send_message arguments:\n"
    "- 'to' must be a single email address. If the user gave a name but no\n"
    "  address, ask them for the address instead of guessing.\n"
    "- If the user did not give a subject, write a short one (<=8 words) that\n"
    "  reflects the body. Never leave subject empty.\n"
    "- 'body' is the full message text the user wants to send. Add a brief\n"
    "  greeting and sign-off if the user did not include them.\n"
    "\n"
    "Confirmation contract (IMPORTANT):\n"
    "- gmail_send_message is NEVER actually sent by you. The system captures\n"
    "  it as a draft and the user will confirm in the UI.\n"
    "- After calling gmail_send_message ONCE, do NOT call it again in the same\n"
    "  turn even if the tool result mentions a draft. Just summarise what you\n"
    "  prepared (recipient + subject in one line) and ask the user to confirm.\n"
    "\n"
    "Style:\n"
    "- Keep chat replies under 6 short sentences unless asked for more."
)


@dataclass
class ChatResult:
    reply: str
    pending_action: dict | None = None  # {"tool": str, "args": dict}


def _strip_schema_for_gemini(schema: dict[str, Any] | None) -> dict[str, Any]:
    """Gemini accepts OpenAPI-style JSON schema but rejects a few keys that
    MCP tools sometimes emit (`$schema`, `additionalProperties`, etc)."""
    if not schema:
        return {"type": "object", "properties": {}}
    drop = {"$schema", "additionalProperties", "title", "default"}

    def clean(node: Any) -> Any:
        if isinstance(node, dict):
            return {k: clean(v) for k, v in node.items() if k not in drop}
        if isinstance(node, list):
            return [clean(v) for v in node]
        return node

    cleaned = clean(schema)
    cleaned.setdefault("type", "object")
    cleaned.setdefault("properties", {})
    return cleaned


async def _build_tools() -> list[types.Tool]:
    listing = await get_mcp_tools()
    declarations: list[types.FunctionDeclaration] = []
    for tool in listing.tools:
        declarations.append(
            types.FunctionDeclaration(
                name=tool.name,
                description=tool.description or "",
                parameters=_strip_schema_for_gemini(tool.inputSchema),
            )
        )
    return [types.Tool(function_declarations=declarations)]


def _deferred_response(tool_name: str, args: dict) -> str:
    """Synthetic tool result fed back to Gemini when we intercept a deferred
    tool call. Tells the model the action is pending user confirmation and
    must not be retried."""
    summary = ", ".join(f"{k}={v!r}" for k, v in args.items() if k != "body")
    return (
        f"The {tool_name} call has been captured as a draft and is pending user "
        "confirmation. Do NOT call it again. Summarise what you prepared "
        f"(fields: {summary or 'n/a'}) in one or two sentences and ask the user "
        "to confirm or edit."
    )


async def chat_once(message: str) -> ChatResult:
    """Single-shot chat turn. Returns the model reply plus an optional
    pending action that the frontend must confirm before we actually run it."""
    tools = await _build_tools()
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        tools=tools,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(
            disable=True
        ),
    )
    chat = _client.aio.chats.create(model=_MODEL, config=config)

    response = await chat.send_message(message)
    pending: dict | None = None

    for _ in range(_MAX_TOOL_ROUNDS):
        parts = response.candidates[0].content.parts or []
        calls = [p.function_call for p in parts if getattr(p, "function_call", None)]
        if not calls:
            break

        tool_responses: list[types.Part] = []
        for call in calls:
            args = dict(call.args) if call.args else {}
            if call.name in DEFERRED_TOOLS:
                pending = {"tool": call.name, "args": args}
                result_text = _deferred_response(call.name, args)
            else:
                try:
                    result_text = await call_mcp_tool(call.name, args)
                except Exception as exc:
                    result_text = f"Error running {call.name}: {exc}"
            tool_responses.append(
                types.Part.from_function_response(
                    name=call.name,
                    response={"result": result_text},
                )
            )

        response = await chat.send_message(tool_responses)

    text = getattr(response, "text", None) or (
        "I prepared the requested actions but didn't produce a text summary."
    )
    return ChatResult(reply=text, pending_action=pending)


async def execute_pending(pending: dict) -> str:
    """Run a previously-deferred tool call after the user has confirmed it."""
    tool = pending.get("tool")
    args = pending.get("args") or {}
    if tool not in DEFERRED_TOOLS:
        raise ValueError(f"{tool!r} is not a deferred tool")
    return await call_mcp_tool(tool, args)


async def suggest_reply(email_text: str, instruction: str | None = None) -> str:
    """Generate a reply draft for one email. No tool calls — pure text in/out."""
    tone = (
        f"\nStyle request: {instruction.strip()}"
        if instruction and instruction.strip()
        else ""
    )
    prompt = (
        "You are drafting a reply on behalf of the user.\n"
        "Write ONLY the reply body — no 'Subject:' line, no quoted original.\n"
        "Match the tone of the sender. Keep it to 2-5 short sentences.\n"
        "Include a greeting and a short sign-off."
        + tone
        + "\n\n--- ORIGINAL EMAIL ---\n"
        + email_text
    )
    response = await _client.aio.models.generate_content(
        model=_MODEL,
        contents=prompt,
    )
    return (getattr(response, "text", None) or "").strip()
