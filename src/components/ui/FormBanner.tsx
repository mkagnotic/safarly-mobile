import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

type Variant = "error" | "info" | "success" | "warning";

type Props = {
  message?: string | null;
  title?: string | null;
  variant?: Variant;
  onDismiss?: () => void;
};

interface Accent {
  icon: keyof typeof Ionicons.glyphMap;
  fg: string;
  bg: string;
  border: string;
}

export function FormBanner({ message, title, variant = "error", onDismiss }: Readonly<Props>) {
  if (!message && !title) return null;
  const accent = accentFor(variant);
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion={variant === "error" ? "assertive" : "polite"}
      style={[styles.base, { backgroundColor: accent.bg, borderColor: accent.border }]}
    >
      <Ionicons name={accent.icon} size={18} color={accent.fg} style={styles.icon} />
      <View style={styles.textCol}>
        {title ? <Text style={[styles.title, { color: accent.fg }]}>{title}</Text> : null}
        {message ? (
          <Text style={[styles.text, { color: accent.fg }, title ? styles.textWithTitle : null]}>
            {message}
          </Text>
        ) : null}
      </View>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={16} color={accent.fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

function accentFor(variant: Variant): Accent {
  switch (variant) {
    case "success":
      return {
        icon: "checkmark-circle",
        fg: colors.safe,
        bg: "rgba(34, 195, 93, 0.08)",
        border: "rgba(34, 195, 93, 0.32)",
      };
    case "warning":
      return {
        icon: "warning",
        fg: colors.warning,
        bg: "rgba(245, 159, 10, 0.10)",
        border: "rgba(245, 159, 10, 0.36)",
      };
    case "info":
      return {
        icon: "information-circle",
        fg: colors.primaryForeground,
        bg: colors.primarySoft,
        border: "rgba(163, 136, 250, 0.32)",
      };
    case "error":
    default:
      return {
        icon: "alert-circle",
        fg: colors.danger,
        bg: "rgba(220, 40, 40, 0.08)",
        border: "rgba(220, 40, 40, 0.32)",
      };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  icon: { marginTop: 1 },
  textCol: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: "800", lineHeight: 18 },
  text: { fontSize: 13, lineHeight: 19, fontWeight: "500" },
  textWithTitle: { marginTop: 2 },
  closeBtn: { padding: 2, marginTop: 1 },
});
