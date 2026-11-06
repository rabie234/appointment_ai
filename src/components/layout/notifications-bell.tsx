"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck } from "lucide-react"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import {
    getMyNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    type NotificationView,
} from "@/app/actions/notifications"

export function NotificationsBell() {
    const { language } = useLanguage()
    const router = useRouter()
    const menuRef = useRef<HTMLDivElement>(null)
    const [open, setOpen] = useState(false)
    const [items, setItems] = useState<NotificationView[]>([])
    const [unreadCount, setUnreadCount] = useState(0)

    async function refreshNotifications() {
        try {
            const result = await getMyNotifications()
            setItems(result.items)
            setUnreadCount(result.unreadCount)
        } catch (error) {
            console.error("Load notifications failed:", error)
        }
    }

    useEffect(() => {
        void refreshNotifications()
        const timer = window.setInterval(
            () => void refreshNotifications(),
            30000
        )

        return () => window.clearInterval(timer)
    }, [])

    useEffect(() => {
        if (!open) return

        function handleOutsideClick(event: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setOpen(false)
            }
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false)
        }

        document.addEventListener("mousedown", handleOutsideClick)
        document.addEventListener("keydown", handleEscape)

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick)
            document.removeEventListener("keydown", handleEscape)
        }
    }, [open])

    async function openNotification(item: NotificationView) {
        if (!item.readAt) {
            await markNotificationRead(item.id)
            setItems((current) =>
                current.map((notification) =>
                    notification.id === item.id
                        ? {
                              ...notification,
                              readAt: new Date().toISOString(),
                          }
                        : notification
                )
            )
            setUnreadCount((current) => Math.max(0, current - 1))
        }

        setOpen(false)
        router.push(item.href)
    }

    async function markAllRead() {
        await markAllNotificationsRead()
        const now = new Date().toISOString()

        setItems((current) =>
            current.map((item) => ({ ...item, readAt: item.readAt ?? now }))
        )
        setUnreadCount(0)
    }

    const dateFormatter = new Intl.DateTimeFormat(
        language === "ar" ? "ar-LB" : "en-US",
        {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }
    )

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                aria-label={t(language, "Notifications")}
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    dir={language === "ar" ? "rtl" : "ltr"}
                    className="absolute end-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl"
                >
                    <div className="flex items-center justify-between border-b px-4 py-3">
                        <h2 className="font-semibold">
                            {t(language, "Notifications")}
                        </h2>
                        <button
                            type="button"
                            disabled={unreadCount === 0}
                            onClick={() => void markAllRead()}
                            className="text-xs font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {t(language, "Mark all read")}
                        </button>
                    </div>

                    <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
                        {items.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                                {t(language, "No notifications yet")}
                            </p>
                        ) : (
                            items.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => void openNotification(item)}
                                    className={
                                        "block w-full border-b px-4 py-3 text-start transition-colors hover:bg-muted/70 " +
                                        (item.readAt ? "" : "bg-primary/5")
                                    }
                                >
                                    <span className="flex items-start gap-3">
                                        <span
                                            className={
                                                "mt-1.5 h-2 w-2 shrink-0 rounded-full " +
                                                (item.readAt
                                                    ? "bg-transparent"
                                                    : "bg-primary")
                                            }
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold">
                                                {t(language, item.titleKey)}
                                            </span>
                                            <span className="mt-1 block text-xs text-muted-foreground">
                                                {t(language, item.bodyKey)}
                                            </span>
                                            {item.context && (
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    {item.context}
                                                </span>
                                            )}
                                            <span className="mt-2 block text-[11px] text-muted-foreground">
                                                {dateFormatter.format(
                                                    new Date(item.createdAt)
                                                )}
                                            </span>
                                        </span>
                                    </span>
                                </button>
                            ))
                        )}
                    </div>

                    {items.length > 0 && unreadCount === 0 && (
                        <div className="flex items-center justify-center gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
                            <CheckCheck className="h-4 w-4" />
                            {t(language, "All caught up")}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}