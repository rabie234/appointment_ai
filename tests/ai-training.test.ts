import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  GenerateContentResponse,
  type GenerateContentParameters,
} from "@google/genai";
import { bookingIsAuthorized } from "../src/lib/booking-policy";
import {
  documentEntries,
  matchesExpectedAnswer,
  rankKnowledge,
  searchTerms,
  validateKnowledge,
  type KnowledgeHit,
} from "../src/lib/knowledge-core";
import KnowledgeEntry from "../src/models/KnowledgeEntry";
import Conversation from "../src/models/Conversation";

// The orchestration tests inject all external calls and never connect to a database or Gemini.
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/unused_unit_test";

const content = {
  question: "What should I bring?",
  answer: "Bring your ID and insurance card.",
  category: "Appointments",
  aliases: ["What documents do I need?"],
};
const proposal = {
  proposalId: "one-use-proposal",
  doctorId: "012345678901234567890123",
  doctorName: "Test Doctor",
  specialty: "General",
  date: "2030-01-01",
  time: "09:00",
};
const bookingArgs = {
  doctorId: proposal.doctorId,
  date: proposal.date,
  time: proposal.time,
};
const hit = (id: string, fields: Partial<KnowledgeHit> = {}): KnowledgeHit => ({
  ...content,
  id,
  source: "Manual FAQ",
  revision: 1,
  ...fields,
});

test("FAQ validation trims fields, drops untrusted extra fields and deduplicates aliases", () => {
  const result = validateKnowledge({
    ...content,
    question: " Question? ",
    aliases: [" Another? ", "Another?", ""],
    published: true,
  });
  assert.deepEqual(result, {
    ...content,
    question: "Question?",
    aliases: ["Another?"],
  });
  assert.equal("published" in result, false);
});

test("FAQ validation rejects malformed or excessive content", () => {
  for (const invalid of [
    null,
    { ...content, question: "" },
    { ...content, answer: "a".repeat(8001) },
    { ...content, category: 5 },
    { ...content, aliases: [true] },
    { ...content, aliases: Array(21).fill("question") },
  ]) {
    assert.throws(() => validateKnowledge(invalid));
  }
});

test("retrieval prioritizes intent and alternate questions over incidental answer mentions", () => {
  const results = rankKnowledge("Do you accept insurance?", [
    hit("body", {
      question: "Preparation",
      answer: "Bring your insurance card.",
    }),
    hit("intent", {
      question: "Payment methods",
      aliases: ["Do you accept insurance?"],
    }),
    hit("unrelated", {
      question: "Opening times",
      answer: "We open at eight.",
      aliases: [],
    }),
  ]);
  assert.deepEqual(
    results.map((item) => item.id),
    ["intent", "body"],
  );
});

test("retrieval searches long document bodies, bounds results, and handles Unicode", () => {
  assert.equal(
    rankKnowledge("parking", [
      hit("document", {
        answer: `${"other ".repeat(100)}parking is behind the clinic.`,
      }),
    ]).length,
    1,
  );
  assert.equal(
    rankKnowledge(
      "insurance",
      Array.from({ length: 10 }, (_, i) => hit(String(i))),
    ).length,
    5,
  );
  assert.equal(rankKnowledge("hello", [hit("unrelated")]).length, 0);
  assert.equal(rankKnowledge("the clinic", [hit("unrelated")]).length, 0);
  assert.deepEqual(searchTerms("أين العيادة؟"), ["أين", "العيادة"]);
});

test("text imports produce bounded reviewable sections without losing document text", () => {
  const text = "Insurance details and preparation instructions. ".repeat(350);
  const entries = documentEntries(text, "policy.txt");
  assert.ok(entries.length > 1);
  assert.ok(entries.every((entry) => entry.answer.length <= 6000));
  assert.equal(
    entries
      .map((entry) => entry.answer)
      .join("")
      .replace(/\s/g, ""),
    text.replace(/\s/g, ""),
  );
  assert.throws(() => documentEntries(" \n ", "empty.txt"), /No readable text/);
  assert.throws(
    () => documentEntries("x".repeat(160001), "large.txt"),
    /too long/,
  );
});

test("draft edits and restore snapshots do not mutate the published answer", () => {
  const entry = new KnowledgeEntry({
    draft: content,
    published: content,
    revision: 2,
    publishedRevision: 2,
    history: [
      {
        revision: 2,
        content,
        action: "published",
        actor: "Admin",
        at: new Date(),
      },
    ],
  });
  entry.draft.answer = "Updated draft only.";
  assert.equal(entry.published?.answer, content.answer);
  assert.equal(entry.history[0].content.answer, content.answer);
  assert.equal(entry.validateSync(), undefined);
  entry.draft = entry.history[0].content;
  entry.draft.answer = "Restored then edited.";
  assert.equal(entry.history[0].content.answer, content.answer);
});

test("confirmation and proposal IDs survive conversation storage", () => {
  const doc = new Conversation({
    patient: "012345678901234567890123",
    pendingBooking: proposal,
    messages: [
      {
        role: "model",
        text: "Booked.",
        suggestion: proposal,
        confirmation: {
          appointmentId: "test",
          doctorName: "Test Doctor",
          specialty: "General",
          date: "2030-01-01",
          time: "09:00",
          type: "in-person",
        },
        sources: [
          { id: "source", title: "Policy", source: "policy.txt", revision: 1 },
        ],
      },
    ],
  });
  assert.equal(doc.pendingBooking?.proposalId, proposal.proposalId);
  assert.equal(doc.messages[0].confirmation?.appointmentId, "test");
  assert.equal(doc.messages[0].sources?.[0].title, "Policy");
  assert.equal(doc.validateSync(), undefined);
});

test("only an exact server-approved proposal authorizes a booking", () => {
  assert.equal(bookingIsAuthorized({ mode: "patient" }, bookingArgs), false);
  assert.equal(
    bookingIsAuthorized(
      { mode: "test", approvedBooking: proposal },
      bookingArgs,
    ),
    false,
  );
  assert.equal(
    bookingIsAuthorized(
      { mode: "patient", approvedBooking: proposal },
      bookingArgs,
    ),
    true,
  );
  for (const mutation of [
    { time: "10:00" },
    { date: "2030-01-02" },
    { doctorId: "other" },
    { type: "video" },
  ]) {
    assert.equal(
      bookingIsAuthorized(
        { mode: "patient", approvedBooking: proposal },
        { ...bookingArgs, ...mutation },
      ),
      false,
    );
  }
  assert.equal(
    bookingIsAuthorized(
      { mode: "patient", approvedBooking: { ...proposal, proposalId: "" } },
      bookingArgs,
    ),
    false,
  );
});

test("tool dispatcher denies sandbox and unapproved bookings before any database access", async () => {
  const { runTool, functionDeclarations } =
    await import("../src/app/(patient)/ai-chat/tools");
  assert.equal(
    functionDeclarations.some((tool) => tool.name === "confirm_booking"),
    false,
  );
  const sandbox = await runTool("confirm_booking", bookingArgs, "patient", {
    mode: "test",
    approvedBooking: proposal,
  });
  const unapproved = await runTool("confirm_booking", bookingArgs, "patient");
  assert.equal((sandbox.result as { booked: boolean }).booked, false);
  assert.equal((unapproved.result as { booked: boolean }).booked, false);
  assert.equal(sandbox.confirmation, undefined);
});

test("sandbox uses shared tool calling, includes source evidence and preserves thought signatures", async () => {
  const { runAssistant } = await import("../src/lib/ai-assistant");
  const requests: GenerateContentParameters[] = [];
  const events: string[] = [];
  const result = await runAssistant(
    {
      message: "What should I bring?",
      history: [],
      patientId: "admin",
      mode: "test",
      knowledgeMode: "draft",
      onEvent: (event) => events.push(event.type),
    },
    {
      generate: async (request) => {
        requests.push(structuredClone(request));
        return (async function* () {
          const chunk = new GenerateContentResponse();
          chunk.candidates = [
            {
              content: {
                role: "model",
                parts:
                  requests.length === 1
                    ? [
                        {
                          functionCall: {
                            name: "search_clinic_knowledge",
                            args: { query: "appointment documents" },
                            id: "call-1",
                          },
                          thoughtSignature: "signature",
                        },
                      ]
                    : [{ text: "Bring your ID and insurance card." }],
              },
            },
          ];
          yield chunk;
        })();
      },
      executeTool: async (name, args, patientId, context) => {
        assert.equal(name, "search_clinic_knowledge");
        assert.equal(args.query, "appointment documents");
        assert.equal(patientId, "admin");
        assert.equal(context?.mode, "test");
        assert.equal(context?.knowledgeMode, "draft");
        assert.equal(context?.approvedBooking, undefined);
        return { result: { sources: [hit("source-1")] } };
      },
    },
  );
  assert.equal(result.text, content.answer);
  assert.equal(result.sources[0].id, "source-1");
  assert.equal(result.knowledgeSearches, 1);
  assert.equal(result.knowledgeHits, 1);
  assert.deepEqual(events, ["sources", "delta"]);
  const contents = requests[1].contents as {
    parts: { thoughtSignature?: string; functionResponse?: { id?: string } }[];
  }[];
  assert.equal(contents[1].parts[0].thoughtSignature, "signature");
  assert.equal(contents[2].parts[0].functionResponse?.id, "call-1");
});

test("patient mode always requests published knowledge, even if draft mode was passed", async () => {
  const { runAssistant } = await import("../src/lib/ai-assistant");
  let generated = false;
  let checked = false;
  await runAssistant(
    {
      message: "Insurance?",
      history: [],
      patientId: "patient",
      mode: "patient",
      knowledgeMode: "draft",
    },
    {
      generate: async () =>
        (async function* () {
          const chunk = new GenerateContentResponse();
          chunk.candidates = [
            {
              content: {
                parts: generated
                  ? [{ text: "Please contact the clinic." }]
                  : [
                      {
                        functionCall: {
                          name: "search_clinic_knowledge",
                          args: { query: "insurance" },
                        },
                      },
                    ],
              },
            },
          ];
          generated = true;
          yield chunk;
        })(),
      executeTool: async (_name, _args, _patientId, context) => {
        checked = true;
        assert.equal(context?.knowledgeMode, "published");
        return { result: { sources: [] } };
      },
    },
  );
  assert.equal(checked, true);
});

test("expected phrases are optional and graded case-insensitively", () => {
  assert.equal(matchesExpectedAnswer(content.answer, ""), null);
  assert.equal(matchesExpectedAnswer(content.answer, " INSURANCE CARD "), true);
  assert.equal(matchesExpectedAnswer(content.answer, "passport"), false);
});

test("PDF uploads can be parsed locally without an AI call", async () => {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({
    data: new Uint8Array(
      await readFile(
        new URL("../AI-Integration-Architecture.pdf", import.meta.url),
      ),
    ),
  });
  try {
    const text = (await parser.getText()).pages
      .map((page) => page.text)
      .join("\n\n");
    assert.ok(text.length > 100);
    assert.ok(documentEntries(text, "architecture.pdf").length > 0);
  } finally {
    await parser.destroy();
  }
});
