import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { ListSkeleton } from "@/components/ui/Skeletons";
import { useAuth } from "@/context/AuthContext";
import { useUserReviews } from "@/hooks/api/useUserReviews";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { type Rating, getErrorMessage } from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "ReviewsTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

const PER_PAGE = 10; // matches web `CustomerReviews.tsx`
const STAR_COLOR = colors.warning;

function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StarRow({
  rating,
  size = 14,
  filled = true,
}: Readonly<{ rating: number; size?: number; filled?: boolean }>) {
  return (
    <View
      style={styles.starRow}
      accessibilityLabel={`${rating} out of 5 stars`}
      accessibilityRole="image"
    >
      {Array.from({ length: 5 }, (_, i) => {
        const isOn = i < rating;
        return (
          <Ionicons
            key={i}
            name={filled ? (isOn ? "star" : "star") : "star"}
            size={size}
            color={isOn ? STAR_COLOR : colors.border}
          />
        );
      })}
    </View>
  );
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
      <Text style={styles.title}>Reviews</Text>
    </View>
  );
}

function SummaryCard({
  averageRating,
  total,
  breakdown,
}: Readonly<{
  averageRating: number;
  total: number;
  breakdown: Record<string | number, number>;
}>) {
  const stars = [5, 4, 3, 2, 1] as const;
  const roundedAvg = Math.round(averageRating);
  return (
    <Card style={styles.summaryCard}>
      <View style={styles.summaryLeft}>
        <Text style={styles.avgValue}>{averageRating.toFixed(1)}</Text>
        <StarRow rating={roundedAvg} size={14} />
        <Text style={styles.totalReviewsText}>{total} reviews</Text>
      </View>
      <View style={styles.summaryRight}>
        {stars.map((s) => {
          const count = breakdown[s] ?? breakdown[String(s)] ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <View key={s} style={styles.breakdownRow}>
              <Text style={styles.breakdownStar}>{s}</Text>
              <Ionicons name="star" size={10} color={STAR_COLOR} />
              <View style={styles.breakdownTrack}>
                <View style={[styles.breakdownFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.breakdownCount}>{count}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function ReviewCard({ review }: Readonly<{ review: Rating }>) {
  const raterName = review.rater?.name ?? "Anonymous";
  const raterAvatar = review.rater?.avatar_url;
  const initials = getInitials(raterName);
  return (
    <Card style={styles.reviewCard}>
      <View style={styles.reviewTop}>
        {raterAvatar ? (
          <Image source={{ uri: raterAvatar }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <View style={styles.reviewerBlock}>
          <Text style={styles.reviewerName} numberOfLines={1}>
            {raterName}
          </Text>
          <Text style={styles.reviewerDate}>{formatReviewDate(review.created_at)}</Text>
        </View>
        <View style={styles.reviewStars}>
          {Array.from({ length: review.score }, (_, i) => (
            <Ionicons key={i} name="star" size={12} color={STAR_COLOR} />
          ))}
        </View>
      </View>
      {review.review ? <Text style={styles.reviewBody}>{review.review}</Text> : null}
    </Card>
  );
}

function LoadingState() {
  return <ListSkeleton />;
}

function ErrorView({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <Card style={styles.errorCard}>
      <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
      <Text style={styles.errorTitle}>Failed to load reviews</Text>
      {message ? <Text style={styles.errorBody}>{message}</Text> : null}
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

function EmptyView({ tab }: Readonly<{ tab: ReviewTab }>) {
  return (
    <Card style={styles.emptyCard}>
      <Ionicons
        name="chatbubble-ellipses"
        size={32}
        color={colors.mutedText}
        style={{ opacity: 0.4 }}
      />
      <Text style={styles.emptyText}>
        {tab === "given" ? "You haven't reviewed anyone yet" : "No reviews yet"}
      </Text>
    </Card>
  );
}

type ReviewTab = "received" | "given";

export function ReviewsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const userId = user?.id;

  const [tab, setTab] = useState<ReviewTab>("received");
  // Web parity: two independent lists. The summary card always reflects RECEIVED.
  const received = useUserReviews(userId, { perPage: PER_PAGE, role: "received" });
  const given = useUserReviews(userId, { perPage: PER_PAGE, role: "given" });
  const active = tab === "received" ? received : given;

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Profile");
  }, [navigation]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([received.refetch(), given.refetch()]);
  }, [received.refetch, given.refetch]);

  return (
    <Screen onRefresh={handleRefresh}>
      <HeaderRow onBack={handleBack} />

      {received.loading && received.reviews.length === 0 ? (
        <LoadingState />
      ) : received.error && received.reviews.length === 0 ? (
        <ErrorView message={getErrorMessage(received.error)} onRetry={() => void received.refetch()} />
      ) : (
        <>
          {/* Summary always reflects reviews RECEIVED about this user (web parity). */}
          <SummaryCard
            averageRating={received.averageRating}
            total={received.total}
            breakdown={received.breakdown}
          />

          <ReviewTabs
            tab={tab}
            onChange={setTab}
            receivedCount={received.total}
            givenCount={given.total}
          />

          {active.loading && active.reviews.length === 0 ? (
            <LoadingState />
          ) : active.error && active.reviews.length === 0 ? (
            <ErrorView message={getErrorMessage(active.error)} onRetry={() => void active.refetch()} />
          ) : active.reviews.length === 0 ? (
            <EmptyView tab={tab} />
          ) : (
            <View style={styles.listWrap}>
              {active.reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
              {active.hasMore ? (
                <Pressable
                  onPress={() => void active.loadMore()}
                  style={[styles.loadMoreButton, active.loadingMore && styles.loadMoreDisabled]}
                  disabled={active.loadingMore}
                  accessibilityRole="button"
                  accessibilityLabel="Load more reviews"
                >
                  {active.loadingMore ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.loadMoreText}>Load more</Text>
                  )}
                </Pressable>
              ) : (
                <Text style={styles.endText}>
                  {active.total > 0 ? `Showing all ${active.total} reviews` : "End of reviews"}
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function ReviewTabs({
  tab,
  onChange,
  receivedCount,
  givenCount,
}: Readonly<{
  tab: ReviewTab;
  onChange: (t: ReviewTab) => void;
  receivedCount: number;
  givenCount: number;
}>) {
  return (
    <View style={styles.tabs}>
      {(["received", "given"] as const).map((t) => {
        const activeTab = t === tab;
        const label = t === "received" ? `Received (${receivedCount})` : `Given (${givenCount})`;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            style={[styles.tab, activeTab && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab }}
            accessibilityLabel={label}
          >
            <Text style={[styles.tabText, activeTab && styles.tabTextActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Header / title — standard app pattern: circular icon back button + title.
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
  },

  // Summary card
  summaryCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 14,
  },
  summaryLeft: { alignItems: "center", minWidth: 80 },
  avgValue: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 42,
  },
  starRow: { flexDirection: "row", gap: 2, marginTop: 2 },
  totalReviewsText: { color: colors.mutedText, fontSize: 12, marginTop: 4 },
  summaryRight: { flex: 1, gap: 6 },
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  breakdownStar: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
    width: 12,
    textAlign: "center",
  },
  breakdownTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    backgroundColor: STAR_COLOR,
    borderRadius: 4,
  },
  breakdownCount: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
    width: 16,
    textAlign: "right",
  },

  // Received / Given tabs (segmented control)
  tabs: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  tabActive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabText: { color: colors.mutedText, fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: colors.text, fontWeight: "800" },

  // Review list
  listWrap: { gap: 10 },
  reviewCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 10,
  },
  reviewTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  reviewerBlock: { flex: 1, minWidth: 0 },
  reviewerName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  reviewerDate: { color: colors.subtleText, fontSize: 12, marginTop: 1 },
  reviewStars: { flexDirection: "row", gap: 1 },
  reviewBody: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
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
    paddingVertical: 32,
    paddingHorizontal: 18,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "500",
    marginTop: 12,
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
