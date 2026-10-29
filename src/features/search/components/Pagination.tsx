import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";
import { pageRangeLabel } from "@/features/search/lib/searchFilterLabels";

// ───────────────────────── Pagination ─────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  loading: boolean;
  onChange: (next: number) => void;
  /** 28 Oct 2026: "Showing 1–10 of 34 carrier trips" above the buttons (web wording). */
  totalItems: number;
  perPage: number;
  itemLabel?: string;
}

export function Pagination({
  page,
  totalPages,
  loading,
  onChange,
  totalItems,
  perPage,
  itemLabel,
}: Readonly<PaginationProps>) {
  if (totalPages <= 1) return null;
  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;
  return (
    <View style={styles.wrap}>
    <Text style={styles.rangeText}>{pageRangeLabel(page, perPage, totalItems, itemLabel)}</Text>
    <View style={styles.pagination}>
      <Pressable
        onPress={() => onChange(page - 1)}
        disabled={!canPrev}
        style={[styles.pageButton, !canPrev && styles.pageButtonDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
      >
        <Ionicons name="chevron-back" size={16} color={canPrev ? colors.text : colors.subtleText} />
        <Text style={[styles.pageButtonText, !canPrev && styles.pageButtonTextDisabled]}>Prev</Text>
      </Pressable>
      <Text style={styles.pageIndicator}>
        Page {page} of {totalPages}
      </Text>
      <Pressable
        onPress={() => onChange(page + 1)}
        disabled={!canNext}
        style={[styles.pageButton, !canNext && styles.pageButtonDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Next page"
      >
        <Text style={[styles.pageButtonText, !canNext && styles.pageButtonTextDisabled]}>Next</Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={canNext ? colors.text : colors.subtleText}
        />
      </Pressable>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 8, gap: 8 },
  rangeText: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500", textAlign: "center" },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pageButtonDisabled: { opacity: 0.4 },
  pageButtonText: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  pageButtonTextDisabled: { color: colors.subtleText },
  pageIndicator: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "600" },
});
