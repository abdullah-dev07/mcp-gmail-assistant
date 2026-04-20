"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  getEmail,
  listEmails,
  sendChatMessage,
  sendEmail,
  suggestReply,
  type Email,
  type EmailDetail as EmailDetailType,
} from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import EmailDetail from "@/components/EmailDetail";
import ReplyPanel, { type ReplyDraft } from "@/components/ReplyPanel";
import ChatBar from "@/components/ChatBar";

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
      setListError(toErrorMessage(e));
    } finally {
      setListLoading(false);
    }
  }, [filter, selectedId]);

  useEffect(() => {
    refresh();
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) {
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

  async function runChat(message: string): Promise<string | null> {
    try {
      const { reply } = await sendChatMessage(message);
      return reply;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
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
      <ChatBar onSend={runChat} />
    </div>
  );
}
