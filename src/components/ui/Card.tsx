import type { PropsWithChildren } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/theme/colors";
import { shadowCard } from "@/theme/elevation";

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  /** When false, skips the default floating shadow (use when you apply your own elevation). */
  elevated?: boolean;
}>;

export function Card({ children, style, elevated = true }: Readonly<CardProps>) {
  return <View style={[styles.card, elevated && shadowCard(), style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
  },
});
