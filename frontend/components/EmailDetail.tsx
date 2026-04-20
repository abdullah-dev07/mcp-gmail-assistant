"use client";

import { Inbox, Loader2, Reply, Sparkles, AlertCircle } from "lucide-react";
import type { Email, EmailDetail as EmailDetailType } from "@/lib/api";

type Props = {
  summary: Email | null;
  detail: EmailDetailType | null;
  loading: boolean;
  error: string | null;
  suggestLoading: boolean;
  onReply: () => void;
  onSuggest: () => void;
};

function displayName(from: string): string {
  const m = from.match(/^(.*?)\s*<(.*?)>$/);
  if (m) {
    const name = m[1].replace(/"/g, "").trim();
    return name || m[2];
  }
  return from;
}

function senderEmail(from: string): string {
  const m = from.match(/<(.*?)>/);
  return m?.[1] ?? from;
}

export default function EmailDetail({
  summary,
  detail,
  loading,
  error,
  suggestLoading,
  onReply,
  onSuggest,
}: Props) {
  if (!summary) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center text-[var(--muted)]">
          <div className="rounded-full bg-[var(--surface-muted)] p-4">
            <Inbox className="h-6 w-6" />
          </div>
          <div className="text-sm">Select an email to read it here.</div>
        </div>
      </div>
    );
  }

  const from = summary.from;
  const subject = detail?.subject ?? summary.subject;
  const date = detail?.date ?? summary.date;
  const body = detail?.body ?? "";

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <h1 className="text-lg font-semibold leading-tight">{subject}</h1>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold text-[var(--muted)]">
              {displayName(from).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {displayName(from)}
              </div>
              <div className="truncate text-xs text-[var(--muted)]">
                {senderEmail(from)}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-xs text-[var(--muted)] pt-1">{date}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={onReply}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 text-sm font-medium transition hover:bg-[var(--surface-muted)]"
          >
            <Reply className="h-4 w-4" />
            Reply
          </button>
          <button
            onClick={onSuggest}
            disabled={suggestLoading}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] transition hover:opacity-90 disabled:opacity-60"
          >
            {suggestLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            AI Suggest Reply
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading message…
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-[var(--danger)]" />
            <div className="text-sm">
              <div className="font-medium">Couldn&apos;t load full message</div>
              <div className="mt-1 text-[var(--muted)] leading-relaxed">
                {error}
              </div>
              <div className="mt-2 text-[var(--muted)]">
                Showing header info only. Add a <code className="font-mono">GET /emails/:id</code>{" "}
                endpoint on the backend to fetch the body.
              </div>
            </div>
          </div>
        )}

        {!loading && !error && body && (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[var(--foreground)]">
            {body}
          </pre>
        )}

        {!loading && !error && !body && (
          <div className="text-sm text-[var(--muted)]">
            This message has no plain-text body to display.
          </div>
        )}
      </div>
    </div>
  );
}
