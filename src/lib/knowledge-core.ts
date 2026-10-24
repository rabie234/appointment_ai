/** Shared limits and pure validation/search helpers. No database or model imports. */
export type KnowledgeContent = {
  question: string;
  answer: string;
  category: string;
  aliases: string[];
};

export type KnowledgeHit = KnowledgeContent & {
  id: string;
  source: string;
  revision: number;
};

export function validateKnowledge(value: unknown): KnowledgeContent {
  if (!value || typeof value !== "object")
    throw new Error("Each entry must be an object.");
  const input = value as Record<string, unknown>;
  const field = (key: string, max: number, fallback = "") => {
    const result = input[key] === undefined ? fallback : input[key];
    if (typeof result !== "string" || !result.trim() || result.length > max) {
      throw new Error(`${key} must contain 1–${max} characters.`);
    }
    return result.trim();
  };
  const aliases = input.aliases ?? [];
  if (
    !Array.isArray(aliases) ||
    aliases.length > 20 ||
    aliases.some((a) => typeof a !== "string" || a.length > 300)
  ) {
    throw new Error(
      "Use up to 20 alternative questions, each under 300 characters.",
    );
  }
  return {
    question: field("question", 300),
    answer: field("answer", 8000),
    category: field("category", 80, "General"),
    aliases: [
      ...new Set((aliases as string[]).map((a) => a.trim()).filter(Boolean)),
    ],
  };
}

const STOP_WORDS = new Set(
  "a an the is are was were be been do does did i me my we our you your it its this that to for of in on at with and or how what when where can could would should please tell about clinic".split(
    " ",
  ),
);

export function searchTerms(query: string): string[] {
  return [
    ...new Set(
      (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
        (word) => word.length > 1 && !STOP_WORDS.has(word),
      ),
    ),
  ];
}

export function rankKnowledge(
  query: string,
  entries: KnowledgeHit[],
): KnowledgeHit[] {
  const terms = searchTerms(query).slice(0, 24);
  if (!terms.length) return [];
  return entries
    .map((entry) => {
      const title = new Set(
        searchTerms(
          [entry.question, ...entry.aliases, entry.category].join(" "),
        ),
      );
      const body = new Set(searchTerms(entry.answer));
      const score = terms.reduce(
        (sum, term) => sum + (title.has(term) ? 4 : body.has(term) ? 1 : 0),
        0,
      );
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.entry);
}

/** Text documents become reviewable sections; nothing is published on import. */
export function documentEntries(
  text: string,
  filename: string,
): KnowledgeContent[] {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
  if (!normalized)
    throw new Error(
      "No readable text found. Scanned PDFs need OCR before upload.",
    );
  if (normalized.length > 160_000)
    throw new Error("Document is too long. Split it into smaller files.");
  const entries: KnowledgeContent[] = [];
  for (let start = 0; start < normalized.length;) {
    let end = Math.min(start + 6000, normalized.length);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf("\n", end);
      if (boundary > start + 3000) end = boundary;
    }
    const answer = normalized.slice(start, end).trim();
    entries.push(
      validateKnowledge({
        question: `${filename.slice(0, 200)} — section ${entries.length + 1}`,
        answer,
        category: "Documents",
      }),
    );
    start = end;
  }
  return entries;
}

export function matchesExpectedAnswer(
  answer: string,
  expected: string,
): boolean | null {
  if (!expected.trim()) return null;
  return answer
    .toLocaleLowerCase()
    .includes(expected.trim().toLocaleLowerCase());
}
