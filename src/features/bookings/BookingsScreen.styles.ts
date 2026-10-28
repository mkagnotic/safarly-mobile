import { StyleSheet } from "react-native";

import { colors } from "@/theme/colors";

/** Styles used only by BookingsScreen.tsx (moved verbatim out of it). */
export const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 14,
    gap: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { flex: 1 },
  title: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 13, marginTop: 2, fontWeight: "500" },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
    padding: 0,
  },

  // Filter chips
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.mutedText, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.white },

  // Cards
  // padding:0 cancels Card's default 16px — the summary + expanded body each
  // supply their own padding, so the default would double up and leave the
  // collapsed card looking empty/bottom-heavy.
  bookingCard: { borderRadius: 16, marginBottom: 12, overflow: "hidden", padding: 0 },

  // Expanded body
  expandedDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  expandedRoot: { gap: 14 },
  expandedLoading: { paddingVertical: 12, alignItems: "center" },
  expandedError: { paddingVertical: 12, alignItems: "center" },
  expandedErrorText: { color: colors.danger, fontSize: 13, fontWeight: "600" },

  partiesRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  partyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 140,
  },
  partyKey: { color: colors.subtleText, fontSize: 11, fontWeight: "600" },
  partyValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  partyRating: { color: colors.mutedText, fontSize: 12, fontWeight: "600", marginTop: 1 },

  // Actions
  actionsWrap: { gap: 8, flexDirection: "row", flexWrap: "wrap" },
  actionWarning: { backgroundColor: "rgba(245,159,10,0.12)" },
  disputeNote: { color: colors.mutedText, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  disputeLinkResolved: { backgroundColor: colors.surfaceTintPrimary },
  disputeLinkResolvedText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  actionWarningText: { color: colors.warning, fontSize: 13, fontWeight: "800" },
  actionRated: { backgroundColor: "rgba(34,197,94,0.12)" },
  actionRatedText: { color: colors.safe, fontSize: 13, fontWeight: "800" },
  helperText: { color: colors.safe, fontSize: 12, fontWeight: "500", marginTop: 6 },

  // States
  loadingWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 64, gap: 12 },
  loadingText: { color: colors.mutedText, fontSize: 13, fontWeight: "500" },
  errorCard: { borderRadius: 16, alignItems: "center", paddingVertical: 24, paddingHorizontal: 18 },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 8 },
  errorBody: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },

  // FlatList layout (scroll={false} Screen → fixed header + scrolling list)
  page: { flex: 1, paddingHorizontal: 20 },
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  listContentEmpty: { flexGrow: 1 },
  footerLoading: { paddingVertical: 16, alignItems: "center" },
  updatingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  updatingText: { fontSize: 12, color: colors.subtleText },
  listUpdating: { opacity: 0.6 },
});
