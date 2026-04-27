from fastapi import APIRouter, Depends, HTTPException, Query

from auth_session import current_refresh_token
from schemas.emails import SendEmailRequest, SendEmailResponse
from services.mcp_service import call_mcp_tool

router = APIRouter()


def _parse_list_blob(blob: str) -> list[dict]:
    """Parse the text `gmail_list_messages` returns into a list of dicts.

    The MCP tool separates messages with a blank `---` line:

        ID: 18f1...
        From: Alice <a@b.com>
        Subject: Hello
        Date: Mon, 14 Apr 2026 09:32 +0000

        ---

        ID: 18f2...
        ...
    """
    if not blob:
        return []
    if blob.strip().lower().startswith("no emails"):
        return []

    results: list[dict] = []
    # Messages are separated by a line of dashes; split on that.
    for chunk in blob.split("\n---\n"):
        entry: dict[str, str] = {}
        for raw in chunk.splitlines():
            line = raw.strip()
            if ":" not in line:
                continue
            key, _, value = line.partition(":")
            entry[key.strip().lower()] = value.strip()
        if entry.get("id"):
            results.append(
                {
                    "id": entry["id"],
                    "from": entry.get("from", "Unknown"),
                    "subject": entry.get("subject", "(no subject)"),
                    "date": entry.get("date", ""),
                }
            )
    return results


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


@router.get("")
async def list_emails(
    query: str = Query("is:unread", description="Gmail search query, e.g. is:unread, in:inbox, in:sent"),
    maxResults: int = Query(15, ge=1, le=50),
    refresh_token: str = Depends(current_refresh_token),
) -> dict:
    try:
        text = await call_mcp_tool(
            "gmail_list_messages",
            {"query": query, "maxResults": maxResults},
            refresh_token,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"MCP call failed: {exc}")
    return {"query": query, "emails": _parse_list_blob(text)}


@router.post("/send", response_model=SendEmailResponse)
async def send_email(
    req: SendEmailRequest,
    refresh_token: str = Depends(current_refresh_token),
) -> SendEmailResponse:
    try:
        text = await call_mcp_tool(
            "gmail_send_message",
            {"to": req.to, "subject": req.subject, "body": req.body},
            refresh_token,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"MCP call failed: {exc}")
    return SendEmailResponse(detail=text)


# NOTE: keep the dynamic route last so `/send` is not captured by `{message_id}`.
@router.get("/{message_id}")
async def read_email(
    message_id: str,
    refresh_token: str = Depends(current_refresh_token),
):
    try:
        text = await call_mcp_tool(
            "gmail_read_message",
            {"messageId": message_id},
            refresh_token,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"MCP call failed: {exc}")

    return _parse_read_message(text, message_id)
