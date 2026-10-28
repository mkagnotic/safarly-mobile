/**
 * Focus logic for a buddy match deep link (`/customer/search?match=<id>&tab=buddy`
 * -> `Trips { highlightId, tab: "buddy" }`). Kept import-free so `node --test`
 * can load it. Web parity: `BuddyMatchCard.tsx` scrolls the card into view and
 * rings it for `BUDDY_HIGHLIGHT_MS`, then lets it read like its neighbours.
 */

/** How long a deep-linked buddy card stays ringed. Same value as web. */
export const BUDDY_HIGHLIGHT_MS = 4000;

/** Breathing room above the focused card so it isn't flush with the top edge. */
export const FOCUS_SCROLL_OFFSET = 16;

/**
 * The id of the buddy card to ring right now, or undefined.
 *
 * `flashId` is the id whose ring timer is still running; once it expires (set to
 * null) the card settles back even though the route still carries the id.
 */
export function buddyRingId(
  highlightId: string | null | undefined,
  flashId: string | null | undefined,
): string | undefined {
  if (!highlightId || flashId !== highlightId) return undefined;
  return highlightId;
}

/**
 * Where to scroll the results ScrollView so the focused card is in view.
 *
 * `resultsY` is the results block's y inside the ScrollView content; `cardY` is
 * the card's y inside that block (both from onLayout). Returns null until both
 * are known - results load async, so the card may lay out after the block.
 */
export function focusScrollY(
  resultsY: number | null | undefined,
  cardY: number | null | undefined,
  offset: number = FOCUS_SCROLL_OFFSET,
): number | null {
  if (resultsY == null || cardY == null) return null;
  if (!Number.isFinite(resultsY) || !Number.isFinite(cardY)) return null;
  return Math.max(0, resultsY + cardY - offset);
}

/**
 * Whether the deep-linked buddy card can be focused now: results settled, the
 * buddy tab open, the card on the page being shown, and not already focused
 * for this id (focus happens once per deep link, not on every re-render).
 */
export function canFocusBuddyCard(input: {
  highlightId: string | null | undefined;
  focusedId: string | null | undefined;
  loading: boolean;
  activeTab: string;
  displayedIds: readonly string[];
}): boolean {
  const { highlightId, focusedId, loading, activeTab, displayedIds } = input;
  if (!highlightId || loading || activeTab !== "buddy") return false;
  if (focusedId === highlightId) return false;
  return displayedIds.includes(highlightId);
}

/** Scroll target meaning "the top of the results" (a buddy summary has no one card). */
export const RESULTS_TOP = "__results__";

/** One of the user's own listings in the grouped (route-matching) view. */
export type FocusGroup = { id: string; matchIds: readonly string[] };

/**
 * What a match notification should scroll to on the tab being shown, or null.
 *
 * Client, 22 Oct 2026: tapping "1 carrier can deliver your parcel" opened Search
 * and left the user to find the card. Parcel and trip results are grouped under
 * the user's OWN listing, so the target there is that listing's group - the first
 * one holding the `match` card, else (summaries of several matches, or the match
 * is gone) the one the link names with `for`. A flat list (filters applied)
 * targets the card itself. Buddy results are flat: the card, or the top of the
 * results for a summary.
 */
export function matchFocusTarget(input: {
  activeTab: string;
  highlightId: string | null | undefined;
  forId: string | null | undefined;
  /** Grouped view: the user's own listings on the page shown, with their matches. */
  groups: readonly FocusGroup[] | null;
  /** Flat view (and the buddy tab): the match ids on the page shown. */
  flatIds: readonly string[];
}): string | null {
  const { activeTab, highlightId, forId, groups, flatIds } = input;
  if (!highlightId && !forId) return null;
  if (activeTab === "buddy" || !groups) {
    if (highlightId && flatIds.includes(highlightId)) return highlightId;
    return activeTab === "buddy" && forId && !highlightId && flatIds.length > 0 ? RESULTS_TOP : null;
  }
  // ⚠️ A live match outranks `for` (web parity, 28 Oct 2026: web skips its `for`
  // scroll while the match card exists and pages to the FIRST of your listings
  // that holds it). `for` names the listing the match fitted WHEN the notice was
  // sent; a listing posted after it can fit too, and sorts first. Following `for`
  // dropped User Four on an older Ranchi -> Billings parcel instead of the Any ->
  // Any one they had just posted.
  if (highlightId) return groups.find((g) => g.matchIds.includes(highlightId))?.id ?? null;
  if (forId && groups.some((g) => g.id === forId)) return forId;
  return null;
}
