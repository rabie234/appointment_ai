"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  MessageSquare,
  Send,
  Bot,
  User,
  CalendarCheck,
  Loader2,
  Stethoscope,
  Trash2,
  Sparkles,
  CheckCircle2,
  Video,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/components/i18n/translations";
import type {
  BookingSuggestion,
  BookingConfirmation,
  CancellationSuggestion,
} from "./tools";
import {
  listConversations,
  getConversation,
  deleteConversation,
  type ConversationSummary,
} from "./actions";

type Language = "en" | "ar";

type Message = {
  id: string;
  role: "user" | "model";
  content: string;
  suggestion?: BookingSuggestion;
  confirmation?: BookingConfirmation;
  cancellationSuggestion?: CancellationSuggestion;
  cancellationStatus?: "success" | "error";
  cancellationMessage?: string;
  sources?: ChatSource[];
  streaming?: boolean;
};

type ChatSource = {
  id: string;
  title: string;
  source: string;
  revision: number;
};

const GREETING =
  "Hello! I'm your **ClinicAI** assistant. Describe what's bothering you and I'll suggest the right doctor and an available time to book.";

const GREETING_AR =
  "مرحبًا! أنا مساعد **ClinicAI**. أخبرني ما الذي يزعجك، وسأقترح الطبيب المناسب وموعدًا متاحًا للحجز.";

const PROMPTS = [
  {
    key: "I have chest pain when I exercise",
    label: "Chest pain when exercising",
    keyAr: "أشعر بألم في الصدر عند ممارسة الرياضة",
    labelAr: "ألم في الصدر عند ممارسة الرياضة",
  },
  {
    key: "I need a skin rash checked",
    label: "Skin rash",
    keyAr: "أريد فحص طفح جلدي",
    labelAr: "طفح جلدي",
  },
  {
    key: "Find me a pediatrician",
    label: "Find a pediatrician",
    keyAr: "أريد البحث عن طبيب أطفال",
    labelAr: "ابحث عن طبيب أطفال",
  },
  {
    key: "i have head pain",
    label: "Head pain",
    keyAr: "أعاني من ألم في الرأس",
    labelAr: "ألم في الرأس",
  },
];

function to12h(time: string, language: Language): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const date = new Date(Date.UTC(2026, 0, 1, h, m));
  return new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date);
}

function prettyDate(date: string, language: Language): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(language === "ar" ? "ar-LB" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function AIChatPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await listConversations());
    } catch {
      /* non-fatal: sidebar just stays empty */
    }
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // Smooth autoscroll as content grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Auto-grow the textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const isEmpty = messages.length === 0;

  function startNewChat() {
    if (busy) return;
    setMessages([]);
    setActiveId(null);
    setInput("");
    textareaRef.current?.focus();
  }

  async function openConversation(id: string) {
    if (busy) return;
    try {
      const detail = await getConversation(id);
      if (!detail) return;
      setActiveId(detail.id);
      setMessages(
        detail.messages.map((m, i) => ({
          id: `${id}-${i}`,
          role: m.role,
          content: m.text,
          suggestion: m.suggestion,
          confirmation: m.confirmation,
          sources: m.sources,
        })),
      );
    } catch {
      // Keep the current conversation if loading another fails.
    }
  }

  async function removeConversation(id: string, e: React.SyntheticEvent) {
    e.stopPropagation();
    if (busy) return;
    try {
      await deleteConversation(id);
      if (activeId === id) startNewChat();
      await refreshConversations();
    } catch {
      // Do not interrupt the current chat if deletion fails.
    }
  }

  /** Send `text` to the AI and stream the reply. Used by the composer and the
   *  Confirm-booking button alike. */
  async function sendMessage(text: string, confirmProposalId?: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const modelMsg: Message = {
      id: `m-${Date.now()}`,
      role: "model",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, suggestion: undefined })),
      userMsg,
      modelMsg,
    ]);
    setBusy(true);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationId: activeId,
          confirmProposalId,
          language,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      if (!res.body)
        throw new Error(
          t(language, "The assistant response was interrupted. Please try again."),
        );

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete newline-delimited JSON events.
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          handleEvent(JSON.parse(line), modelMsg.id);
        }
      }

      // Flush a final event that arrived without a trailing newline.
      buffer += decoder.decode();
      if (buffer.trim()) handleEvent(JSON.parse(buffer.trim()), modelMsg.id);
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === modelMsg.id
            ? {
                ...m,
                content:
                  error instanceof Error && error.message
                    ? error.message
                    : t(language, "Something went wrong. Please try again."),
                streaming: false,
                suggestion: undefined,
              }
            : m,
        ),
      );
    } finally {
      setBusy(false);
      setMessages((prev) => prev.map((m) => ({ ...m, streaming: false })));
      refreshConversations();
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    void sendMessage(text);
  }

  /** The patient clicked "Confirm booking" on a suggestion card. */
  function confirmBooking(s: BookingSuggestion) {
    if (!s.proposalId || !activeId) return;
    void sendMessage(
      `Yes, please book the appointment with ${s.doctorName} on ${s.date} at ${s.time}.`,
      s.proposalId,
    );
  }

  /** The patient clicked "Confirm Cancellation" on a cancellation card. */
  async function confirmCancellation(
    s: CancellationSuggestion,
    modelId: string,
  ) {
    if (busy) return;
    setBusy(true);

    try {
      const res = await fetch("/api/ai-chat/cancel-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: s.appointmentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Could not cancel the appointment.");
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === modelId
            ? {
                ...m,
                cancellationSuggestion: undefined,
                cancellationStatus: "success",
                cancellationMessage: t(
                  language,
                  "Appointment cancelled successfully.",
                ),
              }
            : m,
        ),
      );
      await refreshConversations();
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === modelId
            ? {
                ...m,
                cancellationStatus: "error",
                cancellationMessage:
                  error instanceof Error
                    ? error.message
                    : "Could not cancel the appointment. Please try again.",
              }
            : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function handleEvent(
    evt: {
      type: string;
      text?: string;
      data?:
        | BookingSuggestion
        | BookingConfirmation
        | CancellationSuggestion
        | ChatSource[];
      conversationId?: string;
      message?: string;
    },
    modelId: string,
  ) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== modelId) return m;
        if (evt.type === "delta")
          return { ...m, content: m.content + (evt.text ?? "") };
        if (evt.type === "suggestion")
          return { ...m, suggestion: evt.data as BookingSuggestion };
        if (evt.type === "sources")
          return { ...m, sources: evt.data as ChatSource[] };
        // A real booking happened — clear any pending suggestion card.
        if (evt.type === "booked")
          return {
            ...m,
            confirmation: evt.data as BookingConfirmation,
            suggestion: undefined,
          };
        if (evt.type === "cancel_suggestion")
          return {
            ...m,
            cancellationSuggestion: evt.data as CancellationSuggestion,
            suggestion: undefined,
          };
        if (evt.type === "error")
          return {
            ...m,
            content:
              evt.message ??
              t(language, "Something went wrong. Please try again."),
            streaming: false,
            suggestion: undefined,
          };
        return m;
      }),
    );
    if (evt.type === "done" && evt.conversationId)
      setActiveId(evt.conversationId);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="flex bg-card rounded-2xl border shadow-sm h-[calc(100vh-9rem)] overflow-hidden"
    >
      {/* Sidebar */}
      <aside className="hidden lg:flex w-72 border-e flex-col bg-muted/20">
        <div className="p-3 border-b">
          <Button
            className="w-full justify-start gap-2"
            disabled={busy}
            onClick={startNewChat}
          >
            <Plus className="h-4 w-4" />
            {t(language, "New Chat")}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {t(language, "Recent Chats")}
          </h3>
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-2">
              {t(language, "No conversations yet.")}
            </p>
          ) : (
            <div className="space-y-0.5">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => void openConversation(c.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 p-2 rounded-lg text-sm transition-colors group text-start",
                    activeId === c.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-70" />
                    <span className="truncate">{c.title}</span>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={t(language, "Delete conversation")}
                    onClick={(e) => void removeConversation(c.id, e)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void removeConversation(c.id, e);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col relative bg-background/40 min-w-0">
        {/* Header */}
        <div className="p-4 border-b flex items-center gap-3 bg-card">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold leading-tight">
              {t(language, "ClinicAI Assistant")}
            </h2>
            <div className="flex items-center text-xs text-emerald-500 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 me-1.5 animate-pulse" />
              {t(language, "Online & Ready")}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6"
        >
          {isEmpty ? (
            <EmptyState language={language} onPick={(p) => setInput(p)} />
          ) : (
            messages.map((m) => (
              <Bubble
                key={m.id}
                message={m}
                onConfirm={confirmBooking}
                onConfirmCancellation={(s) => void confirmCancellation(s, m.id)}
                busy={busy}
                language={language}
              />
            ))
          )}
        </div>

        {/* Composer */}
        <div className="p-3 sm:p-4 border-t bg-card">
          <div className="max-w-3xl mx-auto flex items-end gap-2 rounded-2xl border bg-muted/40 p-2 focus-within:ring-2 focus-within:ring-primary transition-shadow">
            <Textarea
              ref={textareaRef}
              rows={1}
              placeholder={t(
                language,
                "Describe your symptoms or ask for a doctor...",
              )}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy}
              className="flex-1 border-none bg-transparent focus-visible:ring-0 shadow-none px-2 max-h-40"
            />
            <Button
              onClick={handleSend}
              size="icon"
              disabled={busy || !input.trim()}
              className="h-9 w-9 rounded-xl flex-shrink-0"
              aria-label={t(language, "Send message")}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground mt-2">
            {t(
              language,
              "ClinicAI can make mistakes. It suggests doctors — it doesn't provide medical diagnoses.",
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  message,
  onConfirm,
  onConfirmCancellation,
  busy,
  language,
}: {
  message: Message;
  onConfirm: (s: BookingSuggestion) => void;
  onConfirmCancellation: (s: CancellationSuggestion) => void;
  busy: boolean;
  language: Language;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex items-start gap-3 max-w-[90%] md:max-w-[75%]",
        isUser ? "ms-auto flex-row-reverse" : "me-auto",
      )}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm",
          isUser
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </div>
      <div
        className={cn(
          "p-4 rounded-2xl shadow-sm min-w-0",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-none"
            : "bg-card border text-card-foreground rounded-tl-none",
        )}
      >
        {message.content ? (
          <div className="prose-chat text-sm leading-relaxed">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        ) : message.streaming ? (
          <span className="inline-flex gap-1 py-1">
            <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
          </span>
        ) : null}

        {!!message.sources?.length && (
          <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
            <p className="font-medium">{t(language, "Clinic sources")}</p>
            <ul className="mt-1 space-y-1">
              {message.sources.map((source) => (
                <li key={source.id}>
                  {source.title} · {t(language, "revision")} {source.revision}
                </li>
              ))}
            </ul>
          </div>
        )}

        {message.confirmation ? (
          <BookedCard c={message.confirmation} language={language} />
        ) : message.suggestion ? (
          <SuggestionCard
            s={message.suggestion}
            onConfirm={onConfirm}
            busy={busy}
            language={language}
          />
        ) : message.cancellationSuggestion ? (
          <CancellationCard
            s={message.cancellationSuggestion}
            onConfirm={() =>
              onConfirmCancellation(message.cancellationSuggestion!)
            }
            busy={busy}
            language={language}
          />
        ) : null}

        {message.cancellationMessage && (
          <p
            className={cn(
              "mt-3 text-sm",
              message.cancellationStatus === "success"
                ? "text-emerald-600"
                : "text-destructive",
            )}
          >
            {message.cancellationMessage}
          </p>
        )}
      </div>
    </div>
  );
}

function SuggestionCard({
  s,
  onConfirm,
  busy,
  language,
}: {
  s: BookingSuggestion;
  onConfirm: (s: BookingSuggestion) => void;
  busy: boolean;
  language: Language;
}) {
  return (
    <div className="mt-3 rounded-xl border bg-background p-3 space-y-2 text-card-foreground">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Stethoscope className="h-4 w-4 text-primary" />
        {s.doctorName}
      </div>
      <p className="text-xs text-primary font-medium">{s.specialty}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarCheck className="h-3.5 w-3.5 text-primary" />
        {prettyDate(s.date, language)} · {to12h(s.time, language)}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-1">
        <Button
          size="sm"
          className="flex-1 shadow-md shadow-blue-100"
          disabled={busy || !s.proposalId}
          onClick={() => onConfirm(s)}
        >
          {t(language, "Confirm booking")}
        </Button>
        <Link href={`/doctors/${s.doctorId}`} className="flex-shrink-0">
          <Button size="sm" variant="outline" disabled={busy}>
            {t(language, "Details")}
          </Button>
        </Link>
      </div>
    </div>
  );
}

function BookedCard({
  c,
  language,
}: {
  c: BookingConfirmation;
  language: Language;
}) {
  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-900/40 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
        {t(language, "Appointment booked")}
      </div>
      <p className="text-sm font-medium">{c.doctorName}</p>
      <p className="text-xs text-primary font-medium">{c.specialty}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />{" "}
          {prettyDate(c.date, language)} · {to12h(c.time, language)}
        </span>
        <span className="flex items-center gap-1.5">
          {c.type === "video" ? (
            <Video className="h-3.5 w-3.5 text-blue-500" />
          ) : (
            <MapPin className="h-3.5 w-3.5 text-orange-500" />
          )}
          {t(language, c.type === "video" ? "Video call" : "In-person")}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t(language, "Pending the clinic's confirmation.")}
      </p>
      <Link href="/appointments">
        <Button size="sm" variant="outline" className="w-full mt-1">
          {t(language, "View my appointments")}
        </Button>
      </Link>
    </div>
  );
}

function CancellationCard({
  s,
  onConfirm,
  busy,
  language,
}: {
  s: CancellationSuggestion;
  onConfirm: () => void;
  busy: boolean;
  language: Language;
}) {
  return (
    <div className="mt-3 rounded-xl border border-red-200 bg-background p-3 space-y-3 text-card-foreground">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CalendarCheck className="h-4 w-4 text-destructive" />
        {t(language, "Appointment cancellation")}
      </div>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Stethoscope className="h-4 w-4 text-primary" />
        {s.doctorName}
      </div>
      <p className="text-xs text-primary font-medium">{s.specialty}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarCheck className="h-3.5 w-3.5" />
        {prettyDate(s.date, language)} · {to12h(s.time, language)}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {s.type === "video" ? (
          <Video className="h-3.5 w-3.5" />
        ) : (
          <MapPin className="h-3.5 w-3.5" />
        )}
        {t(language, s.type === "video" ? "Video call" : "In-person")}
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          language,
          "The appointment will not be cancelled until you confirm.",
        )}
      </p>
      <Button
        size="sm"
        variant="destructive"
        className="w-full"
        disabled={busy}
        onClick={onConfirm}
      >
        {busy
          ? t(language, "Cancelling...")
          : t(language, "Confirm Cancellation")}
      </Button>
    </div>
  );
}

function EmptyState({
  onPick,
  language,
}: {
  onPick: (p: string) => void;
  language: Language;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto animate-in fade-in duration-500">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold">
        {t(language, "How can I help you today?")}
      </h2>
      <div className="prose-chat text-sm text-muted-foreground mt-2">
        <ReactMarkdown>{language === "ar" ? GREETING_AR : GREETING}</ReactMarkdown>
      </div>
      <div className="mt-6 grid gap-2 w-full max-w-md mx-auto">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt.key}
            type="button"
            onClick={() => onPick(language === "ar" ? prompt.keyAr : prompt.key)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-slate-50 hover:border-primary/40 text-center"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {language === "ar" ? prompt.labelAr : prompt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}
