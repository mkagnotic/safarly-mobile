import { StyleSheet, Text, View } from "react-native";

import type { SearchFilters } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { capitalize } from "@/features/search/lib/searchConfig";

/** Chip summary of the active manual-search filters (mirrors web). */
export function AppliedFilterChips({ filters }: Readonly<{ filters: SearchFilters }>) {
  const chips: string[] = [];
  if (filters.from_city) {
    chips.push(`From: ${filters.from_city === "ANY" ? "Any City" : filters.from_city}`);
  }
  if (filters.to_city) {
    chips.push(`To: ${filters.to_city === "ANY" ? "Any City" : filters.to_city}`);
  }
  if (filters.date_from) chips.push(`From: ${filters.date_from}`);
  if (filters.date_to) chips.push(`To: ${filters.date_to}`);
  for (const l of filters.looking_for?.split(",").filter(Boolean) ?? []) {
    chips.push(capitalize(l.replace(/_/g, " ")));
  }
  if (chips.length === 0) chips.push("All results (no filters)");

  return (
    <View style={styles.filterChipsRow}>
      <Text style={styles.filterChipsLabel}>FILTERS:</Text>
      {chips.map((c) => (
        <View key={c} style={styles.filterChip}>
          <Text style={styles.filterChipText}>{c}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  filterChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  filterChipsLabel: {
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: primaryTint.fill10,
  },
  filterChipText: {
    color: colors.wordmark,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
});
