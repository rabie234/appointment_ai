"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/lib/mongodb";
import { requireRole } from "@/lib/session";
import Conversation from "@/models/Conversation";
import type { BookingSuggestion, BookingConfirmation } from "./tools";
import { isValidObjectId } from "mongoose";

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type StoredMessage = {
  role: "user" | "model";
  text: string;
  suggestion?: BookingSuggestion;
  confirmation?: BookingConfirmation;
  sources?: { id: string; title: string; source: string; revision: number }[];
};

export type ConversationDetail = {
  id: string;
  title: string;
  messages: StoredMessage[];
};

/** List the signed-in patient's conversations, newest first. */
export async function listConversations(): Promise<ConversationSummary[]> {
  const session = await requireRole("patient");
  await connectDB();

  const docs = await Conversation.find({ patient: session.user.id })
    .select("title updatedAt")
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  return docs.map((c) => ({
    id: String(c._id),
    title: c.title,
    updatedAt: new Date(c.updatedAt).toISOString(),
  }));
}

/** Load one conversation the patient owns. Returns null if not found/owned. */
export async function getConversation(
  id: string,
): Promise<ConversationDetail | null> {
  const session = await requireRole("patient");
  if (!isValidObjectId(id)) return null;
  await connectDB();

  const doc = await Conversation.findOne({
    _id: id,
    patient: session.user.id,
  }).lean();
  if (!doc) return null;

  return {
    id: String(doc._id),
    title: doc.title,
    messages: doc.messages.map((m) => ({
      role: m.role,
      text: m.text,
      suggestion:
        m.suggestion?.proposalId === doc.pendingBooking?.proposalId
          ? m.suggestion
          : undefined,
      confirmation: m.confirmation,
      sources: m.sources,
    })),
  };
}

/** Delete a conversation the patient owns. */
export async function deleteConversation(id: string): Promise<{ ok: boolean }> {
  const session = await requireRole("patient");
  if (!isValidObjectId(id)) return { ok: false };
  await connectDB();

  await Conversation.deleteOne({ _id: id, patient: session.user.id });
  revalidatePath("/ai-chat");
  return { ok: true };
}
