import Link from "next/link";
import { Inbox, Sparkles, Send, ShieldCheck } from "lucide-react";
import { AUTH_LOGIN_URL } from "@/lib/api";

const features = [
  {
    icon: Inbox,
    title: "Triage your inbox",
    body: "Read, search and skim recent unread mail in a clean Gmail-style layout.",
  },
  {
    icon: Sparkles,
    title: "AI suggested replies",
    body: "Gemini drafts a contextual reply you can edit in one click.",
  },
  {
    icon: Send,
    title: "Send from the app",
    body: "Compose or reply without ever leaving the assistant.",
  },
];

export default function Landing() {
  return (
    <main className="flex flex-1 w-full flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-5xl">
        <div className="flex flex-col items-center text-center gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs text-[var(--muted)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            OAuth-secured · Gemini · MCP
          </span>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-tight">
            Your inbox, with an assistant.
          </h1>
          <p className="max-w-xl text-base sm:text-lg text-[var(--muted)]">
            Mailmind connects to Gmail through a local Model Context Protocol
            server and uses Gemini to read, summarise and reply to your email.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/inbox"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent)] px-6 text-sm font-medium text-[var(--accent-foreground)] transition hover:opacity-90"
            >
              Open inbox
            </Link>
            <a
              href={AUTH_LOGIN_URL}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border-strong)] px-6 text-sm font-medium transition hover:bg-[var(--surface-muted)]"
            >
              Sign in with Google
            </a>
          </div>
          <p className="text-xs text-[var(--muted)]">
            First run? Click <span className="font-medium">Sign in with Google</span> once to
            grant access; afterwards just open the inbox.
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <Icon className="h-5 w-5 text-[var(--accent)]" />
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)] leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
