import { StyleSheet, View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { colors } from "@/theme/colors";

// ───────────────────────── Loading skeleton ─────────────────────────

/**
 * Mirrors web's 5 placeholder rows during the initial load. Pure layout —
 * no Animated dependency to keep the bundle slim. Web uses an `animate-pulse`
 * tailwind class; on RN we just render a static muted-tone card stack which
 * reads as "loading" against the surrounding chrome.
 */
export function InboxSkeleton() {
  const placeholders = [0, 1, 2, 3, 4];
  return (
    <View style={styles.skeletonWrap}>
      {placeholders.map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <SkeletonBlock style={styles.skeletonAvatar} />
          <View style={styles.skeletonBody}>
            <SkeletonBlock style={styles.skeletonNameBar} />
            <SkeletonBlock style={styles.skeletonPreviewBar} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Loading skeletons (web parity: 5 placeholder cards while initial load runs).
  skeletonWrap: { gap: 10, paddingTop: 4 },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: 14,
  },
  skeletonAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.border,
  },
  skeletonBody: { flex: 1, gap: 8 },
  skeletonNameBar: {
    height: 12,
    width: "40%",
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  skeletonPreviewBar: {
    height: 10,
    width: "75%",
    borderRadius: 5,
    backgroundColor: colors.border,
    opacity: 0.7,
  },
});
