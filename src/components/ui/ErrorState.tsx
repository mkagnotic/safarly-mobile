import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { fallbackFor } from "@/lib/errorFallback";
import { colors } from "@/theme/colors";

/**
 * The one panel a screen shows when it has nothing to show.
 *
 * Every list screen already hand-rolled this exact card - icon, heading, a line
 * of explanation, "Try again" - which is why they all drifted to slightly
 * different wording for the same failure. The markup below is a copy of the one
 * they share, so adopting it changes no pixels; what it adds is that the words
 * come from `fallbackFor`, the same classifier the web app uses, so a phone in a
 * tunnel, a deleted record and a missing permission finally read differently -
 * and read identically on both platforms.
 */
type Props = {
  /** The thrown value. Decides the icon, the heading and the sentence. */
  error?: unknown;
  /** What the screen was loading, in the user's words: "your disputes". */
  subject?: string;
  /** Wording this screen already had, when it should be kept. */
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  offline: "cloud-offline-outline",
  server: "cloud-offline-outline",
  permission: "lock-closed-outline",
  notFound: "help-circle-outline",
  validation: "alert-circle-outline",
  unknown: "alert-circle-outline",
};

export function ErrorState({
  error,
  subject,
  title,
  body,
  onRetry,
  retryLabel = "Try again",
  style,
}: Readonly<Props>) {
  const fallback = fallbackFor(error, { subject, title, body });
  return (
    <Card style={[styles.card, style]}>
      <Ionicons name={ICONS[fallback.kind] ?? ICONS.unknown} size={36} color={colors.mutedText} />
      <Text style={styles.title}>{fallback.title}</Text>
      <Text style={styles.body}>{fallback.body}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={styles.retryButton}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
        >
          <Text style={styles.retryButtonText}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

/** Deliberately identical to the card the screens already draw. */
const styles = StyleSheet.create({
  card: { borderRadius: 16, alignItems: "center", paddingVertical: 28, paddingHorizontal: 18, gap: 8 },
  title: { color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
  body: { color: colors.mutedText, fontSize: 13, textAlign: "center", maxWidth: 280 },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  retryButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
});

export default ErrorState;
