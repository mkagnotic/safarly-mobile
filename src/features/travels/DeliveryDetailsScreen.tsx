import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  CompositeNavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { ParcelJourneyTimeline } from "@/features/travels/ParcelJourneyTracker";
import { useBookingDetail } from "@/hooks/api/useBookingDetail";
import { useMyProfile } from "@/hooks/api/useMyProfile";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { getErrorMessage, type Booking } from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;
type Route = RouteProp<MainTabParamList, "DeliveryDetailsTab">;

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function initialsOf(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Details for a completed delivery, reached from the Archive tab.
 *
 * Archive cards previously carried an inline expandable timeline; the standard
 * pattern is a summary in the list and the full record on its own screen, so
 * the journey timeline lives here alongside the route, dates and counterpart.
 */
export function DeliveryDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const bookingId = route.params?.bookingId;

  const { booking, timeline, loading, error, refetch } = useBookingDetail(bookingId);
  const myProfile = useMyProfile();

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Parcels"); // My Travels lives on the "Parcels" tab key
  }, [navigation]);

  const handleRate = useCallback(() => {
    if (!bookingId) return;
    navigation.navigate("DeliveryReviewTab", { bookingId });
  }, [navigation, bookingId]);

  /**
   * `/booking-handler/{id}` returns the timeline as a sibling of the booking,
   * while `computeJourney` reads `booking.timeline`. Merge so the tracker sees
   * the same events either shape delivers.
   */
  const bookingWithTimeline = useMemo<Booking | null>(() => {
    if (!booking) return null;
    if (booking.timeline?.length) return booking;
    return { ...booking, timeline };
  }, [booking, timeline]);

  if (loading && !booking) {
    return (
      <Screen onRefresh={refetch}>
        <DetailsHeader onBack={handleBack} />
        <SkeletonBlock style={styles.skeletonCard} />
        <SkeletonBlock style={styles.skeletonCard} />
      </Screen>
    );
  }

  if (!booking) {
    return (
      <Screen onRefresh={refetch}>
        <DetailsHeader onBack={handleBack} />
        <Card style={styles.emptyCard}>
          <Ionicons name="cube-outline" size={28} color={colors.mutedText} />
          <Text style={styles.emptyTitle}>Delivery not found</Text>
          <Text style={styles.emptyBody}>
            {error
              ? getErrorMessage(error)
              : "This delivery may have been removed or is no longer available."}
          </Text>
          <AppButton
            label="Back to My travels"
            onPress={handleBack}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.emptyButton}
          />
        </Card>
      </Screen>
    );
  }

  const isSender = !!myProfile.profile?.id && booking.sender_id === myProfile.profile.id;
  const counterpart = isSender ? booking.carrier : booking.sender;
  const roleLabel = isSender ? "Carrier" : "Sender";
  const deliveredOn = formatDate(booking.delivered_at);
  const parcel = booking.parcel;

  return (
    <Screen onRefresh={refetch}>
      <DetailsHeader onBack={handleBack} />

      {error ? (
        <View style={styles.bannerSlot}>
          <FormBanner message={getErrorMessage(error)} />
        </View>
      ) : null}

      <Card style={styles.card}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>DELIVERED</Text>
        </View>
        <View style={styles.routeRow}>
          <Text style={styles.routeText} numberOfLines={2}>
            {parcel?.from_city ?? "—"}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={colors.mutedText} />
          <Text style={styles.routeText} numberOfLines={2}>
            {parcel?.to_city ?? "—"}
          </Text>
        </View>
        {deliveredOn ? <Text style={styles.meta}>Delivered · {deliveredOn}</Text> : null}

        <View style={styles.factGrid}>
          {parcel?.category ? <Fact label="Category" value={parcel.category} /> : null}
          {parcel?.weight_kg != null ? (
            <Fact label="Weight" value={`${parcel.weight_kg} kg`} />
          ) : null}
          {parcel?.fee_offered != null ? (
            <Fact label="Fee" value={`$${parcel.fee_offered}`} />
          ) : null}
        </View>

        {parcel?.description ? (
          <Text style={styles.description}>{parcel.description}</Text>
        ) : null}
      </Card>

      {counterpart ? (
        <Card style={styles.personCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(counterpart.name)}</Text>
          </View>
          <View style={styles.personCol}>
            <Text style={styles.personName} numberOfLines={1}>
              {counterpart.name || "Unknown user"}
            </Text>
            <Text style={styles.personRole}>{roleLabel}</Text>
          </View>
          {/* Ratings are one-per (author, booking) — re-rating fails with
              CONFLICT, so once rated this becomes a state, not an action. */}
          {booking.viewer_has_rated ? (
            <View style={styles.ratedChip}>
              <Ionicons name="star" size={13} color={colors.safe} />
              <Text style={styles.ratedChipText}>Rated</Text>
            </View>
          ) : (
            <AppButton
              label={`Rate ${roleLabel.toLowerCase()}`}
              onPress={handleRate}
              gradientColors={[colors.ctaAccent, colors.ctaAccent]}
              style={styles.rateButton}
            />
          )}
        </Card>
      ) : null}

      {/* No `parcel` prop: it only serves as a pre-booking fallback, and a
          booking is always present here. `booking.parcel` is a partial shape
          anyway, not a full Parcel. */}
      <ParcelJourneyTimeline booking={bookingWithTimeline} />
    </Screen>
  );
}

function Fact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function DetailsHeader({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <View style={styles.headerRow}>
      <Pressable
        style={styles.backButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>Delivery details</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 34,
    marginTop: 16,
    marginBottom: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },
  bannerSlot: { marginBottom: 14 },

  card: { padding: 16, marginBottom: 12 },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(34, 195, 93, 0.12)",
    marginBottom: 10,
  },
  tagText: {
    color: colors.safe,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  routeText: { color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: "800", flexShrink: 1 },
  meta: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "500", marginTop: 6 },

  factGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 14 },
  fact: { minWidth: 80 },
  factLabel: {
    color: colors.subtleText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  factValue: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700", marginTop: 2 },
  description: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    marginTop: 14,
  },

  personCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.wordmark, fontSize: 15, lineHeight: 20, fontWeight: "800" },
  personCol: { flex: 1, minWidth: 0 },
  personName: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  personRole: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  rateButton: { minWidth: 120 },
  ratedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(34, 195, 93, 0.12)",
  },
  ratedChipText: { color: colors.safe, fontSize: 13, lineHeight: 18, fontWeight: "800" },

  skeletonCard: { height: 140, borderRadius: 16, marginBottom: 12 },
  emptyCard: { padding: 24, alignItems: "center", gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: "800" },
  emptyBody: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
  },
  emptyButton: { marginTop: 12, alignSelf: "stretch" },
});
