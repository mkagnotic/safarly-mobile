import { useCallback, useRef, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { createPressLock, type PressLock } from "@/lib/pressLock";
import { colors } from "@/theme/colors";
import { shadowSoft } from "@/theme/elevation";

type Props = {
  label: string;
  /** May return a promise: further presses are ignored until it settles. */
  onPress: () => void | Promise<unknown>;
  style?: StyleProp<ViewStyle>;
  variant?: "primary" | "secondary" | "danger" | "dark";
  disabled?: boolean;
  /**
   * THIS button's action is in flight: swaps the icon for a spinner and blocks
   * further presses. Disabling siblings is the caller's job — see
   * `hooks/useActionGroup.ts`, which hands every button in a mutually-exclusive
   * group the same `disabled` and only one of them `loading`.
   */
  loading?: boolean;
  leftIcon?: ReactNode;
  /**
   * Override the primary variant's [start, end] gradient (e.g. a CTA-accent
   * color). Pass the same color twice for a solid fill. Ignored for other
   * variants.
   */
  gradientColors?: readonly [string, string];
};

/** Long enough to cover the render that applies `loading`/`disabled`. */
const PRESS_LOCK_MS = 800;

export function AppButton({
  label,
  onPress,
  style,
  variant = "primary",
  disabled = false,
  loading = false,
  leftIcon,
  gradientColors,
}: Readonly<Props>) {
  // A button whose action is already running must not fire it again.
  const blocked = disabled || loading;

  // Two quick taps must not both fire (e.g. create the same listing twice) -
  // see lib/pressLock. One lock per button instance.
  const lockRef = useRef<PressLock | null>(null);
  lockRef.current ??= createPressLock(PRESS_LOCK_MS);
  const handlePress = useCallback(() => {
    lockRef.current?.press(onPress);
  }, [onPress]);
  // An explicit label: left to itself Android joins the icon and the text into
  // ", Continue with Email" - the icon contributes an empty piece.
  const a11y = {
    accessibilityRole: "button" as const,
    accessibilityLabel: label,
    accessibilityState: { disabled: blocked, busy: loading },
  };
  const icon = loading ? (
    <ActivityIndicator size="small" color={variant === "secondary" ? colors.text : colors.white} />
  ) : (
    leftIcon
  );

  if (variant === "primary") {
    const grad = gradientColors ?? [colors.primary, colors.primaryGradientEnd];
    return (
      <Pressable
        android_ripple={{ color: "rgba(255,255,255,0.16)" }}
        disabled={blocked}
        onPress={handlePress}
        {...a11y}
        style={({ pressed }) => [
          styles.base,
          styles.primaryOuter,
          { backgroundColor: grad[0] },
          blocked && styles.disabled,
          pressed && styles.pressed,
          style,
        ]}
      >
        <LinearGradient
          colors={[grad[0], grad[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      android_ripple={{ color: "rgba(255,255,255,0.16)" }}
      disabled={blocked}
      onPress={handlePress}
      {...a11y}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        variant === "secondary" ? shadowSoft() : null,
        blocked && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text style={[styles.label, variant === "secondary" && styles.secondaryText]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16 },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 20 },
  icon: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  label: { color: colors.white, fontWeight: "700", fontSize: 15 },
  primaryOuter: { overflow: "hidden", backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  dark: { backgroundColor: "#101827" },
  secondaryText: { color: colors.text },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
});
