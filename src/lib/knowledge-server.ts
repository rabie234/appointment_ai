import connectDB from "@/lib/mongodb";
import KnowledgeEntry from "@/models/KnowledgeEntry";
import {
  rankKnowledge,
  searchTerms,
  type KnowledgeHit,
} from "./knowledge-core";

/** Bounded lexical retrieval for the clinic's FAQ/document library. */
export async function searchKnowledge(
  query: string,
  mode: "draft" | "published",
): Promise<KnowledgeHit[]> {
  const terms = searchTerms(query).slice(0, 24);
  if (!terms.length) return [];
  await connectDB();
  const prefix = mode === "draft" ? "draft" : "published";
  // Terms contain only letters/numbers; no user regular-expression syntax reaches MongoDB.
  const pattern = new RegExp(terms.join("|"), "i");
  const docs = await KnowledgeEntry.find({
    archived: false,
    deleted: false,
    [prefix]: { $exists: true },
    $or: ["question", "answer", "aliases", "category"].map((field) => ({
      [`${prefix}.${field}`]: pattern,
    })),
  })
    .select(`${prefix} source revision publishedRevision`)
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
  return rankKnowledge(
    query,
    docs.flatMap((doc) => {
      const content = mode === "draft" ? doc.draft : doc.published;
      return content
        ? [
            {
              ...content,
              id: String(doc._id),
              source: doc.source,
              revision:
                mode === "draft"
                  ? doc.revision
                  : (doc.publishedRevision ?? doc.revision),
            },
          ]
        : [];
    }),
  );
}
