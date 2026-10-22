import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { colors, primaryTint } from "@/theme/colors";

// ───────────────────────── Reusable bits ─────────────────────────

export function LoadMoreButton({
  hasMore,
  loading,
  onPress,
}: Readonly<{ hasMore: boolean; loading: boolean; onPress: () => void }>) {
  if (!hasMore) return null;
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[styles.loadMoreButton, loading && styles.loadMoreDisabled]}
      accessibilityRole="button"
      accessibilityLabel="Load more"
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Text style={styles.loadMoreText}>Load more</Text>
      )}
    </Pressable>
  );
}

function TravelCardSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <SkeletonBlock style={styles.skeletonTag} />
      <View style={styles.skeletonRouteRow}>
        <View style={styles.skeletonBodyCol}>
          <SkeletonBlock style={styles.skeletonRoute} />
          <SkeletonBlock style={styles.skeletonMeta} />
        </View>
        <View style={styles.skeletonActionsCol}>
          <SkeletonBlock style={styles.skeletonActionButton} />
          <SkeletonBlock style={styles.skeletonActionButton} />
        </View>
      </View>
      <SkeletonBlock style={styles.skeletonStatusPill} />
    </View>
  );
}

export function ListSkeleton({ count = 3 }: Readonly<{ count?: number }>) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <TravelCardSkeleton key={i} />
      ))}
    </View>
  );
}

export function ErrorBlock({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry: () => Promise<void> }>) {
  return (
    <View style={styles.centered}>
      <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
      <Text style={styles.errorTitle}>Couldn't load this list</Text>
      <Text style={styles.errorBody}>{message}</Text>
      <AppButton
        label="Try again"
        onPress={() => void onRetry()}
        gradientColors={[colors.ctaAccent, colors.ctaAccent]}
        style={styles.retryButtonWrap}
      />
    </View>
  );
}

interface EmptyBlockProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}

/**
 * Whole-tab empty state.
 *
 * No action button by design: every tab's primary CTA ("Carry a Parcel" /
 * "Send a Parcel") already sits in the header actions row, so repeating it here
 * put two identical primary buttons on one screen.
 */
export function EmptyBlock({ icon, title, subtitle }: Readonly<EmptyBlockProps>) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconBox}>
        <Ionicons name={icon} size={28} color={colors.wordmark} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  skeletonTag: { width: 110, height: 20, borderRadius: 6, marginBottom: 12 },
  skeletonRouteRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  skeletonBodyCol: { flex: 1, minWidth: 0, gap: 8 },
  skeletonRoute: { width: "85%", height: 22, borderRadius: 6 },
  skeletonMeta: { width: "65%", height: 16, borderRadius: 6 },
  skeletonActionsCol: { gap: 8, minWidth: 76 },
  skeletonActionButton: { height: 34, width: 76, borderRadius: 10 },
  skeletonStatusPill: { width: 120, height: 20, borderRadius: 999, marginTop: 12 },

  // Loading / error / empty
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  errorTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  errorBody: { color: colors.mutedText, fontSize: 13, lineHeight: 19, fontWeight: "500", textAlign: "center", maxWidth: 280 },
  retryButtonWrap: { marginTop: 4, alignSelf: "center", width: "100%", maxWidth: 220 },
  /**
   * Same surface as `emptyPanel` (the Send/Receive placeholders) so every empty
   * state in My Travels reads as one thing. Was transparent, which left the
   * block floating on the hero wash with no visible container.
   */
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: primaryTint.stroke18,
    backgroundColor: colors.card,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTintPrimary,
  },
  emptyTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800", marginTop: 4 },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 300,
    marginTop: 2,
  },

  loadMoreButton: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreDisabled: { opacity: 0.6 },
  loadMoreText: { color: colors.text, fontSize: 14, fontWeight: "700" },
});
