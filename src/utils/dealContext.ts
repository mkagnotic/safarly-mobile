/**
 * Which "This step is for ..." line the chat shows under the deal switcher.
 *
 * Web's rule, written out once so mobile cannot drift from it (web:
 * `ChatPinnedArea.tsx` + `useOfferTimeline.ts` `selectedDealLabel`):
 *   - nothing unless the switcher itself is on screen (two or more entries);
 *   - the travel-buddy entry names itself when it is the one selected;
 *   - a deal is named only when there are two or more SELECTABLE deals - one
 *     deal beside a buddy entry is not a choice between deliveries.
 *
 * Mobile used to name the lone deal beside a buddy entry, which web never did.
 * Pure, no imports - counts in, decision out - so node tests run it as-is.
 */
export type DealContextLine = "buddy" | "deal" | null;

export function dealContextLine(input: {
  /** `selectableDeals(deals, selectedDealId).length` - the deal chips shown. */
  selectableCount: number;
  /** The pair has a travel-buddy entry (one more chip). */
  hasBuddy: boolean;
  /** The chat is showing the buddy entry rather than a deal. */
  buddySelected: boolean;
}): DealContextLine {
  const { selectableCount, hasBuddy, buddySelected } = input;
  // Same count as `switcherEntryCount`: no switcher, no line.
  if (selectableCount + (hasBuddy ? 1 : 0) < 2) return null;
  if (buddySelected) return hasBuddy ? "buddy" : null;
  return selectableCount < 2 ? null : "deal";
}
