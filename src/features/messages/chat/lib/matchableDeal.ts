/**
 * Which deal - if any - does a Match press NAME? The pure rule behind
 * useChatMatchStatus, kept identical to web src/features/messages/lib/matchableDeal.ts.
 *
 * A deal is only the subject of a match while it is still AT the match step and its
 * request is live. Past that (a delivery under way, finished, cancelled, or a request
 * that was retired) Match names nothing, and the server pairs what the two people
 * have in common NOW - asking with MATCH_AMBIGUOUS when there is more than one.
 *
 * Staging, 4 Nov 2026 (User Five / User Six): a deal that ended with a decline at
 * handoff stayed on screen at NEGOTIATING, this rule named it, and the server revived
 * it instead of matching the pair's new reversed-role route. The server no longer
 * offers an ended deal as the chat's default (active-deal), and match.ts no longer
 * treats one as live; this rule is the client half - it never names a retired deal.
 */
export const MATCH_STEP_STATES = ["NEGOTIATING", "MATCH_REQUESTED", "MATCH_DECLINED"] as const;

export interface MatchableDealInput {
  request_status?: string | null;
  parcel_id?: string | null;
  trip_id?: string | null;
}

export function pickMatchableDeal<T extends MatchableDealInput>(
  activeDeal: T | null | undefined,
  workflowState: string | null | undefined,
): T | null {
  if (!activeDeal) return null;
  if (activeDeal.request_status === "rejected" || activeDeal.request_status === "withdrawn") return null;
  return (MATCH_STEP_STATES as readonly string[]).includes(workflowState ?? "") ? activeDeal : null;
}

/** What the Match request body names: the deal's listings, or nothing at all. */
export function matchTarget(deal: MatchableDealInput | null | undefined): { parcel_id?: string; trip_id?: string } {
  return { parcel_id: deal?.parcel_id ?? undefined, trip_id: deal?.trip_id ?? undefined };
}
