import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

type Variant = "error" | "info";

type Props = {
  /** When falsy the banner renders nothing (so callers can pass state directly). */
  message?: string | null;
  variant?: Variant;
};

/**
 * Persistent, inline form-level message shown at the top of a form — the
 * standard surface for server/auth errors that aren't tied to one field
 * (e.g. "Incorrect email or password"). Unlike a toast it stays until the
 * user acts, and it announces itself to screen readers via the alert role.
 */
export function FormBanner({ message, variant = "error" }: Readonly<Props>) {
  if (!message) return null;
  const isError = variant === "error";
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.base, isError ? styles.error : styles.info]}
    >
      <Ionicons
        name={isError ? "alert-circle" : "information-circle"}
        size={18}
        color={isError ? colors.danger : colors.primary}
        style={styles.icon}
      />
      <Text style={[styles.text, isError ? styles.errorText : styles.infoText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  error: { backgroundColor: "rgba(220, 40, 40, 0.08)", borderColor: "rgba(220, 40, 40, 0.32)" },
  info: { backgroundColor: colors.primarySoft, borderColor: "rgba(163, 136, 250, 0.32)" },
  icon: { marginTop: 1 },
  text: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "500" },
  errorText: { color: colors.danger },
  infoText: { color: colors.primaryForeground },
});
