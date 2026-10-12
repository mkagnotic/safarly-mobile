import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";
import type { TabConfig, TabKey } from "@/features/travels/lib/myTravelsTypes";

// ───────────────────────── Tabs control ─────────────────────────

interface TabsProps {
  tabs: readonly TabConfig[];
  active: TabKey;
  onChange: (key: TabKey) => void;
}

/**
 * Scrollable segmented control.
 *
 * Tabs size to their label rather than sharing the width equally: at phone
 * widths four equal columns can't fit "Packages (12)" and the label was being
 * clipped mid-word. Web solves it the same way — its TabsList only becomes a
 * 4-column grid at `sm:` and up, and scrolls horizontally below that
 * (`CustomerMyTrips.tsx` TabsList: `overflow-x-auto ... sm:grid-cols-4`).
 */
export const Tabs = memo(function Tabs({ tabs, active, onChange }: Readonly<TabsProps>) {
  return (
    <View style={styles.tabsRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScrollContent}
        keyboardShouldPersistTaps="handled"
      >
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
              {/* No numberOfLines — the row scrolls, so labels never truncate. */}
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
                {typeof tab.count === "number" ? (
                  <Text style={styles.tabCount}> ({tab.count})</Text>
                ) : null}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  tabsRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabsScrollContent: { flexDirection: "row", gap: 4, alignItems: "stretch" },
  tab: {
    // Content-sized, never squeezed — `flex: 1` here is what clipped the labels.
    flexShrink: 0,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabText: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  tabTextActive: { color: colors.text },
  tabCount: { color: colors.subtleText, fontSize: 12, lineHeight: 16, fontWeight: "600" },
});
