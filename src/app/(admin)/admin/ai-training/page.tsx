"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import {
  BrainCircuit,
  FileUp,
  Plus,
  Search,
  Loader2,
  History,
  CheckCircle2,
  AlertCircle,
  Archive,
  Pencil,
  RotateCcw,
  Trash2,
  Send,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { KnowledgeContent } from "@/lib/knowledge-core";
import {
  getTrainingData,
  saveKnowledge,
  changeKnowledge,
  getKnowledgeVersions,
  previewKnowledgeUpload,
  importKnowledge,
  testAssistant,
  type TrainingData,
  type TrainingEntry,
  type TestResult,
} from "./actions";

const EMPTY: KnowledgeContent = {
  question: "",
  answer: "",
  category: "General",
  aliases: [],
};
type Versions = Extract<
  Awaited<ReturnType<typeof getKnowledgeVersions>>,
  { ok: true }
>["value"];
type UploadPreview = { source: string; entries: KnowledgeContent[] };

function hasDraft(entry: TrainingEntry) {
  return (
    !entry.published ||
    JSON.stringify(entry.draft) !== JSON.stringify(entry.published)
  );
}
function entryStatus(entry: TrainingEntry) {
  return entry.archived
    ? "Archived"
    : !entry.published
      ? "Draft"
      : hasDraft(entry)
        ? "Published · draft changes"
        : "Published";
}
function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Beirut",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminAITrainingPage() {
  const [data, setData] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [content, setContent] = useState<KnowledgeContent>(EMPTY);
  const [aliases, setAliases] = useState("");
  const [editing, setEditing] = useState<TrainingEntry | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [versions, setVersions] = useState<{
    entry: TrainingEntry;
    items: Versions;
  } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showTrainer, setShowTrainer] = useState(false);
  const [question, setQuestion] = useState("");
  const [expected, setExpected] = useState("");
  const [knowledgeMode, setKnowledgeMode] = useState<"draft" | "published">(
    "draft",
  );
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const trainerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const result = await getTrainingData();
    if (!result.ok) throw new Error(result.error);
    setData(result.value);
  }, []);

  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function perform(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  function resetEditor() {
    setEditing(null);
    setContent(EMPTY);
    setAliases("");
  }
  function edit(entry: TrainingEntry) {
    setEditing(entry);
    setContent({ ...entry.draft });
    setAliases(entry.draft.aliases.join("\n"));
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    await perform(async () => {
      const result = await saveKnowledge(
        {
          ...content,
          aliases: aliases
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        editing?.id,
        editing?.revision,
      );
      if (!result.ok) throw new Error(result.error);
      resetEditor();
      await refresh();
      setNotice("Draft saved. Test it, then publish when ready.");
    });
  }
  async function change(
    entry: TrainingEntry,
    action: "publish" | "archive" | "restore" | "delete",
    revision?: number,
  ) {
    await perform(async () => {
      const result = await changeKnowledge(
        entry.id,
        entry.revision,
        action,
        revision,
      );
      if (!result.ok) throw new Error(result.error);
      if (editing?.id === entry.id) resetEditor();
      setVersions(null);
      setDeleteId(null);
      await refresh();
      setNotice(
        action === "publish"
          ? "Published. Patient chat can now use this version."
          : action === "restore"
            ? "Restored as a draft. Review and publish when ready."
            : action === "archive"
              ? "Archived. This entry is no longer used in chat."
              : "Entry deleted. Its audit history has been retained.",
      );
    });
  }
  async function previewFile(file?: File) {
    if (!file) return;
    await perform(async () => {
      setPreview(null);
      const form = new FormData();
      form.set("file", file);
      const result = await previewKnowledgeUpload(form);
      if (!result.ok) throw new Error(result.error);
      setPreview(result.value);
    });
  }
  async function importPreview() {
    if (!preview) return;
    await perform(async () => {
      const result = await importKnowledge(preview.source, preview.entries);
      if (!result.ok) throw new Error(result.error);
      setPreview(null);
      await refresh();
      setNotice(
        `Imported ${result.value} draft entries. Review and publish each entry when ready.`,
      );
    });
  }
  async function viewVersions(entry: TrainingEntry) {
    await perform(async () => {
      const result = await getKnowledgeVersions(entry.id);
      if (!result.ok) throw new Error(result.error);
      setVersions({ entry, items: result.value });
    });
  }
  async function runTest(event: FormEvent) {
    event.preventDefault();
    if (testing) return;
    setTesting(true);
    setTestError("");
    setTestResult(null);
    try {
      const result = await testAssistant(question, knowledgeMode, expected);
      if (!result.ok) throw new Error(result.error);
      setTestResult(result.value);
    } catch (e) {
      setTestError(
        e instanceof Error ? e.message : "Test failed. Please retry.",
      );
    } finally {
      setTesting(false);
      refresh().catch((e) => setError(e.message));
    }
  }
  function openTrainer() {
    setShowTrainer(true);
    requestAnimationFrame(() =>
      trainerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  }

  const entries =
    data?.entries.filter((entry) => {
      const status =
        filter === "all" ||
        (filter === "archived"
          ? entry.archived
          : filter === "published"
            ? !entry.archived && !!entry.published
            : !entry.archived && hasDraft(entry));
      const text = [
        entry.draft.question,
        entry.draft.answer,
        entry.draft.category,
        entry.source,
        ...entry.draft.aliases,
      ]
        .join(" ")
        .toLowerCase();
      return status && text.includes(query.toLowerCase());
    }) ?? [];
  const metrics = data?.metrics;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            AI Training & Intelligence
          </h1>
          <p className="mt-1 text-muted-foreground">
            Review clinic knowledge, test the assistant, and publish approved
            answers.
          </p>
        </div>
        <Button onClick={openTrainer} className="gap-2">
          <BrainCircuit className="h-4 w-4" />
          Launch Trainer
        </Button>
      </div>

      <div aria-live="polite" className="space-y-2">
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => perform(refresh)}
            >
              Refresh library
            </Button>
          </div>
        )}
        {notice && (
          <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {notice}
          </p>
        )}
      </div>

      {showTrainer && (
        <div ref={trainerRef} className="scroll-mt-8">
          <Card className="border-primary/30">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  Assistant test panel
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close test panel"
                  onClick={() => setShowTrainer(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Test saved drafts or published knowledge. Doctor availability is
                live; booking suggestions are previews and cannot create
                appointments.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={runTest} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    Knowledge version
                    <select
                      className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={knowledgeMode}
                      disabled={testing || busy}
                      onChange={(e) => {
                        setKnowledgeMode(
                          e.target.value as "draft" | "published",
                        );
                        setTestResult(null);
                      }}
                    >
                      <option value="draft">
                        Saved drafts (includes unpublished entries)
                      </option>
                      <option value="published">
                        Published knowledge (patient view)
                      </option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Expected phrase{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                    <Input
                      className="mt-2"
                      maxLength={300}
                      placeholder="e.g. bring your insurance card"
                      value={expected}
                      disabled={testing}
                      onChange={(e) => {
                        setExpected(e.target.value);
                        setTestResult(null);
                      }}
                    />
                  </label>
                </div>
                <label className="block space-y-2 text-sm font-medium">
                  <span>Test question</span>
                  <Textarea
                    aria-label="Test question"
                    required
                    maxLength={2000}
                    rows={3}
                    value={question}
                    disabled={testing}
                    onChange={(e) => {
                      setQuestion(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="What should I bring to my first appointment?"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    disabled={testing || busy || !question.trim()}
                    className="gap-2"
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {testing ? "Testing assistant…" : "Run test"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Expected phrases use a case-insensitive text match.
                  </p>
                </div>
              </form>
              {testError && (
                <p role="alert" className="text-sm text-destructive">
                  {testError}
                </p>
              )}
              {testResult && (
                <div
                  className="space-y-4 rounded-xl border bg-muted/20 p-5"
                  aria-live="polite"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {(testResult.durationMs / 1000).toFixed(1)}s
                    </Badge>
                    <Badge
                      variant={
                        testResult.passed === false
                          ? "destructive"
                          : testResult.passed
                            ? "success"
                            : "outline"
                      }
                    >
                      {testResult.passed === null
                        ? "Ungraded test"
                        : testResult.passed
                          ? "Expected phrase found"
                          : "Expected phrase missing"}
                    </Badge>
                  </div>
                  <div className="prose-chat text-sm leading-relaxed">
                    <ReactMarkdown>{testResult.text}</ReactMarkdown>
                  </div>
                  {testResult.suggestion && (
                    <div className="rounded-lg border border-dashed p-4 text-sm">
                      <p className="font-semibold">Booking preview</p>
                      <p>
                        {testResult.suggestion.doctorName} ·{" "}
                        {testResult.suggestion.date} ·{" "}
                        {testResult.suggestion.time}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        No appointment was created.
                      </p>
                    </div>
                  )}
                  <p className="break-words text-xs text-muted-foreground">
                    Tools called: {testResult.toolCalls.join(" → ") || "None"}
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">
                      Retrieved sources ({testResult.sources.length})
                    </p>
                    {!testResult.sources.length && (
                      <p className="text-xs text-muted-foreground">
                        No clinic knowledge was retrieved for this question.
                      </p>
                    )}
                    {testResult.sources.map((source) => (
                      <details
                        key={source.id}
                        className="rounded-lg border bg-background p-3 text-sm"
                      >
                        <summary className="cursor-pointer font-medium">
                          {source.question}{" "}
                          <span className="font-normal text-muted-foreground">
                            · revision {source.revision}
                          </span>
                        </summary>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {source.source} · {source.category} · ID: {source.id}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap">
                          {source.answer}
                        </p>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card className="border-none bg-card/60 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  Upload clinic knowledge
                </CardTitle>
                <Badge variant="secondary">PDF / TXT / JSON</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Preview extracted content before importing it as drafts. Up to 5
                MB per file.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!busy && !testing) previewFile(e.dataTransfer.files[0]);
                }}
                className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 p-8 text-center hover:border-primary/40 ${busy || testing ? "pointer-events-none opacity-60" : ""}`}
              >
                <input
                  type="file"
                  accept=".pdf,.txt,.json"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Upload clinic knowledge document"
                  disabled={busy || testing}
                  onChange={(e) => {
                    previewFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {busy ? (
                  <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
                ) : (
                  <FileUp className="mb-3 h-8 w-8 text-primary" />
                )}
                <span className="text-sm font-semibold">
                  Click or drag a file to preview
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Clinic FAQs, policies, and appointment preparation. PDFs need
                  selectable text.
                </span>
              </label>
              <a
                href="/training-faq-example.json"
                download
                className="inline-block text-xs font-medium text-primary underline"
              >
                Download example FAQ JSON
              </a>
              {preview && (
                <div className="space-y-4 rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="break-all text-sm font-semibold">
                        {preview.source}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {preview.entries.length} draft entries · Review and edit
                        before importing.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label="Discard upload preview"
                      onClick={() => setPreview(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {preview.entries.map((entry, index) => (
                      <details
                        key={index}
                        open={index === 0}
                        className="rounded-lg border p-3"
                      >
                        <summary className="cursor-pointer text-sm font-medium">
                          {index + 1}. {entry.question}
                        </summary>
                        <div className="mt-3 space-y-3">
                          <label className="block text-xs font-medium">
                            Question or section title
                            <Input
                              className="mt-1"
                              value={entry.question}
                              maxLength={300}
                              disabled={busy}
                              onChange={(e) =>
                                setPreview({
                                  ...preview,
                                  entries: preview.entries.map((item, i) =>
                                    i === index
                                      ? { ...item, question: e.target.value }
                                      : item,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label className="block text-xs font-medium">
                            Category
                            <Input
                              className="mt-1"
                              value={entry.category}
                              maxLength={80}
                              disabled={busy}
                              onChange={(e) =>
                                setPreview({
                                  ...preview,
                                  entries: preview.entries.map((item, i) =>
                                    i === index
                                      ? { ...item, category: e.target.value }
                                      : item,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label className="block text-xs font-medium">
                            Answer or source text
                            <Textarea
                              className="mt-1"
                              rows={6}
                              value={entry.answer}
                              maxLength={8000}
                              disabled={busy}
                              onChange={(e) =>
                                setPreview({
                                  ...preview,
                                  entries: preview.entries.map((item, i) =>
                                    i === index
                                      ? { ...item, answer: e.target.value }
                                      : item,
                                  ),
                                })
                              }
                            />
                          </label>
                        </div>
                      </details>
                    ))}
                  </div>
                  <Button
                    disabled={busy || testing}
                    onClick={importPreview}
                    className="w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Import {preview.entries.length} drafts
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div ref={editorRef} className="scroll-mt-8">
            <Card className="border-none bg-card/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">
                  {editing ? "Edit draft answer" : "Add a clinic FAQ"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {editing?.published
                    ? "Your published answer stays live until you publish these changes."
                    : "Save a draft, test the answer, then publish it for patients."}
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={save} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2 text-sm font-medium">
                      <span>Question / intent</span>
                      <Input
                        required
                        maxLength={300}
                        placeholder="What should I bring to my appointment?"
                        value={content.question}
                        disabled={busy || testing}
                        onChange={(e) =>
                          setContent({ ...content, question: e.target.value })
                        }
                      />
                    </label>
                    <label className="block space-y-2 text-sm font-medium">
                      <span>Category</span>
                      <Input
                        required
                        maxLength={80}
                        value={content.category}
                        disabled={busy || testing}
                        onChange={(e) =>
                          setContent({ ...content, category: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="block space-y-2 text-sm font-medium">
                    <span>Approved answer</span>
                    <Textarea
                      aria-label="Approved answer"
                      required
                      rows={5}
                      maxLength={8000}
                      placeholder="Enter the clinic's answer…"
                      value={content.answer}
                      disabled={busy || testing}
                      onChange={(e) =>
                        setContent({ ...content, answer: e.target.value })
                      }
                    />
                  </label>
                  <label className="block space-y-2 text-sm font-medium">
                    <span>
                      Alternative questions{" "}
                      <span className="font-normal text-muted-foreground">
                        (one per line, up to 20)
                      </span>
                    </span>
                    <Textarea
                      rows={2}
                      maxLength={6020}
                      placeholder="Do I need to bring my ID?"
                      value={aliases}
                      disabled={busy || testing}
                      onChange={(e) => setAliases(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={busy || testing}
                      className="flex-1 gap-2"
                    >
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}Save
                      draft
                    </Button>
                    {editing && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={resetEditor}
                      >
                        Cancel edit
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none bg-card/60 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Knowledge library</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || testing}
                  onClick={() => perform(refresh)}
                  className="gap-2"
                >
                  <RotateCcw className="h-3 w-3" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    aria-label="Search knowledge library"
                    placeholder="Search questions, categories, or sources…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filter knowledge status"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Drafts & changes</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              {loading ? (
                <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading knowledge…
                </p>
              ) : !entries.length ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <BrainCircuit className="mx-auto mb-3 h-8 w-8 text-primary/50" />
                  <p className="text-sm font-medium">
                    {data?.entries.length
                      ? "No matching entries"
                      : "Build your clinic knowledge library"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data?.entries.length
                      ? "Try another search or status filter."
                      : "Add your first FAQ or upload a clinic document above."}
                  </p>
                </div>
              ) : (
                entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="space-y-3 rounded-xl border bg-background/50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-sm font-semibold">
                          {entry.draft.question}
                        </h3>
                        <p className="mt-1 break-words text-xs text-muted-foreground">
                          {entry.draft.category} · {entry.source} · revision{" "}
                          {entry.revision}
                        </p>
                      </div>
                      <Badge
                        variant={
                          entry.archived
                            ? "outline"
                            : entry.published
                              ? "success"
                              : "secondary"
                        }
                      >
                        {entryStatus(entry)}
                      </Badge>
                    </div>
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {entry.draft.answer}
                    </p>
                    {entry.published && hasDraft(entry) && !entry.archived && (
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium text-primary">
                          View live published answer (revision{" "}
                          {entry.publishedRevision})
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 p-3">
                          {entry.published.answer}
                        </p>
                      </details>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || testing}
                        onClick={() => edit(entry)}
                        className="gap-1.5"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                      {!entry.archived && hasDraft(entry) && (
                        <Button
                          size="sm"
                          disabled={busy || testing}
                          onClick={() => change(entry, "publish")}
                          className="gap-1.5"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Publish draft
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || testing}
                        onClick={() =>
                          change(entry, entry.archived ? "restore" : "archive")
                        }
                        className="gap-1.5"
                      >
                        <Archive className="h-3 w-3" />
                        {entry.archived ? "Restore draft" : "Archive"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || testing}
                        onClick={() => viewVersions(entry)}
                        className="gap-1.5"
                      >
                        <History className="h-3 w-3" />
                        Versions
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || testing}
                        onClick={() =>
                          setDeleteId(deleteId === entry.id ? null : entry.id)
                        }
                        className="gap-1.5 text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                    {deleteId === entry.id && (
                      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-destructive/5 p-3 text-xs">
                        <span>
                          Remove this entry from the library and patient chat?
                        </span>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy || testing}
                          onClick={() => change(entry, "delete")}
                        >
                          Delete entry
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
              {!!data && data.totalEntries > data.entries.length && (
                <p className="text-xs text-muted-foreground">
                  Showing the latest {data.entries.length} of{" "}
                  {data.totalEntries} entries.
                </p>
              )}
            </CardContent>
          </Card>

          {versions && (
            <Card className="border-primary/30">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">Version history</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close version history"
                    onClick={() => setVersions(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {versions.entry.draft.question} · Restoring a version updates
                  the draft for review.
                </p>
              </CardHeader>
              <CardContent className="max-h-[32rem] space-y-3 overflow-y-auto">
                {versions.items.map((version) => (
                  <details
                    key={version.revision}
                    className="rounded-lg border p-3"
                  >
                    <summary className="cursor-pointer text-sm font-medium">
                      Revision {version.revision} · {version.action} ·{" "}
                      {dateLabel(version.at)}
                    </summary>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {version.actor}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {version.content.question}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {version.content.answer}
                    </p>
                    {version.revision !== versions.entry.revision && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || testing}
                        onClick={() =>
                          change(versions.entry, "restore", version.revision)
                        }
                        className="mt-3 gap-2"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore as draft
                      </Button>
                    )}
                  </details>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="border-none bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-lg">AI performance</CardTitle>
              <p className="text-xs opacity-80">Patient chat · last 30 days</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Metric
                label="Queries"
                value={metrics ? String(metrics.queries) : "—"}
              />
              <Metric
                label="Average response time"
                value={
                  metrics?.averageMs != null
                    ? `${(metrics.averageMs / 1000).toFixed(1)}s`
                    : "No data yet"
                }
              />
              <Metric
                label="Failed requests"
                value={metrics ? String(metrics.failures) : "—"}
              />
              <Metric
                label="Knowledge searches"
                value={metrics ? String(metrics.searches) : "—"}
              />
              <Metric
                label="Queries with no matching knowledge"
                value={metrics ? String(metrics.misses) : "—"}
              />
              <div className="border-t border-white/20 pt-4">
                <Metric
                  label="Sandbox phrase checks"
                  value={
                    metrics?.tests
                      ? `${metrics.passed} / ${metrics.tests} passed`
                      : "No graded tests yet"
                  }
                />
              </div>
            </CardContent>
          </Card>
          <Card className="border-none bg-card/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Recent assistant tests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!data?.tests.length && (
                <p className="text-sm text-muted-foreground">
                  Run a test to see results here.
                </p>
              )}
              {data?.tests.map((test) => (
                <div
                  key={test.id}
                  className="space-y-1 border-b pb-3 last:border-0 last:pb-0"
                >
                  <p className="line-clamp-2 text-sm font-medium">
                    {test.question}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        !test.success || test.passed === false
                          ? "destructive"
                          : test.passed
                            ? "success"
                            : "secondary"
                      }
                    >
                      {!test.success
                        ? "Request failed"
                        : test.passed === undefined
                          ? "Ungraded"
                          : test.passed
                            ? "Phrase found"
                            : "Phrase missing"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(test.durationMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dateLabel(test.at)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-none bg-card/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-4 w-4 text-primary" />
                Activity history
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Latest 40 changes · Beirut time
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!data?.history.length && (
                <p className="text-sm text-muted-foreground">
                  Knowledge changes will appear here.
                </p>
              )}
              {data?.history.map((item) => (
                <div key={item.id} className="flex gap-3">
                  {item.action === "published" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" />
                  )}
                  <div className="min-w-0">
                    <p
                      className="truncate text-xs font-semibold"
                      title={item.title}
                    >
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                      {item.action} · revision {item.revision}
                    </p>
                    <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                      {item.actor}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {dateLabel(item.at)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="opacity-80">{label}</span>
      <span className="shrink-0 font-semibold">{value}</span>
    </div>
  );
}
