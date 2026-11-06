import mongoose, { Schema, type Document, type Model } from "mongoose"

export type NotificationCategory =
    | "appointment"
    | "leave"
    | "schedule"
    | "system"

export interface INotification extends Document {
    recipient: mongoose.Types.ObjectId
    category: NotificationCategory
    titleKey: string
    bodyKey: string
    href: string
    context?: string
    readAt?: Date
    createdAt: Date
    updatedAt: Date
}

const NotificationSchema = new Schema<INotification>(
    {
        recipient: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        category: {
            type: String,
            enum: ["appointment", "leave", "schedule", "system"],
            required: true,
        },
        titleKey: {
            type: String,
            required: true,
            trim: true,
        },
        bodyKey: {
            type: String,
            required: true,
            trim: true,
        },
        href: {
            type: String,
            required: true,
            trim: true,
        },
        context: {
            type: String,
            trim: true,
            maxlength: 240,
        },
        readAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
)

NotificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 })

const Notification: Model<INotification> =
    mongoose.models.Notification ||
    mongoose.model<INotification>("Notification", NotificationSchema)

export default Notification