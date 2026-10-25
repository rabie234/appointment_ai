import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Conversation, { type IChatMessage } from "@/models/Conversation";
import AIRun from "@/models/AIRun";
import { runAssistant } from "@/lib/ai-assistant";
import {
  runTool,
  type BookingSuggestion,
  type BookingConfirmation,
} from "../../(patient)/ai-chat/tools";
import type { ChatTurn } from "../../(patient)/ai-chat/chat-core";

export const dynamic = "force-dynamic";

/** Streaming chat; explicit confirmation consumes one saved, patient-owned proposal. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "patient")
    return new Response("Unauthorized", { status: 401 });
  const patientId = session.user.id;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 4000)
    return new Response("Message must contain 1–4,000 characters.", {
      status: 400,
    });
  const conversationId = body.conversationId;
  if (
    conversationId !== null &&
    conversationId !== undefined &&
    (typeof conversationId !== "string" || !isValidObjectId(conversationId))
  ) {
    return new Response("Invalid conversation.", { status: 400 });
  }
  const confirmProposalId = body.confirmProposalId;
  if (
    confirmProposalId !== undefined &&
    (typeof confirmProposalId !== "string" ||
      !confirmProposalId ||
      confirmProposalId.length > 100)
  ) {
    return new Response("Invalid confirmation.", { status: 400 });
  }
  // The patient's selected interface language; anything else lets the model follow the patient.
  const responseLanguage =
    body.language === "ar"
      ? "Arabic"
      : body.language === "en"
        ? "English"
        : "auto";

  let history: ChatTurn[] = [];
  let approvedBooking: BookingSuggestion | undefined;
  try {
    await connectDB();
    if (confirmProposalId) {
      if (!conversationId)
        return new Response("A saved booking proposal is required.", {
          status: 400,
        });
      const claimed = await Conversation.findOneAndUpdate(
        {
          _id: conversationId,
          patient: patientId,
          "pendingBooking.proposalId": confirmProposalId,
        },
        { $unset: { pendingBooking: 1 } },
        { new: false },
      ).lean();
      if (!claimed?.pendingBooking)
        return new Response(
          "This proposal has expired or was already confirmed. Check My Appointments, or ask for a new suggestion.",
          { status: 409 },
        );
      approvedBooking = claimed.pendingBooking;
    } else if (conversationId) {
      const conversation = await Conversation.findOneAndUpdate(
        { _id: conversationId, patient: patientId },
        { $unset: { pendingBooking: 1 } },
        { new: false },
      ).lean();
      if (!conversation)
        return new Response("Conversation not found.", { status: 404 });
      // The browser cannot supply assistant history or fabricate a previous confirmation.
      history = conversation.messages
        .slice(-40)
        .map((m) => ({ role: m.role, text: m.text }));
    }
  } catch (error) {
    console.error("Load chat failed:", error);
    return new Response("Could not load the conversation. Please try again.", {
      status: 503,
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let disconnected = false;
      const send = (event: unknown) => {
        if (disconnected) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          disconnected = true;
        }
      };
      const started = Date.now();
      let success = false;
      let knowledgeSearches = 0;
      let knowledgeHits = 0;
      let createdBooking: BookingConfirmation | undefined;
      try {
        let text: string;
        let suggestion: BookingSuggestion | undefined;
        let confirmation: BookingConfirmation | undefined;
        let sources: NonNullable<IChatMessage["sources"]> = [];
        if (approvedBooking) {
          // This write is outside the model loop. Only the consumed database proposal supplies its arguments.
          const tool = await runTool(
            "confirm_booking",
            {
              doctorId: approvedBooking.doctorId,
              date: approvedBooking.date,
              time: approvedBooking.time,
            },
            patientId,
            { mode: "patient", approvedBooking },
          );
          confirmation = tool.confirmation;
          createdBooking = confirmation;
          if (confirmation) {
            text = `Your appointment with ${confirmation.doctorName} (${confirmation.specialty}) is booked for ${confirmation.date} at ${confirmation.time}, pending the clinic's confirmation.`;
            send({ type: "booked", data: confirmation });
          } else {
            const result = tool.result as {
              reason?: string;
              alternatives?: string[];
            };
            text = `${result.reason ?? "The appointment could not be booked."} ${
              result.alternatives?.length
                ? `Available alternatives: ${result.alternatives.join(", ")}. Ask me to suggest a new time.`
                : "Please ask me to look for a new appointment."
            }`;
          }
          send({ type: "delta", text });
        } else {
          const result = await runAssistant({
            message,
            history,
            patientId,
            mode: "patient",
            responseLanguage,
            onEvent: (event) => {
              if (event.type === "sources") {
                send({
                  type: "sources",
                  data: event.data.map((hit) => ({
                    id: hit.id,
                    title: hit.question,
                    source: hit.source,
                    revision: hit.revision,
                  })),
                });
              } else {
                send(event);
              }
            },
          });
          text = result.text;
          suggestion = result.suggestion;
          sources = result.sources.map((hit) => ({
            id: hit.id,
            title: hit.question,
            source: hit.source,
            revision: hit.revision,
          }));
          knowledgeSearches = result.knowledgeSearches;
          knowledgeHits = result.knowledgeHits;
        }
        const saved = await persist({
          patientId,
          conversationId: (conversationId as string | null) ?? null,
          userMessage: approvedBooking
            ? `Confirm booking with ${approvedBooking.doctorName} on ${approvedBooking.date} at ${approvedBooking.time}.`
            : message,
          text,
          suggestion,
          confirmation,
          sources,
        });
        success = true;
        send({ type: "done", ...saved });
      } catch (error) {
        console.error("AI chat failed:", error);
        send({
          type: "error",
          message: createdBooking
            ? "Your appointment was created, but the chat history could not be saved. Check My Appointments for its details."
            : "The assistant is unavailable right now. Please try again.",
        });
      } finally {
        if (!disconnected) {
          try {
            controller.close();
          } catch {
            /* Client closed the stream. */
          }
        }
        if (!approvedBooking) {
          try {
            await AIRun.create({
              mode: "patient",
              actor: patientId,
              success,
              durationMs: Date.now() - started,
              knowledgeSearches,
              knowledgeHits,
            });
          } catch (error) {
            console.error("Save chat metrics failed:", error);
          }
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

async function persist(options: {
  patientId: string;
  conversationId: string | null;
  userMessage: string;
  text: string;
  suggestion?: BookingSuggestion;
  confirmation?: BookingConfirmation;
  sources: NonNullable<IChatMessage["sources"]>;
}): Promise<{ conversationId: string; title: string }> {
  const messages: IChatMessage[] = [
    { role: "user", text: options.userMessage, createdAt: new Date() },
    {
      role: "model",
      text: options.text,
      suggestion: options.suggestion,
      confirmation: options.confirmation,
      sources: options.sources,
      createdAt: new Date(),
    },
  ];
  if (options.conversationId) {
    const doc = await Conversation.findOneAndUpdate(
      { _id: options.conversationId, patient: options.patientId },
      {
        $push: { messages: { $each: messages } },
        ...(options.suggestion
          ? { $set: { pendingBooking: options.suggestion } }
          : {}),
      },
      { new: true },
    );
    if (!doc) throw new Error("Conversation was deleted while replying.");
    return { conversationId: String(doc._id), title: doc.title };
  }
  const title = options.userMessage.replace(/\s+/g, " ").slice(0, 48);
  const doc = await Conversation.create({
    patient: options.patientId,
    title,
    messages,
    pendingBooking: options.suggestion,
  });
  return { conversationId: String(doc._id), title: doc.title };
}
