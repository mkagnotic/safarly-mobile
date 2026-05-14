import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { useActivityFeed } from "@/hooks/api/useActivityFeed";
import { MainTabParamList } from "@/navigation/types";
import { type FeedItem, getErrorMessage } from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "ActivityTab">;

const PER_PAGE = 12; // matches web `CustomerActivity.tsx`

function formatActivityDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

function HeaderRow({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <View style={styles.headerRow}>
      <Pressable
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.title}>All Activity</Text>
    </View>
  );
}

function ActivityCard({ item }: Readonly<{ item: FeedItem }>) {
  return (
    <Card style={styles.activityCard}>
      <Text style={styles.activityTitle}>{item.title}</Text>
      {item.description ? (
        <Text style={styles.activityDescription}>{item.description}</Text>
      ) : null}
      <Text style={styles.activityDate}>{formatActivityDate(item.created_at)}</Text>
    </Card>
  );
}

function LoadingState() {
  return (
    <View style={styles.centeredWrap}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.centeredText}>Loading activity…</Text>
    </View>
  );
}

function ErrorView({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <Card style={styles.errorCard}>
      <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorBody}>
        {message || "Could not load your activity feed. Please try again later."}
      </Text>
      <Pressable
        onPress={onRetry}
        style={styles.retryButton}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={styles.retryButtonText}>Try again</Text>
      </Pressable>
    </Card>
  );
}

function EmptyView() {
  return (
    <Card style={styles.emptyCard}>
      <View style={styles.emptyIconBox}>
        <Ionicons name="flash-outline" size={28} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>No recent activity yet.</Text>
      <Text style={styles.emptySubtitle}>
        Parcel updates, trips, and payments will show up here.
      </Text>
    </Card>
  );
}

export function AllActivityScreen() {
  const navigation = useNavigation<Nav>();
  const { items, loading, loadingMore, error, total, hasMore, refetch, loadMore } =
    useActivityFeed({ perPage: PER_PAGE, paginate: true });

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  return (
    <Screen onRefresh={refetch}>
      <HeaderRow onBack={handleBack} />

      {loading && items.length === 0 ? (
        <LoadingState />
      ) : error && items.length === 0 ? (
        <ErrorView
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyView />
      ) : (
        <View>
          {items.map((item) => (
            <ActivityCard key={item.id} item={item} />
          ))}

          {hasMore ? (
            <Pressable
              onPress={() => void loadMore()}
              style={[styles.loadMoreButton, loadingMore && styles.loadMoreDisabled]}
              disabled={loadingMore}
              accessibilityRole="button"
              accessibilityLabel="Load more activity"
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.loadMoreText}>Load more</Text>
              )}
            </Pressable>
          ) : items.length > 0 ? (
            <Text style={styles.endText}>
              {total > 0 ? `Showing all ${total} activities` : "End of activity"}
            </Text>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },

  // Activity card — mirrors web `bg-card rounded-xl p-4 shadow-card`
  activityCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  activityTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  activityDescription: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  activityDate: {
    color: colors.subtleText,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 8,
  },

  // States
  centeredWrap: { alignItems: "center", paddingVertical: 64, gap: 12 },
  centeredText: { color: colors.mutedText, fontSize: 13, fontWeight: "500" },
  errorCard: {
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 18,
  },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 8 },
  errorBody: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
    maxWidth: 320,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  emptyCard: {
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 18,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 4 },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 320,
  },

  // Load more
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
  endText: {
    textAlign: "center",
    color: colors.subtleText,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 14,
    marginBottom: 8,
  },
});
