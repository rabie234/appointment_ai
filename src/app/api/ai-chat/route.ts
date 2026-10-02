import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import { genai, GEMINI_MODEL } from '@/lib/gemini';
import Conversation from '@/models/Conversation';
import { functionDeclarations, runTool, type BookingSuggestion } from '../../(patient)/ai-chat/tools';
import {
  buildContents,
  systemInstruction,
  MAX_TOOL_ROUNDS,
  type ChatTurn,
} from '../../(patient)/ai-chat/chat-core';

export const dynamic = 'force-dynamic';

/**
 * Streaming AI chat. Runs the function-calling loop and streams the final
 * assistant text to the browser as newline-delimited JSON events, then persists
 * the whole exchange to the patient's conversation.
 *
 * Event shape (one JSON object per line):
 *   { type: "delta", text }        incremental assistant text
 *   { type: "suggestion", data }   a validated booking suggestion
 *   { type: "done", conversationId, title }
 *   { type: "error", message }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'patient') {
    return new Response('Unauthorized', { status: 401 });
  }
  const patientId = session.user.id;

  let body: { message?: string; history?: ChatTurn[]; conversationId?: string | null };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const message = String(body.message ?? '').trim();
  if (!message) return new Response('Empty message', { status: 400 });
  const history: ChatTurn[] = Array.isArray(body.history) ? body.history : [];
  const conversationId = body.conversationId ?? null;

  const today = new Date().toISOString().slice(0, 10);
  const contents = buildContents(history, message);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

      let suggestion: BookingSuggestion | undefined;
      let fullText = '';

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const streamResult = await genai.models.generateContentStream({
            model: GEMINI_MODEL,
            contents,
            config: {
              systemInstruction: systemInstruction(today),
              tools: [{ functionDeclarations }],
            },
          });

          const pendingCalls: { name: string; args: Record<string, unknown> }[] = [];
          let modelContent: unknown;

          for await (const chunk of streamResult) {
            // Stream any text deltas straight to the client.
            const text = chunk.text;
            if (text) {
              fullText += text;
              send({ type: 'delta', text });
            }
            // Collect function calls; capture the model content (with the
            // Gemini 3.x thought signatures) to echo back next round.
            const calls = chunk.functionCalls;
            if (calls?.length) {
              for (const c of calls) {
                pendingCalls.push({
                  name: c.name ?? '',
                  args: (c.args ?? {}) as Record<string, unknown>,
                });
              }
              const cand = chunk.candidates?.[0]?.content;
              if (cand) modelContent = cand;
            }
          }

          if (pendingCalls.length === 0) {
            break; // final answer streamed; done
          }

          // Echo the model's tool-call turn verbatim (preserves thoughtSignature),
          // run each tool, and feed the results back.
          contents.push(
            (modelContent as (typeof contents)[number]) ?? {
              role: 'model',
              parts: pendingCalls.map((c) => ({ functionCall: { name: c.name, args: c.args } })),
            }
          );

          const responseParts = [];
          for (const call of pendingCalls) {
            const { result, suggestion: s } = await runTool(call.name, call.args);
            if (s) {
              suggestion = s;
              send({ type: 'suggestion', data: s });
            }
            responseParts.push({
              functionResponse: {
                name: call.name,
                response: result as Record<string, unknown>,
              },
            });
          }
          contents.push({ role: 'user', parts: responseParts });
        }

        if (!fullText.trim()) {
          fullText = suggestion
            ? `I'd suggest ${suggestion.doctorName} (${suggestion.specialty}) on ${suggestion.date} at ${suggestion.time}. You can book below.`
            : 'Could you tell me a bit more about what you need help with?';
          send({ type: 'delta', text: fullText });
        }

        // Persist the exchange.
        const { conversationId: savedId, title } = await persist({
          patientId,
          conversationId,
          userMessage: message,
          modelText: fullText,
          suggestion,
        });

        send({ type: 'done', conversationId: savedId, title });
      } catch (error) {
        console.error('AI chat stream failed:', error);
        send({ type: 'error', message: 'The assistant is unavailable right now. Please try again.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

/** Append the user + model messages to a conversation (creating it if needed). */
async function persist(opts: {
  patientId: string;
  conversationId: string | null;
  userMessage: string;
  modelText: string;
  suggestion?: BookingSuggestion;
}): Promise<{ conversationId: string; title: string }> {
  await connectDB();

  const userMsg = { role: 'user' as const, text: opts.userMessage, createdAt: new Date() };
  const modelMsg = {
    role: 'model' as const,
    text: opts.modelText,
    suggestion: opts.suggestion,
    createdAt: new Date(),
  };

  if (opts.conversationId) {
    const existing = await Conversation.findOne({
      _id: opts.conversationId,
      patient: opts.patientId,
    });
    if (existing) {
      existing.messages.push(userMsg, modelMsg);
      await existing.save();
      return { conversationId: String(existing._id), title: existing.title };
    }
  }

  // New conversation — title from the first user message.
  const title = titleFrom(opts.userMessage);
  const created = await Conversation.create({
    patient: opts.patientId,
    title,
    messages: [userMsg, modelMsg],
  });
  return { conversationId: String(created._id), title };
}

function titleFrom(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed || 'New conversation';
}
