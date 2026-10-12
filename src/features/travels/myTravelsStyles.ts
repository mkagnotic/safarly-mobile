import { StyleSheet } from "react-native";

import { colors } from "@/theme/colors";

/**
 * Styles used by more than one piece of the My Travels screen (moved verbatim
 * from MyTravelsScreen.tsx). A style used by a single component lives in that
 * component's own file.
 */
export const sharedStyles = StyleSheet.create({
  // Sections within Packages
  section: { marginBottom: 18 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
});
