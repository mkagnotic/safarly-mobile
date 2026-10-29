import { colors } from "@/theme/colors";
import { toLocalYmd } from "@/utils/travelDate";

/**
 * Ported verbatim from `web app/safarly_web/src/customer/pages/CustomerMyTrips.tsx`.
 * Mirrors `statusLabel` and `statusColor` so cross-platform status badges
 * render with identical text + tone.
 */
export const STATUS_LABEL: Readonly<Record<string, string>> = {
  // Sentence case, same map as web lib/helpers.ts (28 Oct 2026).
  open: "Looking for a carrier",
  active: "Can carry parcels",
  matched: "Matched",
  in_transit: "In transit",
  delivered: "Completed",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  archived: "Expired",
  pending: "Looking for a match",
  accepted: "Matched",
  looking_for_match: "Looking for a carrier",
  can_carry: "Can carry parcels",
  match_requested: "Match requested",
  chatting: "Chatting",
  // buddy_request_status: the sender cancelled their request.
  withdrawn: "Cancelled",
};

export interface StatusTone {
  bg: string;
  fg: string;
}

/** Web's `statusColor` translated to our theme tokens. */
export const STATUS_TONE: Readonly<Record<string, StatusTone>> = {
  open: { bg: "rgba(245, 158, 11, 0.12)", fg: colors.warning },
  active: { bg: "rgba(255, 122, 38, 0.10)", fg: colors.primary },
  matched: { bg: "rgba(255, 122, 38, 0.10)", fg: colors.primary },
  in_transit: { bg: "rgba(34, 197, 94, 0.10)", fg: colors.safe },
  delivered: { bg: "rgba(34, 197, 94, 0.10)", fg: colors.safe },
  completed: { bg: "rgba(34, 197, 94, 0.10)", fg: colors.safe },
  cancelled: { bg: "rgba(239, 68, 68, 0.10)", fg: colors.danger },
  expired: { bg: colors.surfaceMuted, fg: colors.mutedText },
  pending: { bg: "rgba(245, 158, 11, 0.12)", fg: colors.warning },
  accepted: { bg: "rgba(255, 122, 38, 0.10)", fg: colors.primary },
  looking_for_match: { bg: "rgba(245, 158, 11, 0.12)", fg: colors.warning },
  can_carry: { bg: "rgba(255, 122, 38, 0.10)", fg: colors.primary },
  withdrawn: { bg: colors.surfaceMuted, fg: colors.mutedText },
};

const DEFAULT_TONE: StatusTone = { bg: colors.surfaceMuted, fg: colors.mutedText };

/** Unknown status -> "" so no pill shows, never the raw code (28 Oct 2026). */
export function labelForStatus(status: string): string {
  return STATUS_LABEL[status] ?? "";
}

/**
 * Buddy listings only (27 Oct 2026) - never the parcel map above. Unknown
 * statuses read "" so a raw value is never shown.
 */
export const BUDDY_STATUS_LABEL: Readonly<Record<string, string>> = {
  open: "Looking for buddies",
  looking_for_match: "Looking for buddies",
  pending: "Looking for buddies",
  active: "Looking for buddies",
  matched: "Buddies available",
  completed: "Completed",
  expired: "Expired",
};

export function labelForBuddyStatus(status: string): string {
  return BUDDY_STATUS_LABEL[status] ?? "";
}

export function toneForStatus(status: string): StatusTone {
  return STATUS_TONE[status] ?? DEFAULT_TONE;
}

/** Statuses that can no longer be edited or deleted (web's `canModify` check). */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "delivered",
  "completed",
  "cancelled",
  "expired",
]);

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Default "everything is normal" states — pill is suppressed for these. */
const IMPLICIT_STATUSES: ReadonlySet<string> = new Set(["active", "can_carry"]);

export function isImplicitStatus(status: string): boolean {
  return IMPLICIT_STATUSES.has(status);
}

/** Parcel statuses that belong in Archive, not the active Send/Receive lists. */
export const TERMINAL_PARCEL_STATUSES = TERMINAL_STATUSES;

/** Statuses where a passed date is irrelevant (in motion / closed) — never expired. */
const EXPIRY_IMMUNE_STATUSES: ReadonlySet<string> = new Set([
  "in_transit",
  "delivered",
  "completed",
  "cancelled",
  "expired",
  "archived",
]);

/**
 * A still-waiting listing whose date has passed reads as "expired" — derived
 * client-side (local yyyy-MM-dd) so stale rows surface without a backend sweep.
 */
export function isListingExpired(status: string, date: string | null | undefined): boolean {
  if (EXPIRY_IMMUNE_STATUSES.has(status)) return false;
  if (!date) return false;
  return date.slice(0, 10) < toLocalYmd();
}
