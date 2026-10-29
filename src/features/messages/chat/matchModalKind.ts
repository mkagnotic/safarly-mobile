/**
 * Which match copy to show: "booking" (parcel delivery) or "buddy" (travel buddy).
 *
 * ⚠️ Decided by WHAT THE MATCH ACTS ON, not by the conversation's `context_type`.
 * A pair has ONE shared conversation, so a thread first opened as a buddy chat
 * keeps `context_type: "buddy"` even when the match on screen is for a parcel
 * delivery. Reading the label showed the "Travel Buddy Safety" disclaimer and
 * buddy wording on a parcel match (bug bash, 28 Oct 2026).
 *
 *  - `explicitKind` wins (the buddy pin always says "buddy").
 *  - A parcel deal in play (a matchable deal / a named parcel_id or trip_id) => "booking".
 *  - No deal known => fall back to the thread's label.
 *
 * Twin: safarly-web src/features/messages/lib/matchModalKind.ts — keep in step.
 */
export type MatchModalKind = "booking" | "buddy";

export function matchModalKind(input: {
  contextType?: string | null;
  hasParcelDeal: boolean;
  explicitKind?: MatchModalKind | null;
}): MatchModalKind {
  if (input.explicitKind) return input.explicitKind;
  if (input.hasParcelDeal) return "booking";
  return input.contextType === "buddy" ? "buddy" : "booking";
}
