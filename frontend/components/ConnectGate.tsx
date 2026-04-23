"use client";

import { Mail, ShieldCheck } from "lucide-react";
import { AUTH_LOGIN_URL } from "@/lib/api";

export default function ConnectGate() {
  return (
    <main className="flex flex-1 w-full flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-muted)]">
          <Mail className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <h1 className="mt-5 text-lg font-semibold tracking-tight">
          Connect your Gmail
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
          Mailmind needs permission to read and send mail on your behalf.
          Your refresh token is stored encrypted on the backend and is only
          used for your own requests.
        </p>
        <a
          href={AUTH_LOGIN_URL}
          className="btn-accent mt-6 inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-medium"
        >
          Connect Gmail
        </a>
        <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
          <ShieldCheck className="h-3 w-3" />
          OAuth via Google — we never see your password.
        </p>
      </div>
    </main>
  );
}
