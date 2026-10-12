import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { Card } from "@/components/ui/Card";
import { colors } from "@/theme/colors";

/**
 * Shown in place of a listing or profile whose owner is blocked (either way).
 * Reached by deep link or a stale list. Deliberately says nothing about WHY, so
 * it never tells someone that they were blocked.
 */
export function UnavailableContentCard({
  onBack,
  backLabel = "Go back",
}: Readonly<{ onBack: () => void; backLabel?: string }>) {
  return (
    <Card style={styles.card}>
      <Ionicons name="eye-off-outline" size={34} color={colors.mutedText} />
      <Text style={styles.title}>This content isn't available</Text>
      <Text style={styles.body}>It may have been removed, or it's no longer visible to you.</Text>
      <AppButton
        label={backLabel}
        onPress={onBack}
        gradientColors={[colors.ctaAccent, colors.ctaAccent]}
        style={styles.button}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 18, gap: 6 },
  title: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 6, textAlign: "center" },
  body: { color: colors.mutedText, fontSize: 13, lineHeight: 18, textAlign: "center", maxWidth: 320 },
  button: { alignSelf: "stretch", marginTop: 12 },
});
