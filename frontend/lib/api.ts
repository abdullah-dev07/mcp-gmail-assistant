/**
 * Thin typed client for the FastAPI backend.
 *
 * Endpoints currently implemented in backend:
 *   GET  /auth/login           -> redirects to Google consent screen
 *   GET  /auth/callback        -> OAuth callback, prints tokens
 *   GET  /auth/test-mcp        -> returns { available_tools, emails: <text blob> }
 *
 * Endpoints this UI will call (to be added in backend as it grows):
 *   GET  /emails/:id           -> full email body
 *   POST /emails/send          -> send a new mail / reply
 *   POST /ai/suggest-reply     -> AI-generated reply draft for an email
 *   POST /chat                 -> natural language assistant over MCP tools
 *
 * Until those are live the UI handles the 404 gracefully.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8001";

export type Email = {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet?: string;
};

export type EmailDetail = Email & {
  body: string;
  threadId?: string;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { expectText?: boolean }
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || res.statusText);
  }
  if (init?.expectText) {
    return (await res.text()) as unknown as T;
  }
  return (await res.json()) as T;
}

/**
 * The MCP list tool returns a single text blob that looks like:
 *
 *   ID: 18f1...
 *   From: Alice <a@b.com>
 *   Subject: Hello
 *   Date: Mon, 14 Apr 2026 09:32 +0000
 *
 *   ---
 *
 *   ID: 18f2...
 *   ...
 *
 * Parse it into structured rows so the UI can render cards and route by ID.
 */
function parseEmailBlob(blob: string): Email[] {
  if (!blob || typeof blob !== "string") return [];
  if (blob.trim().toLowerCase().startsWith("no emails")) return [];

  const chunks = blob.split(/\n-{3,}\n/g);
  const emails: Email[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const entry: Partial<Email> = {};
    for (const line of lines) {
      const [rawKey, ...rest] = line.split(":");
      if (!rawKey || rest.length === 0) continue;
      const key = rawKey.trim().toLowerCase();
      const value = rest.join(":").trim();
      if (key === "id") entry.id = value;
      else if (key === "from") entry.from = value;
      else if (key === "subject") entry.subject = value;
      else if (key === "date") entry.date = value;
    }
    if (entry.id) {
      emails.push({
        id: entry.id,
        from: entry.from ?? "Unknown sender",
        subject: entry.subject ?? "(no subject)",
        date: entry.date ?? "",
      });
    }
  }
  return emails;
}

export async function listEmails(
  query: string = "is:unread",
  maxResults: number = 15
): Promise<Email[]> {
  const params = new URLSearchParams({ query, maxResults: String(maxResults) });
  const data = await request<{ available_tools: string[]; emails: string }>(
    `/auth/test-mcp?${params.toString()}`
  );
  return parseEmailBlob(data.emails);
}

export async function getEmail(id: string): Promise<EmailDetail> {
  return request<EmailDetail>(`/emails/${encodeURIComponent(id)}`);
}

export async function suggestReply(
  emailId: string
): Promise<{ draft: string }> {
  return request<{ draft: string }>(`/ai/suggest-reply`, {
    method: "POST",
    body: JSON.stringify({ emailId }),
  });
}

export async function sendEmail(payload: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/emails/send`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type PendingAction = {
  tool: string;
  args: Record<string, unknown>;
};

export type ChatResult = {
  reply: string;
  pendingAction?: PendingAction | null;
};

export async function sendChatMessage(message: string): Promise<ChatResult> {
  return request<ChatResult>(`/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function confirmChatAction(
  action: PendingAction
): Promise<{ reply: string }> {
  return request<{ reply: string }>(`/chat/confirm`, {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export const AUTH_LOGIN_URL = `${API_BASE}/auth/login`;
