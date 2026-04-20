/**
 * Thin typed client for the FastAPI backend.
 *
 * Endpoints implemented in backend:
 *   GET  /auth/login           -> redirects to Google consent screen
 *   GET  /auth/callback        -> OAuth callback, prints tokens
 *   GET  /emails?query=...     -> list emails matching a Gmail query
 *   GET  /emails/:id           -> full email body
 *   POST /emails/send          -> send a new mail / reply
 *   POST /ai/suggest-reply     -> AI-generated reply draft for an email
 *   POST /chat                 -> natural language assistant over MCP tools
 *   POST /chat/confirm         -> execute a deferred tool call (e.g. send)
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

export async function listEmails(
  query: string = "is:unread",
  maxResults: number = 15
): Promise<Email[]> {
  const params = new URLSearchParams({ query, maxResults: String(maxResults) });
  const data = await request<{ query: string; emails: Email[] }>(
    `/emails?${params.toString()}`
  );
  return data.emails;
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
