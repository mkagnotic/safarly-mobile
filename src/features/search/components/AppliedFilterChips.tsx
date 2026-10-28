import { StyleSheet, Text, View } from "react-native";

import type { SearchFilters } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { filterChipLabels } from "@/features/search/lib/searchFilterLabels";

/** Chip summary of the active manual-search filters (mirrors web). */
export function AppliedFilterChips({ filters }: Readonly<{ filters: SearchFilters }>) {
  // 28 Oct 2026: chips from a label map, never raw codes ("Receive_request").
  const chips = filterChipLabels(filters);
  if (chips.length === 0) chips.push("All results (no filters)");

  return (
    <View style={styles.filterChipsRow}>
      <Text style={styles.filterChipsLabel}>Filters:</Text>
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
    textTransform: "uppercase",
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
