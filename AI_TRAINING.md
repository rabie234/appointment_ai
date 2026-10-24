# Clinic knowledge and assistant testing

Open **Admin → AI Training** to manage the information available to ClinicAI.

1. Add a question, approved answer, category, and optional alternative questions, or upload a PDF, TXT, or FAQ JSON file.
2. Review the extracted content and import it as drafts. Uploading never publishes content.
3. Open **Launch Trainer** and select **Saved drafts** to test saved changes. The panel shows the tools called and the exact retrieved passages. An optional expected phrase provides a simple case-insensitive phrase check, not an accuracy score.
4. Select **Publish draft** on each approved entry. Patient chat searches only published, active entries.
5. Edit published entries freely: patients continue to receive the published snapshot until the next publication. **Versions → Restore as draft** recovers a previous snapshot for review. Archiving or deleting an entry immediately excludes it from new searches.

The draft test view includes every active entry's latest saved draft. The published view uses exactly the knowledge available to patients. Archived entries are excluded from both views. Restoring an archived entry requires publishing it again.

## Upload formats

- Files: up to 5 MB each. Extracted text: up to 160,000 characters, split into sections of at most 6,000 characters.
- PDFs: at most 100 pages, with selectable text. Scanned PDFs need OCR first. Parsing happens locally; uploaded documents are not sent to Gemini for extraction. Original file bytes are not retained.
- JSON: an array of 1–30 FAQ objects, or an object with an `entries` array. Each entry needs `question` and `answer`; `category` defaults to `General` and `aliases` defaults to an empty array. See [the example](public/training-faq-example.json).
- Questions: 300 characters; answers: 8,000 characters; categories: 80 characters; alternative questions: up to 20, each at most 300 characters.

## Runtime behavior

MongoDB stores `KnowledgeEntry` records with separate draft/published snapshots and an audit history. Saves use revision checks and optimistic concurrency to reject stale admin edits. Deletions retain audit history.

The `search_clinic_knowledge` tool uses keyword retrieval: it examines up to 200 matching candidates, prioritizes question/alias matches, and returns at most five passages. This initial implementation does not use semantic embeddings. Add alternate question phrasings to improve matching. Doctors and availability still come from the existing live database tools.

The sandbox shares the patient assistant's execution loop and system instructions. It can look up doctors and availability and propose an appointment, but the model has no booking write tool. Patient booking uses the Confirm button, which atomically consumes a saved proposal belonging to that patient's conversation. Reusing or changing the proposal cannot authorize another booking. Older chat suggestions without a proposal ID must be regenerated.

`AIRun` records power the last-30-days metrics. Patient metrics contain timing, request outcome and retrieval counts; patient message content stays in the existing conversation collection. Sandbox history records test questions and outcomes. Existing conversations do not retroactively populate the new metrics.

## Setup and verification

Run `npm install` after updating. The PDF parser supports Node 20.16+ within Node 20, or Node 22.3+. MongoDB is required for knowledge and metrics; the existing `GEMINI_API_KEY` is required for assistant tests and patient chat. The model is configured in `src/lib/ai-config.ts`. No additional search service or embedding API is required.

Run `npm test` for regression tests, `npx tsc --noEmit` for types, and `npm run build` for the production build. The tests use synthetic model responses and do not contact Gemini or MongoDB. Next.js downloads the existing Google Fonts during a fresh production build.
