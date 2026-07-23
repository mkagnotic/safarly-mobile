import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Category → human label. 8 active categories + 3 legacy ones kept only so old
 * disputes still render a readable label. Ported byte-for-byte from web's
 * `CustomerDisputes.tsx` categoryLabels so values round-trip between platforms.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  flight_delayed: "Flight delayed/cancelled",
  travel_postponed: "Travel postponed",
  damaged: "Parcel damaged",
  missing_items: "Parcel missing",
  user_unreachable: "User unreachable",
  payment_issue: "Payment issue",
  otp_issue: "OTP issue",
  other: "Other",
  // Legacy values — not selectable, retained for display of historical disputes.
  late_delivery: "Late Delivery",
  wrong_items: "Wrong Items",
  no_show: "No Show",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, " ");
}

/** The selectable categories on the file-dispute form (web parity: 8 active). */
export const FILE_CATEGORIES: { key: string; label: string; icon: IconName }[] = [
  { key: "flight_delayed", label: CATEGORY_LABELS.flight_delayed, icon: "airplane-outline" },
  { key: "travel_postponed", label: CATEGORY_LABELS.travel_postponed, icon: "calendar-outline" },
  { key: "damaged", label: CATEGORY_LABELS.damaged, icon: "alert-circle-outline" },
  { key: "missing_items", label: CATEGORY_LABELS.missing_items, icon: "help-circle-outline" },
  { key: "user_unreachable", label: CATEGORY_LABELS.user_unreachable, icon: "person-remove-outline" },
  { key: "payment_issue", label: CATEGORY_LABELS.payment_issue, icon: "card-outline" },
  { key: "otp_issue", label: CATEGORY_LABELS.otp_issue, icon: "key-outline" },
  { key: "other", label: CATEGORY_LABELS.other, icon: "ellipsis-horizontal" },
];

/**
 * Booking statuses a dispute can be raised against (web parity: the file form's
 * booking picker is limited to these).
 */
export const DISPUTABLE_STATUSES: ReadonlySet<string> = new Set([
  "confirmed",
  "awaiting_handoff",
  "handoff_rejected",
  "in_transit",
  "delivered",
  "cancelled_post_possession",
]);

/** Minimum description length on the file-dispute form (web parity). */
export const MIN_DESCRIPTION = 20;

export function statusColor(status: string): string {
  switch (status) {
    case "open":
      return colors.warning;
    case "investigating":
      return colors.primary;
    case "resolved":
      return colors.safe;
    case "escalated":
      return colors.danger;
    default:
      return colors.mutedText;
  }
}

export function statusTint(status: string): string {
  switch (status) {
    case "open":
      return "rgba(245,159,10,0.12)";
    case "investigating":
      return "rgba(163,136,250,0.14)";
    case "resolved":
      return "rgba(34,197,94,0.12)";
    case "escalated":
      return "rgba(220,40,40,0.10)";
    default:
      return colors.surfaceMuted;
  }
}

export function statusIcon(status: string): IconName {
  switch (status) {
    case "open":
      return "alert-circle";
    case "investigating":
      return "search-outline";
    case "resolved":
      return "checkmark-circle";
    case "escalated":
      return "arrow-up-circle";
    default:
      return "help-circle-outline";
  }
}
