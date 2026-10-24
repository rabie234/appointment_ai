import mongoose, { Schema, Document, Model } from "mongoose";
import type {
  BookingSuggestion,
  BookingConfirmation,
} from "@/app/(patient)/ai-chat/tools";

/**
 * A persisted AI-chat conversation for one patient. Messages are stored inline
 * (a conversation is small and always loaded whole), with an optional booking
 * suggestion attached to a model turn so the UI can re-render the Book card when
 * a past conversation is reopened.
 */

export interface IChatMessage {
  role: "user" | "model";
  text: string;
  suggestion?: BookingSuggestion;
  confirmation?: BookingConfirmation;
  sources?: { id: string; title: string; source: string; revision: number }[];
  createdAt: Date;
}

export interface IConversation extends Document {
  patient: mongoose.Types.ObjectId;
  title: string;
  messages: IChatMessage[];
  pendingBooking?: BookingSuggestion;
  createdAt: Date;
  updatedAt: Date;
}

const SuggestionSchema = new Schema(
  {
    proposalId: String,
    doctorId: String,
    doctorName: String,
    specialty: String,
    date: String,
    time: String,
  },
  { _id: false },
);

const MessageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ["user", "model"], required: true },
    text: { type: String, default: "" },
    suggestion: { type: SuggestionSchema, default: undefined },
    confirmation: {
      type: new Schema(
        {
          appointmentId: String,
          doctorName: String,
          specialty: String,
          date: String,
          time: String,
          type: { type: String, enum: ["in-person", "video"] },
        },
        { _id: false },
      ),
      default: undefined,
    },
    sources: {
      type: [
        new Schema(
          { id: String, title: String, source: String, revision: Number },
          { _id: false },
        ),
      ],
      default: [],
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ConversationSchema = new Schema<IConversation>(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New conversation",
      trim: true,
    },
    messages: {
      type: [MessageSchema],
      default: [],
    },
    pendingBooking: { type: SuggestionSchema, default: undefined },
  },
  { timestamps: true },
);

// Most recent conversations first, per patient.
ConversationSchema.index({ patient: 1, updatedAt: -1 });

const Conversation: Model<IConversation> =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>("Conversation", ConversationSchema);

export default Conversation;
