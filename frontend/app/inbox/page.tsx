"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  confirmChatAction,
  getEmail,
  getMe,
  listEmails,
  sendChatMessage,
  sendEmail,
  suggestReply,
  type ChatResult,
  type Email,
  type EmailDetail as EmailDetailType,
  type Me,
  type PendingAction,
} from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import EmailDetail from "@/components/EmailDetail";
import ReplyPanel, { type ReplyDraft } from "@/components/ReplyPanel";
import ChatBar from "@/components/ChatBar";
import AccountBadge from "@/components/AccountBadge";
import ConnectGate from "@/components/ConnectGate";

type Filter = "unread" | "inbox" | "sent";

const FILTER_QUERY: Record<Filter, string> = {
  unread: "is:unread",
  inbox: "in:inbox",
  sent: "in:sent",
};

const EMPTY_DRAFT: ReplyDraft = { to: "", subject: "", body: "" };

function toErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 404) return "Backend endpoint not available yet.";
    return `${e.status}: ${e.message || "Request failed"}`;
  }
  if (e instanceof TypeError) {
    return "Can't reach backend. Is FastAPI running on :8001?";
  }
  return (e as Error)?.message ?? "Unknown error";
}

export default function InboxPage() {
  // Auth gate: `null` = checking, `false` = not connected, `Me` = connected.
  const [me, setMe] = useState<Me | null | false>(null);

  const [filter, setFilter] = useState<Filter>("unread");
  const [search, setSearch] = useState("");
  const [emails, setEmails] = useState<Email[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmailDetailType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState<ReplyDraft>(EMPTY_DRAFT);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const selectedSummary = useMemo(
    () => emails.find((e) => e.id === selectedId) ?? null,
    [emails, selectedId]
  );

  const refresh = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await listEmails(FILTER_QUERY[filter], 20);
      setEmails(data);
      if (data.length > 0 && !data.some((e) => e.id === selectedId)) {
        setSelectedId(data[0].id);
      }
    } catch (e) {
      // Session expired / revoked mid-session → fall back to the gate.
      if (e instanceof ApiError && e.status === 401) {
        setMe(false);
        return;
      }
      setListError(toErrorMessage(e));
    } finally {
      setListLoading(false);
    }
  }, [filter, selectedId]);

  // One-shot session check on mount. We keep this independent from the
  // email list effect so the gate shows immediately without a 401 flash.
  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((result) => {
        if (!cancelled) setMe(result ?? false);
      })
      .catch(() => {
        if (!cancelled) setMe(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!me) return; // wait until we know the user is connected
    // Fetch-on-filter-change is a legitimate effect; React 19's
    // set-state-in-effect rule is overly strict here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, me]);

  useEffect(() => {
    if (!selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(null);
      return;
    }
    let cancelled = false;
     
    setDetailLoading(true);
     
    setDetailError(null);
     
    setDetail(null);
    getEmail(selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setDetailError(toErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function openReply() {
    if (!selectedSummary) return;
    const bodyQuote = detail?.body
      ? `\n\n\nOn ${selectedSummary.date}, ${selectedSummary.from} wrote:\n> ${detail.body
          .split("\n")
          .slice(0, 20)
          .join("\n> ")}`
      : "";
    setDraft({
      to: selectedSummary.from,
      subject: selectedSummary.subject.startsWith("Re:")
        ? selectedSummary.subject
        : `Re: ${selectedSummary.subject}`,
      body: bodyQuote,
      inReplyTo: selectedSummary.id,
    });
    setSuggestError(null);
    setSendError(null);
    setSendSuccess(null);
    setPanelOpen(true);
  }

  function openCompose() {
    setDraft(EMPTY_DRAFT);
    setSuggestError(null);
    setSendError(null);
    setSendSuccess(null);
    setPanelOpen(true);
  }

  async function runSuggest(forId: string) {
    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const { draft: aiBody } = await suggestReply(forId);
      setDraft((prev) => {
        const base: ReplyDraft = panelOpen
          ? prev
          : {
              to: selectedSummary?.from ?? prev.to,
              subject:
                selectedSummary?.subject &&
                !selectedSummary.subject.startsWith("Re:")
                  ? `Re: ${selectedSummary.subject}`
                  : selectedSummary?.subject ?? prev.subject,
              body: prev.body,
              inReplyTo: forId,
            };
        return { ...base, body: aiBody };
      });
      setPanelOpen(true);
    } catch (e) {
      setSuggestError(toErrorMessage(e));
      setPanelOpen(true);
    } finally {
      setSuggestLoading(false);
    }
  }

  async function runSend() {
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      await sendEmail({
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
        inReplyTo: draft.inReplyTo,
      });
      setSendSuccess("Message sent.");
      setTimeout(() => {
        setPanelOpen(false);
        setDraft(EMPTY_DRAFT);
        setSendSuccess(null);
      }, 1200);
    } catch (e) {
      setSendError(toErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  async function runChat(message: string): Promise<ChatResult | null> {
    try {
      return await sendChatMessage(message);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  async function runConfirm(action: PendingAction): Promise<string | null> {
    try {
      const { reply } = await confirmChatAction(action);
      // Gmail may have changed; refresh in the background.
      refresh();
      return reply;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  if (me === null) {
    // Brief flash while we check /auth/me — render nothing to avoid UI jank.
    return <div className="flex h-[100dvh] w-full" />;
  }

  if (me === false) {
    return <ConnectGate />;
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col">
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          emails={emails}
          loading={listLoading}
          error={listError}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRefresh={refresh}
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={(f) => {
            setFilter(f);
            setSelectedId(null);
          }}
          onCompose={openCompose}
          footer={
            <AccountBadge
              me={me}
              onAfterLogout={() => {
                setMe(false);
                setEmails([]);
                setSelectedId(null);
                setDetail(null);
              }}
            />
          }
        />

        <main className="relative flex flex-1 min-w-0 flex-col bg-[var(--background)]">
          <EmailDetail
            summary={selectedSummary}
            detail={detail}
            loading={detailLoading}
            error={detailError}
            suggestLoading={suggestLoading && !panelOpen}
            onReply={openReply}
            onSuggest={() => selectedSummary && runSuggest(selectedSummary.id)}
          />
          <ReplyPanel
            open={panelOpen}
            draft={draft}
            aiLoading={suggestLoading}
            aiError={suggestError}
            sending={sending}
            sendError={sendError}
            successMessage={sendSuccess}
            onChange={setDraft}
            onSuggest={
              draft.inReplyTo ? () => runSuggest(draft.inReplyTo!) : undefined
            }
            onSend={runSend}
            onClose={() => setPanelOpen(false)}
            onDiscard={() => {
              setPanelOpen(false);
              setDraft(EMPTY_DRAFT);
            }}
          />
        </main>
      </div>
      <ChatBar onSend={runChat} onConfirm={runConfirm} />
    </div>
  );
}
