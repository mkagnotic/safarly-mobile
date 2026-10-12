import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { colors } from "@/theme/colors";

// ───────────────────────── Reusable bits ─────────────────────────

export function ErrorBlock({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry?: () => void }>) {
  return (
    <View style={styles.centered}>
      <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
      <Text style={styles.errorTitle}>Couldn't load results</Text>
      <Text style={styles.errorBody}>{message}</Text>
      {onRetry ? (
        <AppButton
          label="Try again"
          onPress={onRetry}
          gradientColors={[colors.ctaAccent, colors.ctaAccent]}
          style={styles.retryButtonWrap}
        />
      ) : null}
    </View>
  );
}

interface EmptyResultsProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

export function EmptyResults({ icon, title, body }: Readonly<EmptyResultsProps>) {
  return (
    <View style={styles.emptyResults}>
      <View style={styles.emptyIconBox}>
        <Ionicons name={icon} size={28} color={colors.wordmark} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Loading / error / empty
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  errorTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  errorBody: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 280,
  },
  retryButtonWrap: { marginTop: 4, alignSelf: "stretch", maxWidth: 220 },
  emptyResults: { alignItems: "center", paddingVertical: 36, gap: 8 },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTintPrimary,
  },
  emptyTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800", marginTop: 4 },
  emptyBody: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 300,
  },
});
