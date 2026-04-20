"use client";

import { useState, type KeyboardEvent } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

type Props = {
  onSend: (message: string) => Promise<string | null>;
};

export default function ChatBar({ onSend }: Props) {
  const [value, setValue] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const msg = value.trim();
    if (!msg || loading) return;
    setLoading(true);
    setError(null);
    setReply(null);
    const res = await onSend(msg);
    setLoading(false);
    if (res === null) {
      setError("Chat endpoint not available yet.");
      return;
    }
    setReply(res);
    setValue("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      {(reply || error) && (
        <div className="mx-auto mb-2 max-w-3xl">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm leading-relaxed">
            {error ? (
              <span className="text-[var(--muted)]">{error}</span>
            ) : (
              reply
            )}
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
