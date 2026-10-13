import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

// ───────────────────────── Action sheet row ─────────────────────────

export function ActionRow({
  icon,
  label,
  onPress,
  tone,
}: Readonly<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "danger";
}>) {
  return (
    <Pressable onPress={onPress} style={styles.actionRow} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={tone === "danger" ? colors.danger : colors.text} />
      <Text style={[styles.actionLabel, tone === "danger" && { color: colors.danger }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  actionLabel: { color: colors.text, fontSize: 15, fontWeight: "600" },
});
