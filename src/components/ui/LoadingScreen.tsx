import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafarlyMark } from "@/components/brand/SafarlyMark";
import { Screen } from "@/components/ui/Screen";
import { colors } from "@/theme/colors";

type Props = {
  /** Short status line shown under the spinner (e.g. "Loading your profile…"). */
  message?: string;
};

/**
 * Standard full-screen loading state: the Safarly mark + a spinner + an
 * optional message, centered on the app's hero background. Use this instead
 * of a bare ActivityIndicator so loading reads as intentional and on-brand
 * (a lighter cousin of the splash screen).
 */
export function LoadingScreen({ message }: Readonly<Props>) {
  return (
    <Screen edges={["top", "right", "left", "bottom"]} scroll={false}>
      <View style={styles.wrap}>
        <View style={styles.markWrap}>
          <SafarlyMark size={56} />
        </View>
        <ActivityIndicator color={colors.primary} />
        {message ? <Text style={styles.text}>{message}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  /** Soft elevated tile behind the mark — matches the brand lockup on the auth screens. */
  markWrap: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  text: { color: colors.mutedText, fontSize: 14, fontWeight: "500", marginTop: 16 },
});
