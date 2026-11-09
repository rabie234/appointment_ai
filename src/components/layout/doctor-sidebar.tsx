"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Calendar, CalendarDays, Clock, UserCog, HeartPulse, X } from "lucide-react"
import { LogoutButton } from "./logout-button"
import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"

const doctorNavItems = [
    { name: "Appointments", href: "/doctor/appointments", icon: Calendar },
    { name: "Leaves", href: "/doctor/leaves", icon: CalendarDays },
    { name: "My Account", href: "/doctor/account", icon: UserCog },
    { name: "Working Hours", href: "/doctor/working-hours", icon: Clock },
]

export function DoctorSidebar() {
    const pathname = usePathname()
    const { language } = useLanguage()

    return (
        <aside className="hidden lg:flex flex-col w-64 border-r bg-card h-screen sticky top-0 overflow-hidden">
            <div className="p-6 border-b flex items-center space-x-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-blue-200">
                    <HeartPulse className="h-6 w-6" />
                </div>
                <div>
                    <span className="text-xl font-bold tracking-tight text-primary">ClinicAI</span>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">{t(language, "Doctor Panel")}</p>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {doctorNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-md shadow-blue-100"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
                            <Icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-primary group-hover:scale-110 transition-transform")} />
                            <span>{t(language, item.name)}</span>
                        </Link>
                    )
                })}
            </nav>
        </aside>
    )
}

/** Mobile navigation opens as a drawer from the top-bar menu button. */
export function DoctorMobileNav() {
    const pathname = usePathname()
    const { language } = useLanguage()
    const isArabic = language === "ar"
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        const openMenu = () => setMobileOpen(true)
        const closeMenu = () => setMobileOpen(false)
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeMenu()
        }

        window.addEventListener("admin-menu-open", openMenu)
        window.addEventListener("admin-menu-close", closeMenu)
        document.addEventListener("keydown", handleKeyDown)

        return () => {
            window.removeEventListener("admin-menu-open", openMenu)
            window.removeEventListener("admin-menu-close", closeMenu)
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [])

    const closeMenu = () => setMobileOpen(false)

    return (
        <>
            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button
                        type="button"
                        aria-label={isArabic ? "إغلاق القائمة" : "Close menu"}
                        onClick={closeMenu}
                        className="absolute inset-0 bg-black/50"
                    />

                    <aside
                        dir={isArabic ? "rtl" : "ltr"}
                        aria-label={isArabic ? "القائمة الجانبية للطبيب" : "Doctor navigation"}
                        className={cn(
                            "absolute inset-y-0 flex w-72 max-w-[85vw] flex-col bg-card shadow-xl",
                            isArabic ? "right-0" : "left-0"
                        )}
                    >
                        <div className="flex shrink-0 items-center gap-2 border-b p-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-blue-200">
                                <HeartPulse className="h-6 w-6" />
                            </div>
                            <div>
                                <span className="text-xl font-bold tracking-tight text-primary">ClinicAI</span>
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t(language, "Doctor Panel")}</p>
                            </div>
                            <button
                                type="button"
                                onClick={closeMenu}
                                aria-label={isArabic ? "إغلاق القائمة" : "Close menu"}
                                className="ms-auto rounded-lg p-2 hover:bg-accent"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
                            {doctorNavItems.map((item) => {
                                const Icon = item.icon
                                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={closeMenu}
                                        className={cn(
                                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                                            isActive
                                                ? "bg-primary text-primary-foreground shadow-md"
                                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                        )}
                                    >
                                        <Icon className="h-5 w-5 shrink-0" />
                                        <span>{t(language, item.name)}</span>
                                    </Link>
                                )
                            })}
                        </nav>
                    </aside>
                </div>
            )}
        </>
    )
}
