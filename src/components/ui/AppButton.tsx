import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/colors";
import { shadowSoft } from "@/theme/elevation";

type Props = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: "primary" | "secondary" | "danger" | "dark";
  disabled?: boolean;
  leftIcon?: ReactNode;
};

export function AppButton({ label, onPress, style, variant = "primary", disabled = false, leftIcon }: Readonly<Props>) {
  if (variant === "primary") {
    return (
      <Pressable
        android_ripple={{ color: "rgba(255,255,255,0.16)" }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.base,
          styles.primaryOuter,
          disabled && styles.disabled,
          pressed && styles.pressed,
          style,
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.content}>
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
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
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        variant === "secondary" ? shadowSoft() : null,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
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
