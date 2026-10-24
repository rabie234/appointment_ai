"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import connectDB from "@/lib/mongodb";
import KnowledgeEntry, {
  type KnowledgeRevision,
} from "@/models/KnowledgeEntry";
import AIRun from "@/models/AIRun";
import {
  documentEntries,
  matchesExpectedAnswer,
  validateKnowledge,
  type KnowledgeContent,
  type KnowledgeHit,
} from "@/lib/knowledge-core";
import { runAssistant } from "@/lib/ai-assistant";
import type { BookingSuggestion } from "@/app/(patient)/ai-chat/tools";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export type TrainingEntry = {
  id: string;
  draft: KnowledgeContent;
  published?: KnowledgeContent;
  publishedRevision?: number;
  revision: number;
  source: string;
  archived: boolean;
  updatedAt: string;
};
export type HistoryItem = {
  id: string;
  title: string;
  action: string;
  actor: string;
  at: string;
  revision: number;
};
export type TrainingData = {
  entries: TrainingEntry[];
  history: HistoryItem[];
  totalEntries: number;
  metrics: {
    queries: number;
    failures: number;
    averageMs: number | null;
    searches: number;
    misses: number;
    tests: number;
    passed: number;
  };
  tests: {
    id: string;
    question: string;
    success: boolean;
    passed?: boolean;
    durationMs: number;
    at: string;
    actor: string;
  }[];
};
export type TestResult = {
  text: string;
  sources: KnowledgeHit[];
  toolCalls: string[];
  suggestion?: BookingSuggestion;
  durationMs: number;
  passed: boolean | null;
};

const actorName = (user: { id: string; name?: string | null }) =>
  `${user.name || "Admin"} (${user.id})`;

function checkedContent(input: unknown): KnowledgeContent {
  return validateKnowledge(input);
}

export async function getTrainingData(): Promise<Result<TrainingData>> {
  await requireRole("admin");
  try {
    await connectDB();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [entries, totalEntries, history, aggregates, tests] =
      await Promise.all([
        KnowledgeEntry.find({ deleted: false })
          .select("-history")
          .sort({ updatedAt: -1 })
          .limit(200)
          .lean(),
        KnowledgeEntry.countDocuments({ deleted: false }),
        KnowledgeEntry.aggregate([
          { $unwind: "$history" },
          { $sort: { "history.at": -1 } },
          { $limit: 40 },
          {
            $project: {
              title: "$history.content.question",
              action: "$history.action",
              actor: "$history.actor",
              at: "$history.at",
              revision: "$history.revision",
            },
          },
        ]),
        AIRun.aggregate([
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: "$mode",
              count: { $sum: 1 },
              failures: { $sum: { $cond: ["$success", 0, 1] } },
              duration: { $avg: "$durationMs" },
              searches: { $sum: "$knowledgeSearches" },
              misses: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: ["$knowledgeSearches", 0] },
                        { $eq: ["$knowledgeHits", 0] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              graded: {
                $sum: { $cond: [{ $in: ["$passed", [true, false]] }, 1, 0] },
              },
              passed: { $sum: { $cond: ["$passed", 1, 0] } },
            },
          },
        ]),
        AIRun.find({ mode: "test" }).sort({ createdAt: -1 }).limit(15).lean(),
      ]);
    const live = aggregates.find((row) => row._id === "patient");
    const sandbox = aggregates.find((row) => row._id === "test");
    return {
      ok: true,
      value: {
        entries: entries.map((entry) => ({
          id: String(entry._id),
          draft: entry.draft,
          published: entry.published,
          publishedRevision: entry.publishedRevision,
          revision: entry.revision,
          source: entry.source,
          archived: entry.archived,
          updatedAt: entry.updatedAt.toISOString(),
        })),
        totalEntries,
        history: history.map((item) => ({
          id: `${item._id}-${item.revision}`,
          title: item.title,
          action: item.action,
          actor: item.actor,
          at: item.at.toISOString(),
          revision: item.revision,
        })),
        metrics: {
          queries: live?.count ?? 0,
          failures: live?.failures ?? 0,
          averageMs: live?.duration ?? null,
          searches: live?.searches ?? 0,
          misses: live?.misses ?? 0,
          tests: sandbox?.graded ?? 0,
          passed: sandbox?.passed ?? 0,
        },
        tests: tests.map((test) => ({
          id: String(test._id),
          question: test.question ?? "",
          success: test.success,
          passed: test.passed,
          durationMs: test.durationMs,
          at: test.createdAt.toISOString(),
          actor: test.actor,
        })),
      },
    };
  } catch (error) {
    console.error("Load AI training failed:", error);
    return {
      ok: false,
      error:
        "Could not load clinic knowledge. Check the database connection and retry.",
    };
  }
}

export async function saveKnowledge(
  input: unknown,
  id?: string,
  revision?: number,
): Promise<Result<string>> {
  const session = await requireRole("admin");
  let content: KnowledgeContent;
  try {
    content = checkedContent(input);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  if (id && !isValidObjectId(id)) return { ok: false, error: "Invalid entry." };
  try {
    await connectDB();
    const actor = actorName(session.user);
    if (id) {
      const doc = await KnowledgeEntry.findOne({ _id: id, deleted: false });
      if (!doc || doc.revision !== revision)
        return {
          ok: false,
          error: "This entry changed. Refresh and open it again before saving.",
        };
      doc.draft = content;
      doc.revision++;
      doc.history.push({
        revision: doc.revision,
        content,
        action: "edited",
        actor,
        at: new Date(),
      });
      await doc.save();
    } else {
      const doc = await KnowledgeEntry.create({
        draft: content,
        source: "Manual FAQ",
        history: [
          { revision: 1, content, action: "created", actor, at: new Date() },
        ],
      });
      id = String(doc._id);
    }
    revalidatePath("/admin/ai-training");
    return { ok: true, value: id! };
  } catch (error) {
    console.error("Save knowledge failed:", error);
    return {
      ok: false,
      error: "Could not save. Refresh the library and try again.",
    };
  }
}

export async function changeKnowledge(
  id: string,
  revision: number,
  action: "publish" | "archive" | "restore" | "delete",
  restoreRevision?: number,
): Promise<Result<null>> {
  const session = await requireRole("admin");
  if (
    !isValidObjectId(id) ||
    !["publish", "archive", "restore", "delete"].includes(action)
  ) {
    return { ok: false, error: "Invalid action." };
  }
  try {
    await connectDB();
    const doc = await KnowledgeEntry.findOne({ _id: id, deleted: false });
    if (!doc || doc.revision !== revision)
      return { ok: false, error: "This entry changed. Refresh and try again." };
    const nextRevision = doc.revision + 1;
    let historyAction: KnowledgeRevision["action"];
    if (action === "publish") {
      if (doc.archived)
        return { ok: false, error: "Restore this entry before publishing." };
      doc.published = checkedContent(doc.draft);
      doc.publishedRevision = nextRevision;
      historyAction = "published";
    } else if (action === "archive") {
      doc.archived = true;
      historyAction = "archived";
    } else if (action === "delete") {
      doc.deleted = true;
      doc.archived = true;
      historyAction = "deleted";
    } else {
      if (restoreRevision !== undefined) {
        const snapshot = doc.history.find(
          (item) => item.revision === restoreRevision,
        );
        if (!snapshot)
          return { ok: false, error: "That revision was not found." };
        doc.draft = checkedContent(snapshot.content);
      }
      // Restoring never republishes an archived entry without review.
      if (doc.archived) {
        doc.published = undefined;
        doc.publishedRevision = undefined;
      }
      doc.archived = false;
      historyAction = "restored";
    }
    doc.revision = nextRevision;
    doc.history.push({
      revision: nextRevision,
      content: doc.draft,
      action: historyAction,
      actor: actorName(session.user),
      at: new Date(),
    });
    await doc.save();
    revalidatePath("/admin/ai-training");
    return { ok: true, value: null };
  } catch (error) {
    console.error("Update knowledge failed:", error);
    return {
      ok: false,
      error: "Could not update. Refresh the library and try again.",
    };
  }
}

export async function getKnowledgeVersions(
  id: string,
): Promise<
  Result<
    {
      revision: number;
      action: string;
      at: string;
      actor: string;
      content: KnowledgeContent;
    }[]
  >
> {
  await requireRole("admin");
  if (!isValidObjectId(id)) return { ok: false, error: "Invalid entry." };
  try {
    await connectDB();
    const doc = await KnowledgeEntry.findOne({ _id: id, deleted: false })
      .select("history")
      .lean();
    if (!doc) return { ok: false, error: "Entry not found." };
    return {
      ok: true,
      value: doc.history
        .slice()
        .reverse()
        .map((item) => ({
          revision: item.revision,
          action: item.action,
          at: item.at.toISOString(),
          actor: item.actor,
          content: item.content,
        })),
    };
  } catch {
    return { ok: false, error: "Could not load version history." };
  }
}

export async function previewKnowledgeUpload(
  form: FormData,
): Promise<Result<{ source: string; entries: KnowledgeContent[] }>> {
  await requireRole("admin");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024) {
    return {
      ok: false,
      error: "Choose a nonempty PDF, TXT, or JSON file up to 5 MB.",
    };
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["pdf", "txt", "json"].includes(extension ?? ""))
    return { ok: false, error: "Supported files: PDF, TXT, JSON." };
  try {
    let entries: KnowledgeContent[];
    if (extension === "json") {
      const data = JSON.parse(await file.text());
      const rows = Array.isArray(data) ? data : data?.entries;
      if (!Array.isArray(rows) || !rows.length || rows.length > 30)
        throw new Error("JSON must contain an array of 1–30 FAQ entries.");
      entries = rows.map(checkedContent);
    } else {
      let text: string;
      if (extension === "pdf") {
        const buffer = new Uint8Array(await file.arrayBuffer());
        if (new TextDecoder().decode(buffer.slice(0, 5)) !== "%PDF-")
          throw new Error("This file is not a valid PDF.");
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        try {
          if ((await parser.getInfo()).total > 100)
            throw new Error("PDFs must contain at most 100 pages.");
          text = (await parser.getText()).pages
            .map((page) => page.text)
            .join("\n\n");
        } finally {
          await parser.destroy();
        }
      } else {
        text = await file.text();
      }
      entries = documentEntries(text, file.name);
    }
    return { ok: true, value: { source: file.name.slice(0, 240), entries } };
  } catch (error) {
    console.error("Knowledge upload preview failed:", error);
    const message = (error as Error).message;
    return {
      ok: false,
      error:
        extension === "pdf"
          ? "Could not extract this PDF. Use an unlocked PDF with selectable text, or upload its text as TXT."
          : error instanceof SyntaxError
            ? "Invalid JSON. Upload an array of FAQ entries."
            : message,
    };
  }
}

export async function importKnowledge(
  source: string,
  inputs: unknown[],
): Promise<Result<number>> {
  const session = await requireRole("admin");
  let entries: KnowledgeContent[];
  try {
    if (
      typeof source !== "string" ||
      !source.trim() ||
      source.length > 240 ||
      !Array.isArray(inputs) ||
      !inputs.length ||
      inputs.length > 30
    ) {
      throw new Error("Choose a file with 1–30 valid entries.");
    }
    entries = inputs.map(checkedContent);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  try {
    await connectDB();
    const actor = actorName(session.user);
    await KnowledgeEntry.insertMany(
      entries.map((content) => ({
        draft: content,
        source,
        history: [
          { revision: 1, content, action: "created", actor, at: new Date() },
        ],
      })),
    );
    revalidatePath("/admin/ai-training");
    return { ok: true, value: entries.length };
  } catch (error) {
    console.error("Import knowledge failed:", error);
    return {
      ok: false,
      error: "Could not import this file. Refresh the library before retrying.",
    };
  }
}

export async function testAssistant(
  message: string,
  knowledgeMode: "draft" | "published",
  expected: string,
): Promise<Result<TestResult>> {
  const session = await requireRole("admin");
  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 2000 ||
    !["draft", "published"].includes(knowledgeMode) ||
    typeof expected !== "string" ||
    expected.length > 300
  ) {
    return {
      ok: false,
      error:
        "Enter a question under 2,000 characters and an optional expected phrase under 300 characters.",
    };
  }
  const started = Date.now();
  let success = false;
  let knowledgeSearches = 0;
  let knowledgeHits = 0;
  let passed: boolean | null = null;
  try {
    const result = await runAssistant({
      message: message.trim(),
      history: [],
      patientId: session.user.id,
      mode: "test",
      knowledgeMode,
    });
    success = true;
    knowledgeSearches = result.knowledgeSearches;
    knowledgeHits = result.knowledgeHits;
    passed = matchesExpectedAnswer(result.text, expected);
    return {
      ok: true,
      value: {
        text: result.text,
        sources: result.sources,
        toolCalls: result.toolCalls,
        suggestion: result.suggestion,
        durationMs: Date.now() - started,
        passed,
      },
    };
  } catch (error) {
    console.error("AI sandbox failed:", error);
    return {
      ok: false,
      error:
        "The assistant test failed. Check the Gemini configuration and try again.",
    };
  } finally {
    try {
      await connectDB();
      await AIRun.create({
        mode: "test",
        actor: actorName(session.user),
        question: message.trim(),
        success,
        durationMs: Date.now() - started,
        knowledgeSearches,
        knowledgeHits,
        ...(passed === null ? {} : { passed }),
      });
    } catch (error) {
      console.error("Save sandbox metrics failed:", error);
    }
  }
}
