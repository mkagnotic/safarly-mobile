import { StyleSheet } from "react-native";

import { colors } from "@/theme/colors";

/** Styles used only by MyTravelsScreen.tsx (moved verbatim out of it). */
export const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, marginBottom: 14 },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 14, lineHeight: 20, fontWeight: "500", marginTop: 4 },
  bannerSlot: { marginBottom: 14 },

  // WRAPS: on a 320pt iPhone with larger text the two labels ran out as
  // "Carry a P..." / "Send a Pa..." (23 Oct 2026). Below ~2 x 140pt the buttons
  // stack full width instead; side by side on every normal phone.
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16, marginBottom: 18 },
  actionButtonFlex: { flexGrow: 1, flexShrink: 1, flexBasis: 140 },
});
