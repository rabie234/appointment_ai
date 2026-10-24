import mongoose, { Schema, type Model } from "mongoose";
import type { KnowledgeContent } from "@/lib/knowledge-core";

export interface KnowledgeRevision {
  revision: number;
  content: KnowledgeContent;
  action:
    "created" | "edited" | "published" | "archived" | "restored" | "deleted";
  actor: string;
  at: Date;
}

export interface IKnowledgeEntry {
  draft: KnowledgeContent;
  published?: KnowledgeContent;
  publishedRevision?: number;
  revision: number;
  source: string;
  archived: boolean;
  deleted: boolean;
  history: KnowledgeRevision[];
  createdAt: Date;
  updatedAt: Date;
}

const ContentSchema = new Schema<KnowledgeContent>(
  {
    question: { type: String, required: true, maxlength: 300 },
    answer: { type: String, required: true, maxlength: 8000 },
    category: { type: String, required: true, maxlength: 80 },
    aliases: { type: [String], default: [] },
  },
  { _id: false },
);

const RevisionSchema = new Schema<KnowledgeRevision>(
  {
    revision: Number,
    content: ContentSchema,
    action: {
      type: String,
      enum: [
        "created",
        "edited",
        "published",
        "archived",
        "restored",
        "deleted",
      ],
    },
    actor: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const KnowledgeEntrySchema = new Schema<IKnowledgeEntry>(
  {
    draft: { type: ContentSchema, required: true },
    published: { type: ContentSchema, default: undefined },
    publishedRevision: Number,
    revision: { type: Number, default: 1 },
    source: { type: String, default: "Manual FAQ" },
    archived: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
    history: { type: [RevisionSchema], default: [] },
  },
  { timestamps: true, optimisticConcurrency: true },
);

KnowledgeEntrySchema.index({ deleted: 1, archived: 1, updatedAt: -1 });

const KnowledgeEntry: Model<IKnowledgeEntry> =
  mongoose.models.KnowledgeEntry ||
  mongoose.model<IKnowledgeEntry>("KnowledgeEntry", KnowledgeEntrySchema);
export default KnowledgeEntry;
