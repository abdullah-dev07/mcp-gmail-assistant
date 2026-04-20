"use client";

import { useMemo } from "react";
import { Inbox, Mail, MailOpen, RefreshCw, Search, AlertTriangle } from "lucide-react";
import type { Email } from "@/lib/api";

type Filter = "unread" | "inbox" | "sent";

type Props = {
  emails: Email[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  onCompose: () => void;
};

const FILTERS: { id: Filter; label: string; icon: typeof Mail }[] = [
  { id: "unread", label: "Unread", icon: Mail },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: MailOpen },
];

function initials(name: string): string {
  const trimmed = name.replace(/<.*?>/, "").trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function displayName(from: string): string {
  const m = from.match(/^(.*?)\s*<.*?>$/);
  return (m?.[1] || from).replace(/"/g, "").trim() || from;
}

function formatDate(date: string): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date.slice(0, 16);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Sidebar({
  emails,
  loading,
  error,
  selectedId,
  onSelect,
  onRefresh,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onCompose,
}: Props) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return emails;
    return emails.filter(
      (e) =>
        e.subject.toLowerCase().includes(q) ||
        e.from.toLowerCase().includes(q)
    );
  }, [emails, search]);

  return (
    <aside className="flex h-full w-full sm:w-80 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="btn-accent h-7 w-7 rounded-lg flex items-center justify-center text-xs font-semibold">
            M
          </div>
          <span className="text-sm font-semibold tracking-tight">Mailmind</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="px-3 py-3">
        <button
          onClick={onCompose}
          className="btn-accent w-full h-10 rounded-full text-sm font-medium"
        >
          Compose
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search mail"
            className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] pl-9 pr-3 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
          />
        </div>
      </div>

      <nav className="px-2 pb-2">
        {FILTERS.map(({ id, label, icon: Icon }) => {
          const active = filter === id;
          return (
            <button
              key={id}
              onClick={() => onFilterChange(id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-[var(--surface-muted)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto border-t border-[var(--border)]">
        {loading && filtered.length === 0 && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-lg bg-[var(--surface-muted)] animate-pulse"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="m-3 flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted)]">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--danger)]" />
            <div>
              <div className="font-medium text-[var(--foreground)]">
                Couldn&apos;t load mail
              </div>
              <div className="mt-1 leading-relaxed">{error}</div>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-[var(--muted)]">
            No messages.
          </div>
        )}

        <ul className="divide-y divide-[var(--border)]">
          {filtered.map((e) => {
            const selected = e.id === selectedId;
            return (
              <li key={e.id}>
                <button
                  onClick={() => onSelect(e.id)}
                  className={`w-full text-left px-3 py-3 transition ${
                    selected
                      ? "bg-[var(--surface-muted)]"
                      : "hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold text-[var(--muted)]">
                      {initials(displayName(e.from))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {displayName(e.from)}
                        </span>
                        <span className="shrink-0 text-[11px] text-[var(--muted)]">
                          {formatDate(e.date)}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-sm text-[var(--foreground)]">
                        {e.subject}
                      </div>
                      {e.snippet && (
                        <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
                          {e.snippet}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
