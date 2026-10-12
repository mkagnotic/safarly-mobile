import { StyleSheet } from "react-native";

import { colors } from "@/theme/colors";

/**
 * Styles shared by more than one piece of the inbox. Styles that belong to a
 * single component live next to it.
 */
export const inboxStyles = StyleSheet.create({
  // Header
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },

  // Loading / error / empty
  centered: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  emptySubtitle: {
    color: colors.subtleText,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
});
