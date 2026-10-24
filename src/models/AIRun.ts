import mongoose, { Schema, type Model } from "mongoose";

export interface IAIRun {
  mode: "patient" | "test";
  success: boolean;
  durationMs: number;
  knowledgeSearches: number;
  knowledgeHits: number;
  passed?: boolean;
  actor: string;
  question?: string;
  createdAt: Date;
}

const AIRunSchema = new Schema<IAIRun>(
  {
    mode: { type: String, enum: ["patient", "test"], required: true },
    success: { type: Boolean, required: true },
    durationMs: { type: Number, required: true },
    knowledgeSearches: { type: Number, default: 0 },
    knowledgeHits: { type: Number, default: 0 },
    passed: Boolean,
    actor: { type: String, required: true },
    // Only sandbox questions are recorded here. Patient messages stay in their conversations.
    question: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
AIRunSchema.index({ mode: 1, createdAt: -1 });

const AIRun: Model<IAIRun> =
  mongoose.models.AIRun || mongoose.model<IAIRun>("AIRun", AIRunSchema);
export default AIRun;
