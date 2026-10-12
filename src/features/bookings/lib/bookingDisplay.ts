import { Ionicons } from "@expo/vector-icons";

import type { Booking } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";

export const FILTERS: ReadonlyArray<{ label: string; status?: string }> = [
  { label: "All", status: undefined },
  { label: "Active", status: "active" },
  { label: "Completed", status: "delivered" },
  { label: "Cancelled", status: "cancelled" },
];

export const STATUS_TONES: Record<string, { bg: string; fg: string }> = {
  pending_payment: { bg: "rgba(245,159,10,0.12)", fg: colors.warning },
  awaiting_handoff: { bg: primaryTint.fill12, fg: colors.primary },
  confirmed: { bg: primaryTint.fill12, fg: colors.primary },
  payment_secured: { bg: "rgba(34,195,93,0.12)", fg: colors.safe },
  unpaid_return: { bg: "rgba(220,40,40,0.12)", fg: colors.danger },
  in_transit: { bg: "rgba(245,128,32,0.12)", fg: "#F08020" },
  delivered: { bg: "rgba(34,195,93,0.12)", fg: colors.safe },
  handoff_rejected: { bg: "rgba(220,40,40,0.12)", fg: colors.danger },
  cancelled: { bg: "rgba(220,40,40,0.12)", fg: colors.danger },
  cancelled_post_possession: { bg: "rgba(220,40,40,0.12)", fg: colors.danger },
  expired_unpaid: { bg: "rgba(120,120,120,0.12)", fg: colors.mutedText },
  disputed: { bg: "rgba(220,40,40,0.15)", fg: colors.danger },
};

// Human-readable status chips (web parity, `CustomerBookings.tsx` statusLabels).
// The chip used to render the raw enum ("AWAITING HANDOFF" / "HANDOFF
// REJECTED"), which is internal vocabulary — and "handoff" reads backwards to a
// carrier, who is receiving the parcel, not giving it away.
export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending payment",
  expired_unpaid: "Expired",
  confirmed: "Confirmed",
  awaiting_handoff: "Awaiting handoff",
  handoff_rejected: "Declined at handoff",
  payment_secured: "Ready to travel",
  unpaid_return: "Unpaid - parcel returning",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
  cancelled_post_possession: "Cancelled mid-trip",
  disputed: "Disputed",
};

export const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending_payment: "time-outline",
  awaiting_handoff: "hand-left-outline",
  confirmed: "checkmark-circle",
  payment_secured: "airplane-outline",
  unpaid_return: "return-down-back-outline",
  in_transit: "car",
  delivered: "cube-outline",
  handoff_rejected: "close-circle-outline",
  cancelled: "ban",
  cancelled_post_possession: "ban",
  expired_unpaid: "hourglass-outline",
  disputed: "alert-circle",
};

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Capitalize the first letter for display (categories arrive lowercased). */
export function formatCategory(value: string): string {
  const v = value.trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}

export function getRole(
  booking: Booking,
  userId: string | undefined,
): "sender" | "carrier" | "unknown" {
  if (!userId) return "unknown";
  if (booking.sender_id === userId) return "sender";
  if (booking.carrier_id === userId) return "carrier";
  return "unknown";
}
