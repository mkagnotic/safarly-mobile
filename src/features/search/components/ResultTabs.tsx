import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import type { ResultsTab } from "@/features/search/searchPersistence";
import { colors } from "@/theme/colors";
import { COMPACT_CONTROL_MAX_FONT_SCALE } from "@/theme/typography";

// ───────────────────────── Result tabs ─────────────────────────

interface ResultTabsProps {
  active: ResultsTab;
  onChange: (tab: ResultsTab) => void;
  counts: { package: number; buddy: number; receiver: number };
  loading: boolean;
  /** The last search failed: its counts are no longer true, so show none. */
  hideCounts?: boolean;
}

export const ResultTabs = memo(function ResultTabs({
  active,
  onChange,
  counts,
  loading,
  hideCounts = false,
}: Readonly<ResultTabsProps>) {
  const tabs: readonly { key: ResultsTab; label: string; count: number }[] = [
    { key: "package", label: "Packages", count: counts.package },
    { key: "buddy", label: "Buddies", count: counts.buddy },
    { key: "receiver", label: "Receivers", count: counts.receiver },
  ];
  return (
    <View style={styles.tabsRow}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, isActive && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            {/* The COUNT is the point of the tab: on a 320pt screen with larger
                text "Packages (1…" / "Receivers (7…" hid it (23 Oct 2026). The
                label scales down to fit before it ever truncates. */}
            <Text
              style={[styles.tabLabel, isActive && styles.tabLabelActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              maxFontSizeMultiplier={COMPACT_CONTROL_MAX_FONT_SCALE}
            >
              {tab.label}{" "}
              {hideCounts ? null : loading ? (
                <Text style={styles.tabCount}>(…)</Text>
              ) : (
                <Text style={styles.tabCount}>({tab.count})</Text>
              )}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  tabsRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    // Sized from its own label (equal thirds starved "Receivers (71)"), and may shrink.
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  tabActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabLabel: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "700", flexShrink: 1 },
  tabLabelActive: { color: colors.text },
  tabCount: { color: colors.subtleText, fontSize: 11, lineHeight: 15, fontWeight: "600" },
});
