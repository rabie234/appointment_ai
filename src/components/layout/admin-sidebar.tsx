
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
    LayoutDashboard,
    Users,
    Calendar,
    UserRound,
    Settings,
    BarChart3,
    BrainCircuit,
    HeartPulse,
    CalendarOff,
    X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"

const adminNavItems = [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Doctors", href: "/admin/doctors", icon: Users },
    { name: "Doctor Leaves", href: "/admin/doctor-leaves", icon: CalendarOff },
    { name: "Appointments", href: "/admin/appointments", icon: Calendar },
    { name: "Patients", href: "/admin/patients", icon: UserRound },
    { name: "AI Training", href: "/admin/ai-training", icon: BrainCircuit },
    { name: "Reports", href: "/admin/reports", icon: BarChart3 },
    { name: "Settings", href: "/admin/settings", icon: Settings },
]

export function AdminSidebar() {
    const pathname = usePathname()
    const { language } = useLanguage()
    const isArabic = language === "ar"

    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        const openMenu = () => setMobileOpen(true)
        const closeMenu = () => setMobileOpen(false)

        window.addEventListener("admin-menu-open", openMenu)
        window.addEventListener("admin-menu-close", closeMenu)

        return () => {
            window.removeEventListener("admin-menu-open", openMenu)
            window.removeEventListener("admin-menu-close", closeMenu)
        }
    }, [])

    const handleClose = () => setMobileOpen(false)

    const sidebarContent = (
        <>
            <div className="p-6 border-b flex items-center gap-2 shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                    <HeartPulse className="h-6 w-6" />
                </div>

                <div>
                    <span className="text-xl font-bold tracking-tight text-primary">
                        ClinicAI
                    </span>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">
                        {t(language, "Admin Panel")}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleClose}
                    aria-label={isArabic ? "إغلاق القائمة" : "Close menu"}
                    className="ml-auto rounded-lg p-2 hover:bg-accent lg:hidden"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {adminNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive =
                        pathname === item.href ||
                        pathname.startsWith(`${item.href}/`)

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            onClick={handleClose}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
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
        </>
    )

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="hidden lg:flex lg:w-64 lg:shrink-0 flex-col border-r rtl:border-r-0 rtl:border-l bg-card h-screen sticky top-0 overflow-hidden">
                {sidebarContent}
            </aside>

            {/* Mobile sidebar drawer */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button
                        type="button"
                        aria-label={isArabic ? "إغلاق القائمة" : "Close menu"}
                        onClick={handleClose}
                        className="absolute inset-0 bg-black/50"
                    />

                    <aside
                        dir={isArabic ? "rtl" : "ltr"}
                        className={cn(
                            "absolute inset-y-0 w-72 max-w-[85vw] flex flex-col bg-card shadow-xl",
                            isArabic ? "right-0" : "left-0"
                        )}
                    >
                        {sidebarContent}
                    </aside>
                </div>
            )}
        </>
    )
}
