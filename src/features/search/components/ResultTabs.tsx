import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import type { ResultsTab } from "@/features/search/searchPersistence";
import { colors } from "@/theme/colors";

// ───────────────────────── Result tabs ─────────────────────────

interface ResultTabsProps {
  active: ResultsTab;
  onChange: (tab: ResultsTab) => void;
  counts: { package: number; buddy: number; receiver: number };
  loading: boolean;
}

export const ResultTabs = memo(function ResultTabs({
  active,
  onChange,
  counts,
  loading,
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
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
              {tab.label}{" "}
              {loading ? (
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  tabActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabLabel: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  tabLabelActive: { color: colors.text },
  tabCount: { color: colors.subtleText, fontSize: 11, lineHeight: 15, fontWeight: "600" },
});
