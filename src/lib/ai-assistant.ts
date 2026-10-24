import type {
  Content,
  Part,
  GenerateContentParameters,
  GenerateContentResponse,
} from "@google/genai";
import {
  buildContents,
  systemInstruction,
  MAX_TOOL_ROUNDS,
  type ChatTurn,
} from "@/app/(patient)/ai-chat/chat-core";
import {
  functionDeclarations,
  runTool,
  type BookingSuggestion,
} from "@/app/(patient)/ai-chat/tools";
import type { KnowledgeHit } from "@/lib/knowledge-core";
import { GEMINI_MODEL } from "@/lib/ai-config";

export type AssistantEvent =
  | { type: "delta"; text: string }
  | { type: "suggestion"; data: BookingSuggestion }
  | { type: "sources"; data: KnowledgeHit[] };

type AssistantDependencies = {
  generate: (
    request: GenerateContentParameters,
  ) => Promise<AsyncGenerator<GenerateContentResponse>>;
  executeTool: typeof runTool;
};

const defaultDependencies: AssistantDependencies = {
  generate: async (request) => {
    const { genai } = await import("@/lib/gemini");
    return genai.models.generateContentStream(request);
  },
  executeTool: runTool,
};

/** Shared execution path: the sandbox can read live availability but has no write capability. */
export async function runAssistant(
  options: {
    message: string;
    history: ChatTurn[];
    patientId: string;
    mode: "patient" | "test";
    knowledgeMode?: "draft" | "published";
    onEvent?: (event: AssistantEvent) => void;
  },
  dependencies: AssistantDependencies = defaultDependencies,
) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Beirut",
  }).format(new Date());
  const contents = buildContents(options.history.slice(-40), options.message);
  const sources = new Map<string, KnowledgeHit>();
  const toolCalls: string[] = [];
  let suggestion: BookingSuggestion | undefined;
  let text = "";
  let knowledgeSearches = 0;
  let knowledgeHits = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await dependencies.generate({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: systemInstruction(today),
        ...(round < MAX_TOOL_ROUNDS
          ? { tools: [{ functionDeclarations }] }
          : {}),
      },
    });
    const parts: Part[] = [];
    for await (const chunk of response) {
      const content = chunk.candidates?.[0]?.content;
      if (content?.parts) parts.push(...content.parts);
      const delta = content?.parts
        ?.filter((part) => !part.thought)
        .map((part) => part.text ?? "")
        .join("");
      if (delta) {
        text += delta;
        options.onEvent?.({ type: "delta", text: delta });
      }
    }
    const calls = parts.flatMap((part) =>
      part.functionCall ? [part.functionCall] : [],
    );
    if (!calls.length) break;
    // Keep all streamed parts, including Gemini thought signatures, for the next round.
    contents.push({ role: "model", parts });
    const responses: Part[] = [];
    for (const call of calls) {
      const name = call.name ?? "";
      toolCalls.push(name);
      const result = await dependencies.executeTool(
        name,
        (call.args ?? {}) as Record<string, unknown>,
        options.patientId,
        {
          mode: options.mode,
          knowledgeMode:
            options.mode === "test"
              ? (options.knowledgeMode ?? "draft")
              : "published",
        },
      );
      if (name === "search_clinic_knowledge") {
        const hits = (result.result as { sources: KnowledgeHit[] }).sources;
        knowledgeSearches++;
        knowledgeHits += hits.length;
        hits.forEach((hit) => sources.set(hit.id, hit));
        options.onEvent?.({ type: "sources", data: [...sources.values()] });
      }
      if (result.suggestion) {
        suggestion = result.suggestion;
        options.onEvent?.({ type: "suggestion", data: suggestion });
      }
      responses.push({
        functionResponse: {
          name,
          ...(call.id ? { id: call.id } : {}),
          response: result.result as Record<string, unknown>,
        },
      });
    }
    contents.push({ role: "user", parts: responses } as Content);
  }
  if (!text.trim()) {
    text = suggestion
      ? `I suggest ${suggestion.doctorName} on ${suggestion.date} at ${suggestion.time}. Use Confirm booking to continue.`
      : "I could not find an answer. Please contact the clinic for help.";
    options.onEvent?.({ type: "delta", text });
  }
  return {
    text,
    suggestion,
    sources: [...sources.values()],
    toolCalls,
    knowledgeSearches,
    knowledgeHits,
  };
}
