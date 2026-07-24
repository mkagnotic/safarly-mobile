import { StyleSheet, View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { colors } from "@/theme/colors";

/**
 * Content-shaped skeleton loaders — the standard-app replacement for a centered
 * spinner + "Loading…" text. Shapes mirror the real layouts closely enough that
 * the transition to loaded content doesn't jump.
 */

/** Profile-shaped: avatar + identity lines + two menu-section cards of rows. */
export function ProfileSkeleton() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <View style={styles.profileHeader}>
        <SkeletonBlock style={styles.avatar} />
        <SkeletonBlock style={styles.nameLine} />
        <SkeletonBlock style={styles.subLine} />
      </View>
      {[0, 1].map((section) => (
        <View key={section} style={styles.card}>
          {[0, 1, 2].map((row) => (
            <View key={row} style={styles.menuRow}>
              <SkeletonBlock style={styles.menuIcon} />
              <SkeletonBlock style={styles.menuLine} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** List-shaped: N card rows (icon/avatar + two text lines). */
export function ListSkeleton({
  rows = 5,
  showHeader = false,
}: Readonly<{ rows?: number; showHeader?: boolean }>) {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {showHeader ? <SkeletonBlock style={styles.headerLine} /> : null}
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.listCard}>
          <SkeletonBlock style={styles.listIcon} />
          <View style={styles.listBody}>
            <SkeletonBlock style={styles.listLineWide} />
            <SkeletonBlock style={styles.listLineNarrow} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Detail/form-shaped: a title line + a few stacked card blocks of varying height. */
export function DetailSkeleton() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <SkeletonBlock style={styles.headerLine} />
      <SkeletonBlock style={[styles.block, { height: 96 }]} />
      <SkeletonBlock style={[styles.block, { height: 140 }]} />
      <SkeletonBlock style={[styles.block, { height: 72 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 8 },

  // Profile
  profileHeader: { alignItems: "center", gap: 10, paddingVertical: 12, marginBottom: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  nameLine: { width: 160, height: 18, borderRadius: 8 },
  subLine: { width: 120, height: 13, borderRadius: 7 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 16,
    marginBottom: 14,
  },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuIcon: { width: 34, height: 34, borderRadius: 17 },
  menuLine: { flex: 1, height: 14, borderRadius: 7 },

  // List
  headerLine: { width: 150, height: 20, borderRadius: 8, marginBottom: 16 },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  listIcon: { width: 44, height: 44, borderRadius: 22 },
  listBody: { flex: 1, gap: 8 },
  listLineWide: { width: "70%", height: 14, borderRadius: 7 },
  listLineNarrow: { width: "45%", height: 12, borderRadius: 6 },

  // Detail
  block: { width: "100%", borderRadius: 16 },
});
