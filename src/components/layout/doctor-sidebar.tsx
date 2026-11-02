"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, UserCog, HeartPulse } from "lucide-react"
import { LogoutButton } from "./logout-button"
import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"

const doctorNavItems = [
    { name: "Appointments", href: "/doctor/appointments", icon: Calendar },
    { name: "My Account", href: "/doctor/account", icon: UserCog },
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

            <div className="p-4 border-t space-y-3">
                <LanguageSwitcher />
                <LogoutButton className="w-full px-3 py-2.5 rounded-xl" />
            </div>
        </aside>
    )
}

/** The sidebar is desktop-only, so phones get this compact bar instead. */
export function DoctorMobileNav() {
    const pathname = usePathname()
    const { language } = useLanguage()

    return (
        <nav className="lg:hidden flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
            {doctorNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                    <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap",
                            isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {t(language, item.name)}
                    </Link>
                )
            })}
            <div className="ml-auto flex items-center gap-2">
                <LanguageSwitcher />
                <LogoutButton className="px-3 py-2 rounded-lg" />
            </div>
        </nav>
    )
}
