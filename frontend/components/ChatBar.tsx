"use client";

import { useState, type KeyboardEvent } from "react";
import { CheckCircle2, Loader2, Send, Sparkles, X } from "lucide-react";
import type { ChatResult, PendingAction } from "@/lib/api";

type Props = {
  onSend: (message: string) => Promise<ChatResult | null>;
  onConfirm: (action: PendingAction) => Promise<string | null>;
};

function summariseArgs(args: Record<string, unknown>): {
  to?: string;
  subject?: string;
  body?: string;
} {
  return {
    to: typeof args.to === "string" ? args.to : undefined,
    subject: typeof args.subject === "string" ? args.subject : undefined,
    body: typeof args.body === "string" ? args.body : undefined,
  };
}

export default function ChatBar({ onSend, onConfirm }: Props) {
  const [value, setValue] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function submit() {
    const msg = value.trim();
    if (!msg || loading) return;
    setLoading(true);
    setError(null);
    setReply(null);
    setPending(null);
    try {
      const res = await onSend(msg);
      if (res === null) {
        setError("Chat endpoint not available yet.");
        return;
      }
      setReply(res.reply);
      setPending(res.pendingAction ?? null);
      setValue("");
    } catch (e) {
      setError((e as Error).message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function confirmAction() {
    if (!pending || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const text = await onConfirm(pending);
      if (text === null) {
        setError("Confirm endpoint not available yet.");
      } else {
        setReply(text);
        setPending(null);
      }
    } catch (e) {
      setError((e as Error).message || "Confirm failed");
    } finally {
      setConfirming(false);
    }
  }

  function cancelAction() {
    setPending(null);
    setReply((prev) => (prev ? `${prev}\n\nDraft discarded.` : "Draft discarded."));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const summary = pending ? summariseArgs(pending.args) : null;

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      {(reply || error) && (
        <div className="mx-auto mb-2 max-w-3xl">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
            {error ? (
              <span className="text-[var(--muted)]">{error}</span>
            ) : (
              reply
            )}
          </div>
        </div>
      )}

      {pending && summary && (
        <div className="mx-auto mb-2 max-w-3xl">
          <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-sm shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
              Draft ready — please review
            </div>
            <dl className="mt-2 space-y-1.5">
              {summary.to && (
                <Row label="To" value={summary.to} />
              )}
              {summary.subject && (
                <Row label="Subject" value={summary.subject} />
              )}
              {summary.body && (
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-[var(--muted)]">
                    Body
                  </div>
                  <pre className="whitespace-pre-wrap break-words rounded-lg bg-[var(--surface-muted)] p-2 font-sans text-sm leading-relaxed">
                    {summary.body}
                  </pre>
                </div>
              )}
            </dl>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={confirmAction}
                disabled={confirming}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-xs font-medium text-[var(--accent-foreground)] transition hover:opacity-90 disabled:opacity-60"
              >
                {confirming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Confirm & send
              </button>
              <button
                onClick={cancelAction}
                disabled={confirming}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-4 text-xs font-medium transition hover:bg-[var(--surface-muted)] disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" />
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-1.5">
        <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent)]" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
          placeholder="Ask anything — e.g. “show unread from Stripe” or “reply politely I&apos;ll respond tomorrow”"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)] disabled:opacity-70"
        />
        <button
          onClick={submit}
          disabled={loading || !value.trim()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] transition hover:opacity-90 disabled:opacity-50"
          aria-label="Send"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-16 shrink-0 text-[11px] uppercase tracking-wide text-[var(--muted)] pt-0.5">
        {label}
      </dt>
      <dd className="flex-1 break-words text-sm">{value}</dd>
    </div>
  );
}
