import { StyleSheet } from "react-native";

import { colors, primaryTint } from "@/theme/colors";

/** Styles used only by SearchScreen.tsx (moved verbatim out of it). */
export const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 14,
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  subtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    marginTop: 4,
  },
  bannerSlot: { marginBottom: 14 },

  // Filters
  filtersCard: { gap: 12, padding: 16, marginBottom: 18 },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: primaryTint.fill10,
    borderWidth: 1,
    borderColor: primaryTint.stroke18,
    alignItems: "center",
    justifyContent: "center",
  },
  modeToggleRow: {
    flexDirection: "row",
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 3,
    marginBottom: 8,
  },
  modeToggleButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: "center",
  },
  modeToggleButtonActive: {
    backgroundColor: colors.card,
  },
  modeToggleLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.subtleText,
  },
  modeToggleLabelActive: {
    color: colors.text,
  },
  noteText: {
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 4,
  },
});
