import { StyleSheet } from "react-native";

import { colors } from "@/theme/colors";

/**
 * Styles used by more than one piece of the Bookings screen (moved verbatim
 * from BookingsScreen.tsx). A style used by a single component lives in that
 * component's own file.
 */
export const sharedStyles = StyleSheet.create({
  expandedSection: { gap: 6 },
  expandedLabel: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  actionDanger: { backgroundColor: "rgba(220,40,40,0.10)" },
  actionDangerText: { color: colors.danger, fontSize: 13, fontWeight: "800" },
  fullWidthAction: { width: "100%" },
  stepCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepCardEyebrowSafe: {
    color: colors.safe,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  stepCardTitle: { color: colors.text, fontSize: 14, fontWeight: "800", lineHeight: 19 },
  stepCardBody: { color: colors.mutedText, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  stepCardFootnote: { color: colors.subtleText, fontSize: 11, lineHeight: 15, fontWeight: "500" },

  // Modal
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,25,0.4)",
  },
  modalCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalHeaderBubbleDanger: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(220,40,40,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 },
  modalBody: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  modalFieldLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 4,
  },
  modalHelper: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
  },
  modalInput: {
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "500",
    minHeight: 80,
  },
  modalFooter: { flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 4 },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    minWidth: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonSecondary: { backgroundColor: colors.surfaceMuted },
  modalButtonSecondaryText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  modalButtonDanger: { backgroundColor: colors.danger },
  modalButtonDangerText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  modalButtonDisabled: { opacity: 0.5 },
});
