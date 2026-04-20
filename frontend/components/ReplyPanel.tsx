"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, Trash2, X } from "lucide-react";

export type ReplyDraft = {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
};

type Props = {
  open: boolean;
  draft: ReplyDraft;
  aiLoading?: boolean;
  aiError?: string | null;
  sending?: boolean;
  sendError?: string | null;
  successMessage?: string | null;
  onChange: (draft: ReplyDraft) => void;
  onSuggest?: () => void;
  onSend: () => void;
  onClose: () => void;
  onDiscard: () => void;
};

export default function ReplyPanel({
  open,
  draft,
  aiLoading,
  aiError,
  sending,
  sendError,
  successMessage,
  onChange,
  onSuggest,
  onSend,
  onClose,
  onDiscard,
}: Props) {
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage) return;
    setLocalSuccess(successMessage);
    const t = setTimeout(() => setLocalSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [successMessage]);

  if (!open) return null;

  const title = draft.inReplyTo ? "Reply" : "New message";
  const canSend =
    !sending && draft.to.trim() && draft.subject.trim() && draft.body.trim();

  return (
    <div className="absolute bottom-4 right-4 z-20 w-[min(560px,calc(100%-2rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5">
        <span className="text-sm font-semibold">{title}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onDiscard}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface)]"
            aria-label="Discard"
            title="Discard"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-3">
        <Field
          label="To"
          value={draft.to}
          onChange={(v) => onChange({ ...draft, to: v })}
          placeholder="name@example.com"
        />
        <Field
          label="Subject"
          value={draft.subject}
          onChange={(v) => onChange({ ...draft, subject: v })}
          placeholder="Subject"
        />
        <div className="py-2">
          <textarea
            value={draft.body}
            onChange={(e) => onChange({ ...draft, body: e.target.value })}
            placeholder="Write your message…"
            rows={8}
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
          />
        </div>
      </div>

      {(aiError || sendError) && (
        <div className="mx-4 mb-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2.5 text-xs text-[var(--muted)]">
          {aiError || sendError}
        </div>
      )}

      {localSuccess && (
        <div className="mx-4 mb-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2.5 text-xs text-[var(--foreground)]">
          {localSuccess}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
        <button
          onClick={onSend}
          disabled={!canSend}
          className="btn-accent inline-flex h-9 items-center gap-2 rounded-full px-5 text-sm font-medium disabled:opacity-50"
        >
          {sending && <Loader2 className="h-4 w-4 animate-spin" />}
          Send
        </button>
        {onSuggest && (
          <button
            onClick={onSuggest}
            disabled={aiLoading || !draft.inReplyTo}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 text-sm font-medium transition hover:bg-[var(--surface-muted)] disabled:opacity-50"
            title={
              draft.inReplyTo
                ? "Ask Gemini to draft a reply"
                : "AI replies are only available when replying to an email"
            }
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            AI draft
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--border)] py-1.5">
      <span className="w-14 shrink-0 text-xs uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
      />
    </div>
  );
}
