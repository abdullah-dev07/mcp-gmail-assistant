from fastapi import APIRouter, HTTPException

from services.mcp_service import call_mcp_tool

router = APIRouter()


def _parse_read_message(blob: str, message_id: str) -> dict:
    """Parse the text that `gmail_read_message` returns into structured JSON.

    The MCP tool produces:

        From: Alice <a@b.com>
        Date: Mon, 14 Apr 2026 09:32 +0000
        Subject: Hello

        Body:
        <body text ...>
    """
    headers: dict[str, str] = {}
    body_lines: list[str] = []
    in_body = False

    for raw in blob.splitlines():
        if not in_body:
            stripped = raw.strip()
            if stripped.lower().startswith("body:"):
                in_body = True
                continue
            if ":" in stripped:
                key, _, value = stripped.partition(":")
                headers[key.strip().lower()] = value.strip()
            continue
        body_lines.append(raw)

    body = "\n".join(body_lines).strip("\n")

    return {
        "id": message_id,
        "from": headers.get("from", "Unknown"),
        "subject": headers.get("subject", "(no subject)"),
        "date": headers.get("date", ""),
        "body": body,
    }


@router.get("/{message_id}")
async def read_email(message_id: str):
    try:
        text = await call_mcp_tool(
            "gmail_read_message", {"messageId": message_id}
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"MCP call failed: {exc}")

    return _parse_read_message(text, message_id)
