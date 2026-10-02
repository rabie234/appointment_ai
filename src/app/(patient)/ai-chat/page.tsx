"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { BookingSuggestion } from "./tools"
import {
    listConversations,
    getConversation,
    deleteConversation,
    type ConversationSummary,
} from "./actions"

type Message = {
    id: string
    role: "user" | "model"
    content: string
    suggestion?: BookingSuggestion
    streaming?: boolean
}

const GREETING =
    "Hello! I'm your **ClinicAI** assistant. Describe what's bothering you and I'll suggest the right doctor and an available time to book."

const PROMPTS = [
    "I have chest pain when I exercise",
    "I need a skin rash checked",
    "Find me a pediatrician",
]

function to12h(time: string): string {
    const [h, m] = time.split(":").map(Number)
    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

function prettyDate(date: string): string {
    const d = new Date(`${date}T00:00:00`)
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export default function AIChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [conversations, setConversations] = useState<ConversationSummary[]>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    const [input, setInput] = useState("")
    const [busy, setBusy] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const refreshConversations = useCallback(async () => {
        try {
            setConversations(await listConversations())
        } catch {
            /* non-fatal: sidebar just stays empty */
        }
    }, [])

    useEffect(() => {
        refreshConversations()
    }, [refreshConversations])

    // Smooth autoscroll as content grows.
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    }, [messages])

    // Auto-grow the textarea.
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = "auto"
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`
    }, [input])

    const isEmpty = messages.length === 0

    function startNewChat() {
        setMessages([])
        setActiveId(null)
        setInput("")
        textareaRef.current?.focus()
    }

    async function openConversation(id: string) {
        if (busy) return
        const detail = await getConversation(id)
        if (!detail) return
        setActiveId(detail.id)
        setMessages(
            detail.messages.map((m, i) => ({
                id: `${id}-${i}`,
                role: m.role,
                content: m.text,
                suggestion: m.suggestion,
            }))
        )
    }

    async function removeConversation(id: string, e: React.MouseEvent) {
        e.stopPropagation()
        await deleteConversation(id)
        if (activeId === id) startNewChat()
        refreshConversations()
    }

    async function handleSend() {
        const text = input.trim()
        if (!text || busy) return

        const history = messages.map((m) => ({ role: m.role, text: m.content }))
        const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text }
        const modelMsg: Message = { id: `m-${Date.now()}`, role: "model", content: "", streaming: true }

        setMessages((prev) => [...prev, userMsg, modelMsg])
        setInput("")
        setBusy(true)

        try {
            const res = await fetch("/api/ai-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, history, conversationId: activeId }),
            })
            if (!res.ok || !res.body) throw new Error("request failed")

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })

                // Process complete newline-delimited JSON events.
                let nl: number
                while ((nl = buffer.indexOf("\n")) !== -1) {
                    const line = buffer.slice(0, nl).trim()
                    buffer = buffer.slice(nl + 1)
                    if (!line) continue
                    handleEvent(JSON.parse(line), modelMsg.id)
                }
            }
        } catch {
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === modelMsg.id
                        ? { ...m, content: "Something went wrong. Please try again.", streaming: false }
                        : m
                )
            )
        } finally {
            setBusy(false)
            setMessages((prev) => prev.map((m) => ({ ...m, streaming: false })))
            refreshConversations()
        }
    }

    function handleEvent(evt: { type: string; text?: string; data?: BookingSuggestion; conversationId?: string; message?: string }, modelId: string) {
        setMessages((prev) =>
            prev.map((m) => {
                if (m.id !== modelId) return m
                if (evt.type === "delta") return { ...m, content: m.content + (evt.text ?? "") }
                if (evt.type === "suggestion") return { ...m, suggestion: evt.data }
                if (evt.type === "error") return { ...m, content: evt.message ?? "Error", streaming: false }
                return m
            })
        )
        if (evt.type === "done" && evt.conversationId) setActiveId(evt.conversationId)
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="flex bg-card rounded-2xl border shadow-sm h-[calc(100vh-9rem)] overflow-hidden">
            {/* Sidebar */}
            <aside className="hidden lg:flex w-72 border-r flex-col bg-muted/20">
                <div className="p-3 border-b">
                    <Button className="w-full justify-start gap-2" onClick={startNewChat}>
                        <Plus className="h-4 w-4" />
                        New Chat
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                        Recent Chats
                    </h3>
                    {conversations.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-1 py-2">No conversations yet.</p>
                    ) : (
                        <div className="space-y-0.5">
                            {conversations.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => openConversation(c.id)}
                                    className={cn(
                                        "w-full flex items-center justify-between gap-2 p-2 rounded-lg text-sm transition-colors group text-left",
                                        activeId === c.id
                                            ? "bg-primary/10 text-primary"
                                            : "hover:bg-accent hover:text-accent-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-70" />
                                        <span className="truncate">{c.title}</span>
                                    </div>
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => removeConversation(c.id, e)}
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
                        <h2 className="font-semibold leading-tight">ClinicAI Assistant</h2>
                        <div className="flex items-center text-xs text-emerald-500 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                            Online &amp; Ready
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    {isEmpty ? (
                        <EmptyState onPick={(p) => setInput(p)} />
                    ) : (
                        messages.map((m) => <Bubble key={m.id} message={m} />)
                    )}
                </div>

                {/* Composer */}
                <div className="p-3 sm:p-4 border-t bg-card">
                    <div className="max-w-3xl mx-auto flex items-end gap-2 rounded-2xl border bg-muted/40 p-2 focus-within:ring-2 focus-within:ring-primary transition-shadow">
                        <Textarea
                            ref={textareaRef}
                            rows={1}
                            placeholder="Describe your symptoms or ask for a doctor…"
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
                            aria-label="Send message"
                        >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">
                        ClinicAI can make mistakes. It suggests doctors — it doesn&apos;t provide medical diagnoses.
                    </p>
                </div>
            </div>
        </div>
    )
}

function Bubble({ message }: { message: Message }) {
    const isUser = message.role === "user"
    return (
        <div className={cn("flex items-start gap-3 max-w-[90%] md:max-w-[75%]", isUser ? "ml-auto flex-row-reverse" : "mr-auto")}>
            <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm",
                isUser ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
            )}>
                {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
            </div>
            <div className={cn(
                "p-4 rounded-2xl shadow-sm min-w-0",
                isUser ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border text-card-foreground rounded-tl-none"
            )}>
                {message.content ? (
                    <div className="prose-chat text-sm leading-relaxed">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                ) : message.streaming ? (
                    <span className="inline-flex gap-1 py-1">
                        <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
                    </span>
                ) : null}

                {message.suggestion && <SuggestionCard s={message.suggestion} />}
            </div>
        </div>
    )
}

function SuggestionCard({ s }: { s: BookingSuggestion }) {
    return (
        <div className="mt-3 rounded-xl border bg-background p-3 space-y-2 text-card-foreground">
            <div className="flex items-center gap-2 text-sm font-semibold">
                <Stethoscope className="h-4 w-4 text-primary" />
                {s.doctorName}
            </div>
            <p className="text-xs text-primary font-medium">{s.specialty}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                {prettyDate(s.date)} · {to12h(s.time)}
            </div>
            <Link href={`/doctors/${s.doctorId}`}>
                <Button size="sm" className="w-full mt-1 shadow-md shadow-blue-100">Book this slot</Button>
            </Link>
        </div>
    )
}

function EmptyState({ onPick }: { onPick: (p: string) => void }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto animate-in fade-in duration-500">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">How can I help you today?</h2>
            <div className="prose-chat text-sm text-muted-foreground mt-2">
                <ReactMarkdown>{GREETING}</ReactMarkdown>
            </div>
            <div className="mt-6 grid gap-2 w-full">
                {PROMPTS.map((p) => (
                    <button
                        key={p}
                        onClick={() => onPick(p)}
                        className="text-left text-sm px-4 py-3 rounded-xl border bg-card hover:border-primary hover:text-primary transition-colors"
                    >
                        {p}
                    </button>
                ))}
            </div>
        </div>
    )
}

function Dot({ delay = "0ms" }: { delay?: string }) {
    return (
        <span
            className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: delay }}
        />
    )
}
