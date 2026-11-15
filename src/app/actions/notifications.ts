"use server"

import { isValidObjectId } from "mongoose"
import { requireSession } from "@/lib/session"
import connectDB from "@/lib/mongodb"
import Notification from "@/models/Notification"

export type NotificationView = {
    id: string
    category: "appointment" | "leave" | "schedule" | "system"
    titleKey: string
    bodyKey: string
    href: string
    context: string
    readAt: string | null
    createdAt: string
}

export async function getMyNotifications(): Promise<{
    items: NotificationView[]
    unreadCount: number
}> {
    const session = await requireSession()
    await connectDB()

    const [documents, unreadCount] = await Promise.all([
        Notification.find({ recipient: session.user.id })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean(),
        Notification.countDocuments({
            recipient: session.user.id,
            readAt: null,
        }),
    ])

    return {
        items: documents.map((item) => ({
            id: String(item._id),
            category: item.category,
            titleKey: item.titleKey,
            bodyKey: item.bodyKey,
            href: item.href,
            context: item.context ?? "",
            readAt: item.readAt ? new Date(item.readAt).toISOString() : null,
            createdAt: new Date(item.createdAt).toISOString(),
        })),
        unreadCount,
    }
}

export async function markNotificationRead(id: string) {
    const session = await requireSession()

    if (!isValidObjectId(id)) {
        return { success: false }
    }

    await connectDB()

    const result = await Notification.updateOne(
        {
            _id: id,
            recipient: session.user.id,
            readAt: null,
        },
        { $set: { readAt: new Date() } }
    )

    return { success: result.modifiedCount > 0 }
}

export async function markAllNotificationsRead() {
    const session = await requireSession()
    await connectDB()

    await Notification.updateMany(
        {
            recipient: session.user.id,
            readAt: null,
        },
        { $set: { readAt: new Date() } }
    )

    return { success: true }
}