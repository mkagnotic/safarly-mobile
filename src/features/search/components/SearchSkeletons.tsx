import { StyleSheet, View } from "react-native";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { colors } from "@/theme/colors";

export function MatchCardSkeleton() {
  return (
    <View style={styles.skeletonMatchCard}>
      <View style={styles.skeletonRouteRow}>
        <SkeletonBlock style={styles.skeletonRouteCity} />
        <View style={styles.skeletonRouteConnector}>
          <View style={styles.skeletonRouteLine} />
          <SkeletonBlock style={styles.skeletonRouteIcon} />
          <View style={styles.skeletonRouteLine} />
        </View>
        <SkeletonBlock style={styles.skeletonRouteCity} />
      </View>
      <View style={styles.skeletonTileRow}>
        <SkeletonBlock style={styles.skeletonTile} />
        <SkeletonBlock style={styles.skeletonTile} />
      </View>
      <View style={styles.skeletonDivider} />
      <View style={styles.skeletonPersonRow}>
        <SkeletonBlock style={styles.skeletonAvatar} />
        <View style={styles.skeletonPersonInfo}>
          <SkeletonBlock style={styles.skeletonPersonName} />
          <SkeletonBlock style={styles.skeletonPersonMeta} />
        </View>
      </View>
      <View style={styles.skeletonActionsRow}>
        <SkeletonBlock style={styles.skeletonActionButton} />
        <SkeletonBlock style={styles.skeletonActionButton} />
      </View>
    </View>
  );
}

export function MatchListSkeleton({ count = 3 }: Readonly<{ count?: number }>) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <MatchCardSkeleton key={i} />
      ))}
    </View>
  );
}

export function MyListingSkeleton() {
  return (
    <View style={styles.skeletonListingCard}>
      <View style={styles.skeletonRouteRow}>
        <SkeletonBlock style={styles.skeletonRouteCity} />
        <View style={styles.skeletonRouteConnector}>
          <View style={styles.skeletonRouteLine} />
          <SkeletonBlock style={styles.skeletonRouteIcon} />
          <View style={styles.skeletonRouteLine} />
        </View>
        <SkeletonBlock style={styles.skeletonRouteCity} />
      </View>
      <View style={styles.skeletonTileRow}>
        <SkeletonBlock style={styles.skeletonTile} />
        <SkeletonBlock style={styles.skeletonTile} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonMatchCard: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 14,
  },
  skeletonListingCard: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 14,
  },
  skeletonRouteRow: { flexDirection: "row", alignItems: "center" },
  skeletonRouteCity: { flex: 1, height: 22, marginHorizontal: 4 },
  skeletonRouteConnector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  skeletonRouteLine: { width: 14, height: 1, backgroundColor: colors.border },
  skeletonRouteIcon: { width: 20, height: 20, borderRadius: 10 },
  skeletonTileRow: { flexDirection: "row", gap: 10 },
  skeletonTile: { flex: 1, height: 70, borderRadius: 14 },
  skeletonDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  skeletonPersonRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  skeletonAvatar: { width: 40, height: 40, borderRadius: 20 },
  skeletonPersonInfo: { flex: 1, gap: 6 },
  skeletonPersonName: { width: "55%", height: 16, borderRadius: 6 },
  skeletonPersonMeta: { width: "35%", height: 12, borderRadius: 6 },
  skeletonActionsRow: { flexDirection: "row", gap: 10 },
  skeletonActionButton: { flex: 1, height: 48, borderRadius: 16 },
});
