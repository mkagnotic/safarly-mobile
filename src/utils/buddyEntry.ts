/**
 * The travel-buddy entry in a SHARED chat (22 Oct 2026).
 *
 * Two people who have a parcel deal talk in a parcel thread, so its Match is a
 * parcel match. Their travel-buddy request is its own entry beside the deals
 * (server: `_shared/buddyRequests.ts`, `active-deal` -> `buddy`). This file is
 * every word and every choice the chat makes about that entry, so the switcher
 * and the pin can never disagree.
 *
 * ⚠️ Byte-identical copy in the mobile app: `src/utils/buddyEntry.ts`. Change both.
 * Pure — no imports — so the mobile node tests can run it as-is.
 */

export type BuddyEntryState = "none" | "pending_sent" | "pending_received" | "buddies" | "completed";

export interface BuddyEntry {
  kind: "buddy";
  /** The switcher's id for this entry. Never a carrier_request id. */
  id: "buddy";
  listing_id: string;
  listing_owner_id: string;
  from_city: string | null;
  to_city: string | null;
  travel_date: string | null;
  travel_date_to: string | null;
  request: { id: string; status: "pending" | "accepted"; sender_id: string; receiver_id: string } | null;
  connection: { id: string; completed: boolean } | null;
  state: BuddyEntryState;
}

/** The switcher id of the buddy entry. */
export const BUDDY_ENTRY_ID = "buddy";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-26" -> "Oct 26". Read as a calendar day, never through a time zone. */
function shortDay(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}` : null;
}

/** "Oct 26", or "Oct 26 – Oct 28" for a window. Empty when the date is unknown. */
export function buddyTripDates(entry: Pick<BuddyEntry, "travel_date" | "travel_date_to">): string {
  const from = shortDay(entry.travel_date);
  const to = shortDay(entry.travel_date_to);
  if (!from) return to ?? "";
  return to && to !== from ? `${from} – ${to}` : from;
}

/** The chip and the "This step is for" line: "Travel buddy · Mumbai → San Francisco · Oct 26". */
export function buddyEntryLabel(entry: BuddyEntry): string {
  const parts = ["Travel buddy"];
  if (entry.from_city && entry.to_city) parts.push(`${entry.from_city} → ${entry.to_city}`);
  const dates = buddyTripDates(entry);
  if (dates) parts.push(dates);
  return parts.join(" · ");
}

export type BuddyPinAction = "request" | "accept" | "decline";

export interface BuddyPinView {
  /** One short sentence: where things stand and what happens next. */
  text: string;
  /** At most ONE primary button. */
  primary: { action: "request" | "accept"; label: string } | null;
  /** Only ever "Decline", beside Accept. */
  secondary: { action: "decline"; label: string } | null;
}

/** What the buddy pin says and offers, from the viewer's side. Never says "delivery". */
export function buddyPinView(entry: BuddyEntry, counterpartName: string): BuddyPinView {
  const name = counterpartName.trim() || "They";
  switch (entry.state) {
    case "pending_received":
      return {
        text: `${name} asked to be your travel buddy for this trip.`,
        primary: { action: "accept", label: "Accept" },
        secondary: { action: "decline", label: "Decline" },
      };
    case "pending_sent":
      return { text: `Waiting for ${name} to accept.`, primary: null, secondary: null };
    case "buddies":
    case "completed":
      return { text: "You're travel buddies for this trip.", primary: null, secondary: null };
    default:
      return {
        text: `Ask ${name} to travel together on this trip.`,
        primary: { action: "request", label: "Request to be travel buddies" },
        secondary: null,
      };
  }
}

/**
 * Is the chat showing the buddy entry?
 *
 *   - the user picked it (or picked a deal) in the switcher — that wins;
 *   - the chat was opened from a buddy card — yes;
 *   - a request waiting for the viewer's answer — yes, even beside a parcel deal;
 *   - otherwise only when no parcel deal is on screen and the buddy request is
 *     still open (to ask, or waiting on an answer). A live parcel deal keeps the
 *     pin it has always had; the buddy chip sits beside it in the switcher.
 */
export function isBuddyEntrySelected(input: {
  buddy: BuddyEntry | null | undefined;
  /** What the user tapped in the switcher; null = no choice yet. */
  wantedId: string | null;
  /** The parcel deal the server is showing, if any. */
  serverSelectedDealId: string | null;
  /** Opened from a Travel Buddy card (`?buddy=` / route param). */
  openedFromBuddyCard: boolean;
}): boolean {
  const { buddy, wantedId, serverSelectedDealId, openedFromBuddyCard } = input;
  if (!buddy) return false;
  if (wantedId) return wantedId === BUDDY_ENTRY_ID;
  if (openedFromBuddyCard) return true;
  // A request waiting for MY answer comes first, even beside a live parcel deal -
  // otherwise it hides behind a chip the person may never tap (simple & friendly).
  if (buddy.state === "pending_received") return true;
  return !serverSelectedDealId && (buddy.state === "none" || buddy.state === "pending_sent");
}

/** The switcher appears only when there are two or more things to choose between. */
export function switcherEntryCount(shownDeals: number, buddy: BuddyEntry | null | undefined): number {
  return shownDeals + (buddy ? 1 : 0);
}

/** Plain-language result of a buddy action, for the toast. */
export function buddyActionToast(action: BuddyPinAction, counterpartName: string): string {
  const name = counterpartName.trim() || "them";
  if (action === "request") return `Request sent. We'll let you know when ${name} answers.`;
  if (action === "accept") return "You're travel buddies for this trip.";
  return "Travel buddy request declined.";
}
