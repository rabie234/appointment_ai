import type { BookingSuggestion } from "@/app/(patient)/ai-chat/tools";

export type ToolContext = {
  mode: "patient" | "test";
  knowledgeMode?: "draft" | "published";
  /** Only populated by the server after atomically consuming a patient-owned proposal. */
  approvedBooking?: BookingSuggestion;
};

export function bookingIsAuthorized(
  context: ToolContext,
  args: Record<string, unknown>,
): boolean {
  const approved = context.approvedBooking;
  return (
    context.mode === "patient" &&
    Boolean(approved?.proposalId) &&
    approved?.doctorId === args.doctorId &&
    approved?.date === args.date &&
    approved?.time === args.time &&
    (args.type === undefined || args.type === "in-person")
  );
}
