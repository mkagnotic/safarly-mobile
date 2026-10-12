import { StyleSheet } from "react-native";

import { colors } from "@/theme/colors";

/**
 * Styles used by more than one piece of the Search screen (moved verbatim from
 * SearchScreen.tsx). A style used by a single component lives in that
 * component's own file.
 */
export const sharedStyles = StyleSheet.create({
  // Nested matches inside a RouteListingCard
  nestedEmpty: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    paddingVertical: 4,
  },
  nestedHeading: {
    color: colors.mutedText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Match card
  matchCard: { padding: 16, marginBottom: 14, gap: 14 },
  // Deep-link highlight ring (web parity: `border-primary ring-2`). The nested
  // variant has no card chrome, so the ring also gives it padding + a radius.
  matchHighlighted: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 16,
    padding: 12,
    backgroundColor: colors.primarySoft,
  },
  nestedDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 14,
    paddingTop: 14,
  },

  personRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  personInfo: { flex: 1, minWidth: 0 },
  personName: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  ratingText: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500", marginTop: 2 },

  actionsRow: { flexDirection: "row", gap: 10 },
  actionButtonFlex: { flex: 1 },
});
