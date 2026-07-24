import { useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  CompositeNavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { ProfileSkeleton } from "@/components/ui/Skeletons";
import { initialsFromFullName } from "@/features/profile/profileUtils";
import { usePublicProfile } from "@/hooks/api/usePublicProfile";
import { useUserReviews } from "@/hooks/api/useUserReviews";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { getErrorMessage, type Rating } from "@/services/api";
import { colors } from "@/theme/colors";
import { shadowCard } from "@/theme/elevation";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "PublicProfileTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

const PER_PAGE = 10; // matches web `useUserRatings` / ReviewsScreen
const STAR_COLOR = colors.warning;

function isKycVerified(status?: string | null): boolean {
  const s = status?.toLowerCase();
  return s === "verified" || s === "approved";
}

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function memberSince(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : String(d.getFullYear());
}

export function PublicProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainTabParamList, "PublicProfileTab">>();
  const userId = route.params?.userId;
  const fallbackName = route.params?.name;

  const { profile, loading, error, refetch } = usePublicProfile(userId);
  const reviews = useUserReviews(userId, { perPage: PER_PAGE });

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("SearchTab");
  }, [navigation]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), reviews.refetch()]);
  }, [refetch, reviews]);

  const name = profile?.name ?? fallbackName ?? "User";
  const avatarUrl = profile?.avatar_url ?? null;
  const initials = name ? initialsFromFullName(name) : "??";
  // Prefer the reviews aggregate (matches web), fall back to the profile field.
  const displayRating = reviews.averageRating > 0 ? reviews.averageRating : (profile?.rating ?? 0);
  const isNew = !displayRating || displayRating <= 0;
  const reviewCount = reviews.total;
  const verified = isKycVerified(profile?.kyc_status);
  const preferredRoutes =
    [profile?.city, profile?.country].filter(Boolean).join(", ") || "—";

  return (
    <Screen onRefresh={handleRefresh}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={6}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Profile</Text>
      </View>

      {loading && !profile ? (
        <ProfileSkeleton />
      ) : error && !profile ? (
        <Card style={styles.errorCard}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
          <Text style={styles.errorTitle}>Could not load profile</Text>
          <Text style={styles.errorBody}>{getErrorMessage(error)}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void refetch()}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </Card>
      ) : (
        <>
          {/* ───────── Profile card ───────── */}
          <Card style={styles.profileCard}>
            <View style={styles.profileRow}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarLabel}>{initials}</Text>
                </View>
              )}
              <View style={styles.profileTextWrap}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {name}
                </Text>
                <View style={styles.metaRow}>
                  <Ionicons name="star" size={13} color={STAR_COLOR} />
                  <Text style={styles.ratingText}>{isNew ? "New" : displayRating.toFixed(1)}</Text>
                  <Text style={styles.metaSep}>•</Text>
                  <Text style={styles.metaText}>
                    {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                  </Text>
                </View>
                {verified ? (
                  <View style={styles.kycRow}>
                    <Ionicons name="shield-checkmark-outline" size={13} color={colors.safe} />
                    <Text style={styles.kycText}>KYC Verified</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Card>

          {/* ───────── Stats ───────── */}
          <View style={styles.statsRow}>
            <StatCard
              icon="cube-outline"
              iconColor={colors.safe}
              value={String(profile?.total_deliveries ?? 0)}
              label="DELIVERIES"
            />
            <StatCard
              icon="people-outline"
              iconColor={colors.primary}
              value={String(profile?.total_trips ?? 0)}
              label="BUDDY TRIPS"
            />
            <StatCard
              icon="calendar-outline"
              iconColor={colors.warning}
              value={memberSince(profile?.created_at)}
              label="MEMBER SINCE"
            />
          </View>

          {/* ───────── About ───────── */}
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <Card style={styles.aboutCard}>
            <Text style={styles.aboutLabel}>Bio</Text>
            <Text style={[styles.aboutValue, !profile?.bio?.trim() && styles.aboutValueMuted]}>
              {profile?.bio?.trim() || "No bio provided"}
            </Text>
            <View style={styles.aboutDivider} />
            <Text style={styles.aboutLabel}>Preferred routes</Text>
            <Text style={styles.aboutValue}>{preferredRoutes}</Text>
          </Card>

          {/* ───────── Reviews ───────── */}
          <Text style={styles.sectionTitle}>REVIEWS</Text>
          {reviews.loading && reviews.reviews.length === 0 ? (
            <Card style={styles.reviewsLoadingCard}>
              <ActivityIndicator color={colors.primary} />
            </Card>
          ) : reviews.reviews.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="star-outline" size={30} color={colors.mutedText} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No reviews yet</Text>
            </Card>
          ) : (
            <View style={styles.listWrap}>
              {reviews.reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
              {reviews.hasMore ? (
                <Pressable
                  onPress={() => void reviews.loadMore()}
                  style={[styles.loadMoreButton, reviews.loadingMore && styles.loadMoreDisabled]}
                  disabled={reviews.loadingMore}
                  accessibilityRole="button"
                  accessibilityLabel="Load more reviews"
                >
                  {reviews.loadingMore ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.loadMoreText}>Load more</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

// ───────────────────────────── Sub-components ─────────────────────────────

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string;
  label: string;
}

function StatCard({ icon, iconColor, value, label }: Readonly<StatCardProps>) {
  return (
    <View style={[styles.statCard, shadowCard()]}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getInitials(value?: string | null): string {
  if (!value) return "?";
  return value
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ReviewCard({ review }: Readonly<{ review: Rating }>) {
  const raterName = review.rater?.name ?? "Anonymous";
  const raterAvatar = review.rater?.avatar_url;
  return (
    <Card style={styles.reviewCard}>
      <View style={styles.reviewTop}>
        {raterAvatar ? (
          <Image source={{ uri: raterAvatar }} style={styles.reviewAvatarImage} />
        ) : (
          <View style={styles.reviewAvatarFallback}>
            <Text style={styles.reviewAvatarInitials}>{getInitials(raterName)}</Text>
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

// ───────────────────────────── Styles ─────────────────────────────

const styles = StyleSheet.create({
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
  title: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: "800" },

  centered: { alignItems: "center", paddingVertical: 64, gap: 12 },
  centeredText: { color: colors.mutedText, fontSize: 13, fontWeight: "500" },

  errorCard: { borderRadius: 16, alignItems: "center", paddingVertical: 24, paddingHorizontal: 18 },
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

  // Profile card
  profileCard: { marginBottom: 16, gap: 14 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 76, height: 76, borderRadius: 38 },
  avatarLabel: { color: colors.primary, fontSize: 26, fontWeight: "800" },
  profileTextWrap: { flex: 1, gap: 4 },
  profileName: { color: colors.text, fontSize: 18, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
  ratingText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  metaSep: { color: colors.mutedText, fontSize: 12 },
  metaText: { color: colors.mutedText, fontSize: 12, fontWeight: "500" },
  kycRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  kycText: { color: colors.safe, fontSize: 12, fontWeight: "700" },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 4,
  },
  statValue: { color: colors.text, fontSize: 18, lineHeight: 22, fontWeight: "800" },
  statLabel: { color: colors.mutedText, fontSize: 9, fontWeight: "700", letterSpacing: 0.4 },

  // About
  sectionTitle: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  aboutCard: { marginBottom: 18, gap: 6 },
  aboutLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  aboutValue: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  aboutValueMuted: { color: colors.mutedText, fontStyle: "italic" },
  aboutDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 8,
  },

  // Reviews
  listWrap: { gap: 10 },
  reviewsLoadingCard: { borderRadius: 16, alignItems: "center", paddingVertical: 28 },
  emptyCard: { borderRadius: 16, alignItems: "center", paddingVertical: 32, paddingHorizontal: 18 },
  emptyIcon: { opacity: 0.4 },
  emptyText: { color: colors.mutedText, fontSize: 14, fontWeight: "500", marginTop: 12 },
  reviewCard: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 10 },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  reviewAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  reviewAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarInitials: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  reviewerBlock: { flex: 1, minWidth: 0 },
  reviewerName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  reviewerDate: { color: colors.subtleText, fontSize: 12, marginTop: 1 },
  reviewStars: { flexDirection: "row", gap: 1 },
  reviewBody: { color: colors.text, fontSize: 14, lineHeight: 21 },

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
