"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Session } from "next-auth"
import { useState, useRef, useEffect } from "react"
import { Home, Users, Calendar, MessageSquare, Menu, X, HeartPulse, ChevronDown } from "lucide-react"
import { LogoutButton } from "./logout-button"
import { cn } from "@/lib/utils"

const navItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Doctors", href: "/doctors", icon: Users },
    { name: "Appointments", href: "/appointments", icon: Calendar },
    { name: "AI Chat", href: "/ai-chat", icon: MessageSquare },
]

function initials(name?: string | null): string {
    if (!name) return "U"
    return name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("")
}

export function PatientNavbar({ user }: { user: Session["user"] }) {
    const pathname = usePathname()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close the profile menu on outside-click or Escape.
    useEffect(() => {
        if (!menuOpen) return
        function onDown(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setMenuOpen(false)
        }
        document.addEventListener("mousedown", onDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [menuOpen])

    function isActive(href: string) {
        return pathname === href || (href !== "/" && pathname.startsWith(href))
    }

    return (
        <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between gap-4">
                    {/* Brand */}
                    <Link href="/" className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <HeartPulse className="h-5 w-5" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-primary">ClinicAI</span>
                    </Link>

                    {/* Desktop nav */}
                    <div className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                        isActive(item.href)
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span>{item.name}</span>
                                </Link>
                            )
                        })}
                    </div>

                    {/* Profile (desktop) */}
                    <div className="hidden md:block relative" ref={menuRef}>
                        <button
                            onClick={() => setMenuOpen((o) => !o)}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-accent transition-colors"
                        >
                            <span className="h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                                {initials(user.name)}
                            </span>
                            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", menuOpen && "rotate-180")} />
                        </button>
                        {menuOpen && (
                            <div role="menu" className="absolute right-0 top-full mt-2 w-56 bg-card border rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                <div className="p-3 border-b">
                                    <p className="text-sm font-semibold truncate">{user.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                </div>
                                <LogoutButton className="w-full px-3 py-2.5" />
                            </div>
                        )}
                    </div>

                    {/* Mobile toggle */}
                    <button
                        className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg hover:bg-accent"
                        onClick={() => setMobileOpen((o) => !o)}
                        aria-label="Toggle menu"
                    >
                        {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile nav */}
            {mobileOpen && (
                <div className="md:hidden border-t bg-background animate-in slide-in-from-top-2 duration-150">
                    <div className="space-y-1 px-3 pb-3 pt-2">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors",
                                        isActive(item.href)
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    )}
                                >
                                    <Icon className="h-5 w-5" />
                                    <span>{item.name}</span>
                                </Link>
                            )
                        })}
                        <div className="mt-2 border-t pt-2">
                            <div className="flex items-center gap-3 px-3 py-2">
                                <span className="h-9 w-9 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                                    {initials(user.name)}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate">{user.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                </div>
                            </div>
                            <LogoutButton className="w-full px-3 py-2.5 rounded-lg" />
                        </div>
                    </div>
                </div>
            )}
        </nav>
    )
}
