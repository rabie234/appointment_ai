"use client"

import { Search, Bell, User, MessageSquare } from "lucide-react"
import type { Session } from "next-auth"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function AdminTopbar({ user }: { user: Session["user"] }) {
    return (
        <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background/95 backdrop-blur px-4 md:px-6">
            <div className="flex flex-1 items-center gap-4">
                <div className="relative w-full max-w-md hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search records..."
                        className="pl-10 bg-muted/40 border-none h-10 rounded-xl focus-visible:ring-primary"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="relative h-10 w-10 text-muted-foreground hover:text-primary rounded-xl">
                    <MessageSquare className="h-5 w-5" />
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary border-2 border-background" />
                </Button>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 text-muted-foreground hover:text-primary rounded-xl">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive border-2 border-background" />
                </Button>

                <div className="h-8 w-[1px] bg-border mx-2" />

                <div className="flex items-center gap-3 pl-2">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold leading-tight">{user.name}</p>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                            {user.email}
                        </p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                        <User className="h-6 w-6 text-primary" />
                    </div>
                </div>
            </div>
        </header>
    )
}
