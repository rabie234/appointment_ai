
"use client"

import { Search, User } from "lucide-react"
import type { Session } from "next-auth"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"

export function AdminTopbar({ user }: { user: Session["user"] }) {
    const { language } = useLanguage()
    const isArabic = language === "ar"

    return (
        <header
            dir={isArabic ? "rtl" : "ltr"}
            className="sticky top-0 z-30 flex h-16 items-center border-b bg-background/95 backdrop-blur px-4 md:px-6"
        >
            <div className="flex flex-1 items-center gap-4">
                <div className="relative w-full max-w-md hidden md:block">
                    <Search
                        className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${
                            isArabic ? "right-3" : "left-3"
                        }`}
                    />
                    <Input
                        placeholder={t(language, "Search records...")}
                        className={`bg-muted/40 border-none h-10 rounded-xl focus-visible:ring-primary ${
                            isArabic ? "pr-10" : "pl-10"
                        }`}
                    />
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className={`${isArabic ? "text-left" : "text-right"} hidden sm:block`}>
                    <p className="text-sm font-bold leading-tight">{user.name}</p>
                    <p
                        dir="ltr"
                        className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter"
                    >
                        {user.email}
                    </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                    <User className="h-6 w-6 text-primary" />
                </div>
            </div>
        </header>
    )
}
