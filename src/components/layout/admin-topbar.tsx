
"use client"

import { useState, useEffect, useRef } from "react"
import type { Session } from "next-auth"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import { NotificationsBell } from "./notifications-bell"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { LogoutButton } from "./logout-button"
import {
    Search,
    ChevronDown,
    Languages,
    Menu,
    UserRound,
    Stethoscope,
    CalendarDays,
} from "lucide-react"

type SearchResult = {
    id: string
    type: "patient" | "doctor" | "appointment"
    title: string
    subtitle: string | null
    status?: string
    date?: string
    time?: string
    href: string
}

export function AdminTopbar({
    user,
}: {
    user: Session["user"]
    onMenuClick?: () => void
}) {
    const { language } = useLanguage()
    const isArabic = language === "ar"
    const router = useRouter()

    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)

    const dropdownRef = useRef<HTMLDivElement>(null)

    // Translate the search result type based on the selected language.
    const getResultTypeLabel = (type: SearchResult["type"]) => {
        if (isArabic) {
            return {
                patient: "مريض",
                doctor: "طبيب",
                appointment: "موعد",
            }[type]
        }

        return {
            patient: "Patient",
            doctor: "Doctor",
            appointment: "Appointment",
        }[type]
    }

    // Search patients, doctors, and appointments.
    useEffect(() => {
        const query = searchQuery.trim()

        if (query.length < 2) {
            setSearchResults([])
            setIsSearching(false)
            return
        }

        let cancelled = false

        const timer = setTimeout(async () => {
            setIsSearching(true)

            try {
                const response = await fetch(
                    `/api/search?q=${encodeURIComponent(query)}`
                )

                if (!response.ok) {
                    throw new Error("Search failed")
                }

                const data = await response.json()

                if (!cancelled) {
                    setSearchResults(data.results ?? [])
                }
            } catch {
                if (!cancelled) {
                    setSearchResults([])
                }
            } finally {
                if (!cancelled) {
                    setIsSearching(false)
                }
            }
        }, 300)

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [searchQuery])

    // Close the profile dropdown when clicking outside or pressing Escape.
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false)
            }
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        document.addEventListener("keydown", handleEscape)

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
            document.removeEventListener("keydown", handleEscape)
        }
    }, [])

    return (
        <header
            dir={isArabic ? "rtl" : "ltr"}
            className="sticky top-0 z-30 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur md:px-6"
        >
            {/* Mobile sidebar button */}
            <button
                type="button"
                onClick={() =>
                    window.dispatchEvent(new Event("admin-menu-open"))
                }
                aria-label={
                    isArabic ? "فتح القائمة الجانبية" : "Open sidebar"
                }
                className="lg:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
                <Menu className="h-6 w-6" />
            </button>

            <div className="flex flex-1 items-center gap-4">
                {/* Global search */}
                <div className="relative hidden w-full max-w-md md:block">
                    <Search
                        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                            isArabic ? "right-3" : "left-3"
                        }`}
                    />

                    <Input
                        value={searchQuery}
                        onChange={(event) =>
                            setSearchQuery(event.target.value)
                        }
                        placeholder={t(language, "Search records...")}
                        autoComplete="off"
                        className={`h-10 rounded-xl border-none bg-muted/40 focus-visible:ring-primary ${
                            isArabic ? "pr-10" : "pl-10"
                        }`}
                    />

                    {/* Search results dropdown */}
                    {searchQuery.trim().length >= 2 && (
                        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border bg-background p-2 shadow-lg">
                            {isSearching ? (
                                <p className="p-3 text-sm text-muted-foreground">
                                    {isArabic
                                        ? "جارٍ البحث..."
                                        : "Searching..."}
                                </p>
                            ) : searchResults.length > 0 ? (
                                <div className="space-y-1">
                                    {searchResults.map((result) => {
                                        const Icon =
                                            result.type === "patient"
                                                ? UserRound
                                                : result.type === "doctor"
                                                ? Stethoscope
                                                : CalendarDays

                                        return (
                                            <button
                                                key={`${result.type}-${result.id}`}
                                                type="button"
                                                onClick={() => {
                                                    router.push(result.href)
                                                    setSearchQuery("")
                                                    setSearchResults([])
                                                }}
                                                className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                            >
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium">
                                                        {result.title}
                                                    </p>

                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {getResultTypeLabel(
                                                            result.type
                                                        )}
                                                        {result.subtitle
                                                            ? ` · ${result.subtitle}`
                                                            : ""}
                                                    </p>

                                                    {result.type ===
                                                        "appointment" && (
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            {result.date} ·{" "}
                                                            {result.time}
                                                            {result.status
                                                                ? ` · ${result.status}`
                                                                : ""}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="p-3 text-sm text-muted-foreground">
                                    {isArabic
                                        ? "لم يتم العثور على نتائج."
                                        : "No records found."}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <NotificationsBell />

            {/* Admin profile dropdown */}
            <div className="relative" ref={dropdownRef}>
                <button
                    type="button"
                    onClick={() => setIsOpen((open) => !open)}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    aria-label={
                        isArabic
                            ? "فتح قائمة الحساب"
                            : "Open account menu"
                    }
                    className="flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-primary/20 bg-primary/10">
                        <span className="text-lg font-bold text-primary">
                            {(user?.name || "Admin User")
                                .trim()
                                .charAt(0)
                                .toUpperCase()}
                        </span>
                    </div>

                    <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                            isOpen ? "rotate-180" : ""
                        }`}
                    />
                </button>

                {isOpen && (
                    <div
                        dir={isArabic ? "rtl" : "ltr"}
                        className={`absolute top-full z-50 mt-2 w-64 rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg ${
                            isArabic ? "left-0" : "right-0"
                        }`}
                    >
                        <div className="border-b px-3 py-2">
                            <p className="text-sm font-semibold">
                                {user?.name || "Admin User"}
                            </p>

                            <p
                                dir="ltr"
                                className={`text-xs text-muted-foreground ${
                                    isArabic ? "text-right" : "text-left"
                                }`}
                            >
                                {user?.email || ""}
                            </p>
                        </div>

                        <div className="space-y-2 p-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Languages className="h-4 w-4 text-muted-foreground" />

                                <span>
                                    {isArabic
                                        ? "تغيير اللغة"
                                        : "Switch Language"}
                                </span>
                            </div>

                            <LanguageSwitcher />
                        </div>

                        <div className="my-1 border-t" />

                        <LogoutButton className="w-full rounded-lg px-3 py-2.5" />
                    </div>
                )}
            </div>
        </header>
    )
}