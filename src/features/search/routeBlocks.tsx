import type { ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";

export function RouteHeader({
  fromCity,
  toCity,
  kind,
  compact,
}: Readonly<{ fromCity: string; toCity: string; kind: "trip" | "parcel"; compact?: boolean }>) {
  const planeRotate = Platform.OS === "ios" ? "-42deg" : "-38deg";
  const icon: keyof typeof Ionicons.glyphMap =
    kind === "trip" ? "airplane-outline" : "cube-outline";
  return (
    <View style={styles.routeRow}>
      <Text style={[styles.cityText, compact && styles.cityTextCompact]} numberOfLines={2}>
        {fromCity}
      </Text>
      <View style={styles.routeConnector}>
        <View style={styles.routeLine} />
        <Ionicons
          name={icon}
          size={compact ? 18 : 20}
          color={colors.wordmark}
          style={kind === "trip" ? { transform: [{ rotate: planeRotate }] } : undefined}
        />
        <View style={styles.routeLine} />
      </View>
      <Text style={[styles.cityText, compact && styles.cityTextCompact]} numberOfLines={2}>
        {toCity}
      </Text>
    </View>
  );
}

export function MetricTile({
  label,
  value,
  highlight,
  compact,
}: Readonly<{ label: string; value: string; highlight?: boolean; compact?: boolean }>) {
  return (
    <View
      style={[
        styles.metricCell,
        compact && styles.metricCellCompact,
        highlight ? styles.metricCellHighlight : null,
      ]}
    >
      <Text style={[styles.metricLabel, highlight ? styles.metricLabelHighlight : null]}>
        {label}
      </Text>
      <Text
        style={[
          styles.metricValue,
          compact && styles.metricValueCompact,
          highlight ? styles.metricValueHighlight : null,
        ]}
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
  cityTextCompact: { fontSize: 15, lineHeight: 20 },
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
  metricCellCompact: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 56 },
  metricCellHighlight: {
    backgroundColor: "rgba(167, 78, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(167, 78, 255, 0.26)",
  },
  metricLabel: {
    color: colors.subtleText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metricLabelHighlight: { color: colors.wordmark, opacity: 0.95 },
  metricValue: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: "800" },
  metricValueCompact: { fontSize: 14, lineHeight: 19 },
  metricValueHighlight: { color: colors.wordmark },
});
