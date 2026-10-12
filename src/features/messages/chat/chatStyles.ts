import { StyleSheet } from "react-native";

import { colors } from "@/theme/colors";

/**
 * Styles shared by more than one piece of the chat screen. Styles that belong to
 * a single component live next to it.
 */
export const chatStyles = StyleSheet.create({
  flex: { flex: 1 },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: "800", flexShrink: 1 },

  // Bubble
  bubbleRowMine: { alignItems: "flex-end" },
  bubbleRowTheirs: { alignItems: "flex-start" },

  // Centered states
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  centeredTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  centeredBody: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },

  // Action sheet
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.4)" },
  actionSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 8,
  },
  // The conversation-actions sheet has more rows; cap it and let it scroll on
  // short screens so Cancel is always reachable.
  actionSheetTall: { maxHeight: "82%" },
  actionSheetTitle: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 14,
    marginVertical: 4,
  },
});
