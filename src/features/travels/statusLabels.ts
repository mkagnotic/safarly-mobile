import { colors } from "@/theme/colors";

/**
 * Ported verbatim from `web app/safarly_web/src/customer/pages/CustomerMyTrips.tsx`.
 * Mirrors `statusLabel` and `statusColor` so cross-platform status badges
 * render with identical text + tone.
 */
export const STATUS_LABEL: Readonly<Record<string, string>> = {
  open: "Looking for Carrier",
  active: "Can Carry Parcel",
  matched: "Matched",
  in_transit: "In Progress",
  delivered: "Completed",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  pending: "Looking for Match",
  accepted: "Matched",
  looking_for_match: "Looking for Carrier",
  can_carry: "Can Carry Parcel",
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
};

const DEFAULT_TONE: StatusTone = { bg: colors.surfaceMuted, fg: colors.mutedText };

export function labelForStatus(status: string): string {
  return STATUS_LABEL[status] ?? status;
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
