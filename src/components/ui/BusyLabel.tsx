import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";

import { colors } from "@/theme/colors";

/**
 * A button's busy content: spinner + what is happening ("Uploading…",
 * "Approving…"). Same pattern as web's busy buttons, so a running step never
 * reads as a blank spinner. The button itself stays disabled while busy.
 */
export function BusyLabel({
  label,
  textStyle,
  color = colors.white,
}: Readonly<{ label: string; textStyle?: StyleProp<TextStyle>; color?: string }>) {
  return (
    <View style={styles.row} accessibilityState={{ busy: true }} accessibilityLabel={label}>
      <ActivityIndicator size="small" color={color} />
      <Text style={textStyle}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
