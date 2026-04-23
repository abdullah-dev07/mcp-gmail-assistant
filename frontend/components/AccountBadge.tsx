"use client";

import { LogOut } from "lucide-react";
import { logout, type Me } from "@/lib/api";

type Props = {
  me: Me;
  onAfterLogout?: () => void;
};

export default function AccountBadge({ me, onAfterLogout }: Props) {
  async function handleLogout() {
    try {
      await logout();
    } catch {
      // If the cookie is already gone we still want the UI to reset.
    } finally {
      onAfterLogout?.();
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="h-7 w-7 shrink-0 rounded-full bg-[var(--surface-muted)] text-xs font-semibold flex items-center justify-center">
          {me.email.slice(0, 1).toUpperCase()}
        </div>
        <span
          className="truncate text-xs text-[var(--muted)]"
          title={me.email}
        >
          {me.email}
        </span>
      </div>
      <button
        onClick={handleLogout}
        className="inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
        aria-label="Log out"
      >
        <LogOut className="h-3.5 w-3.5" />
        Log out
      </button>
    </div>
  );
}
