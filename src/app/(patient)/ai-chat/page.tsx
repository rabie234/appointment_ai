"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Plus,
    MessageSquare,
    Send,
    Mic,
    Bot,
    User,
    Clock,
    ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"

const initialMessages = [
    { id: 1, role: 'ai', content: "Hello Rabie! I'm your ClinicAI assistant. How can I help you today? I can suggest doctors, check available slots, or help you manage your appointments.", timestamp: '10:00 AM' },
    { id: 2, role: 'user', content: "I need to find a cardiologist for a follow-up visit.", timestamp: '10:01 AM' },
    { id: 3, role: 'ai', content: "I've found 3 cardiologists available this week. Would you like to see their profiles or should I check for the earliest available slot?", timestamp: '10:01 AM' },
]

const recentChats = [
    { id: 1, title: "Cardiologist Search", date: "Today" },
    { id: 2, title: "Lab Results Query", date: "Yesterday" },
    { id: 3, title: "General Consultation", date: "Mar 2, 2026" },
]

export default function AIChatPage() {
    const [messages, setMessages] = useState(initialMessages)
    const [input, setInput] = useState("")

    const handleSend = () => {
        if (!input.trim()) return
        const newMessage = { id: messages.length + 1, role: 'user', content: input, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        setMessages([...messages, newMessage])
        setInput("")

        // Simulate AI response
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: prev.length + 1,
                role: 'ai',
                content: "That sounds like a great plan. Let me check the availability for you.",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }])
        }, 1000)
    }

    return (
        <div className="flex bg-card rounded-2xl border shadow-sm h-[calc(100vh-12rem)] overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
            {/* Sidebar */}
            <div className="hidden lg:flex w-80 border-r flex-col bg-muted/20">
                <div className="p-4 border-b">
                    <Button className="w-full justify-start space-x-2" variant="default">
                        <Plus className="h-4 w-4" />
                        <span>New Chat</span>
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Chats</h3>
                        <div className="space-y-1">
                            {recentChats.map((chat) => (
                                <button
                                    key={chat.id}
                                    className="w-full flex items-center justify-between p-2 rounded-lg text-sm hover:bg-accent hover:text-accent-foreground transition-colors group"
                                >
                                    <div className="flex items-center space-x-3 truncate">
                                        <MessageSquare className="h-4 w-4 text-primary" />
                                        <span className="truncate">{chat.title}</span>
                                    </div>
                                    <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col relative bg-background/50">
                {/* Chat Header */}
                <div className="p-4 border-b flex items-center justify-between bg-card">
                    <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="font-semibold">ClinicAI Assistant</h2>
                            <div className="flex items-center text-xs text-emerald-500 font-medium tracking-tight">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                                Online & Ready
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((m) => (
                        <div
                            key={m.id}
                            className={cn(
                                "flex items-start gap-3 max-w-[85%] md:max-w-[70%]",
                                m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                            )}
                        >
                            <div className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm",
                                m.role === 'ai' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                                {m.role === 'ai' ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
                            </div>
                            <div className="space-y-1">
                                <div className={cn(
                                    "p-4 rounded-2xl shadow-sm",
                                    m.role === 'ai'
                                        ? "bg-card border text-card-foreground rounded-tl-none"
                                        : "bg-primary text-primary-foreground rounded-tr-none"
                                )}>
                                    <p className="text-sm leading-relaxed">{m.content}</p>
                                </div>
                                <div className={cn(
                                    "flex items-center text-[10px] text-muted-foreground px-1",
                                    m.role === 'user' ? "justify-end" : "justify-start"
                                )}>
                                    <Clock className="h-3 w-3 mr-1" />
                                    {m.timestamp}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Suggestions */}
                <div className="px-6 py-2 flex flex-wrap gap-2">
                    {["Suggest available doctors", "Show available time slots", "Help cancel appointment"].map(s => (
                        <button key={s} className="px-3 py-1.5 bg-accent text-accent-foreground text-xs rounded-full hover:bg-accent/80 transition-colors border shadow-sm">
                            {s}
                        </button>
                    ))}
                </div>

                {/* Input Bar */}
                <div className="p-4 border-t bg-card">
                    <div className="max-w-4xl mx-auto relative flex items-center gap-2">
                        <div className="relative flex-1">
                            <Input
                                placeholder="Type your message..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                className="pr-20 bg-muted/50 border-none h-12 rounded-xl focus-visible:ring-primary"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                    <Mic className="h-5 w-5" />
                                </Button>
                                <Button
                                    onClick={handleSend}
                                    size="icon"
                                    className="h-8 w-8 rounded-lg shadow-blue-200 shadow-md"
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
