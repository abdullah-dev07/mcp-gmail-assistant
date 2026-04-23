/**
 * Thin typed client for the FastAPI backend.
 *
 * Endpoints implemented in backend:
 *   GET  /auth/login           -> redirects to Google consent screen
 *   GET  /auth/callback        -> OAuth callback; sets session cookie and
 *                                 redirects back to FRONTEND_BASE_URL
 *   GET  /auth/me              -> returns the connected account or 401
 *   POST /auth/logout          -> revokes the session and clears the cookie
 *   GET  /emails?query=...     -> list emails matching a Gmail query
 *   GET  /emails/:id           -> full email body
 *   POST /emails/send          -> send a new mail / reply
 *   POST /ai/suggest-reply     -> AI-generated reply draft for an email
 *   POST /chat                 -> natural language assistant over MCP tools
 *   POST /chat/confirm         -> execute a deferred tool call (e.g. send)
 *
 * All requests send the `mm_session` HttpOnly cookie via
 * `credentials: "include"`; the backend uses it to pick the caller's
 * Gmail refresh token on every call. If you see a 401 from a protected
 * endpoint, the user hasn't connected Gmail yet — send them to
 * AUTH_LOGIN_URL.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8001";

// Shared-secret header sent with every backend request. This value is baked
// into the client bundle at build time via NEXT_PUBLIC_API_KEY, so it is
// visible to anyone who inspects the browser devtools — treat it as a "keep
// casual probes out" measure, not real authentication.
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

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
    // Send the mm_session HttpOnly cookie on every request. Required for
    // any Gmail-backed endpoint; the backend returns 401 without it.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
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

export type Me = { userId: string; email: string };

export async function getMe(): Promise<Me | null> {
  try {
    return await request<Me>(`/auth/me`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export async function logout(): Promise<void> {
  await request<{ ok: true }>(`/auth/logout`, { method: "POST" });
}
