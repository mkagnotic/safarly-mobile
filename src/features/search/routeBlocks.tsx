import type { ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View } from "react-native";

import { colors, primaryTint } from "@/theme/colors";

export function RouteHeader({
  fromCity,
  toCity,
  kind,
}: Readonly<{ fromCity: string; toCity: string; kind: "trip" | "parcel" }>) {
  const planeRotate = Platform.OS === "ios" ? "-42deg" : "-38deg";
  const icon: keyof typeof Ionicons.glyphMap =
    kind === "trip" ? "airplane-outline" : "cube-outline";
  return (
    <View style={styles.routeRow}>
      <Text style={styles.cityText} numberOfLines={2}>
        {fromCity}
      </Text>
      <View style={styles.routeConnector}>
        <View style={styles.routeLine} />
        <Ionicons
          name={icon}
          size={20}
          color={colors.primary}
          style={kind === "trip" ? { transform: [{ rotate: planeRotate }] } : undefined}
        />
        <View style={styles.routeLine} />
      </View>
      <Text style={styles.cityText} numberOfLines={2}>
        {toCity}
      </Text>
    </View>
  );
}

export function MetricTile({
  label,
  value,
  highlight,
}: Readonly<{ label: string; value: string; highlight?: boolean }>) {
  return (
    <View style={[styles.metricCell, highlight ? styles.metricCellHighlight : null]}>
      <Text style={[styles.metricLabel, highlight ? styles.metricLabelHighlight : null]}>
        {label}
      </Text>
      <Text
        style={[styles.metricValue, highlight ? styles.metricValueHighlight : null]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export function MetricRow({ children }: Readonly<{ children: ReactNode }>) {
  return <View style={styles.metricRow}>{children}</View>;
}

const styles = StyleSheet.create({
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cityText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
  },
  routeConnector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  routeLine: { width: 14, height: 1, backgroundColor: colors.border },

  metricRow: { flexDirection: "row", gap: 10 },
  metricCell: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 70,
    justifyContent: "center",
  },
  metricCellHighlight: {
    backgroundColor: primaryTint.fill10,
    borderWidth: 1,
    borderColor: primaryTint.stroke18,
  },
  metricLabel: {
    color: colors.subtleText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metricLabelHighlight: { color: colors.primary, opacity: 0.95 },
  metricValue: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: "800" },
  metricValueHighlight: { color: colors.primary },
});
