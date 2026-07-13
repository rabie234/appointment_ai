"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Shared by the patient navbar and the admin sidebar. Delegating the redirect
 * to NextAuth (rather than signOut({redirect:false}) + router.push) guarantees
 * the session cookie is cleared before we navigate.
 */
export function LogoutButton({ className }: { className?: string }) {
    return (
        <button
            onClick={() => signOut({ redirectTo: "/auth/login" })}
            className={cn(
                "flex items-center space-x-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10",
                className
            )}
        >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
        </button>
    )
}
