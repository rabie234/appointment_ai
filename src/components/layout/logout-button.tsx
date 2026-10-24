
"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"

/**
 * Shared by the patient navbar and the admin sidebar.
 * NextAuth clears the session cookie before redirecting.
 */
export function LogoutButton({ className }: { className?: string }) {
    const { language } = useLanguage()

    return (
        <button
            onClick={() => signOut({ redirectTo: "/auth/login" })}
            className={cn(
                "flex items-center gap-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10",
                className
            )}
        >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>{t(language, "Logout")}</span>
        </button>
    )
}
