import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { useBookingDetail } from "@/hooks/api/useBookingDetail";
import { MainTabParamList } from "@/navigation/types";
import { getErrorMessage, ratingsApi } from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "DeliveryReviewTab">;

const SCORE_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

/**
 * Rate a completed delivery — real ratings API (web parity with
 * `CustomerRateDelivery`). Loads the booking, rates the OTHER party, and
 * persists via `ratingsApi.rateDelivery`. (This screen was previously a mock
 * that wrote to the local store and never hit the server.)
 */
export function DeliveryReviewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainTabParamList, "DeliveryReviewTab">>();
  const bookingId = route.params?.bookingId;
  const { user } = useAuth();

  const { booking, loading, error, refetch } = useBookingDetail(bookingId);

  const [score, setScore] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // The counterparty: whoever isn't the signed-in user on this booking.
  const { ratedUserId, ratedUserName } = useMemo(() => {
    if (!booking || !user) return { ratedUserId: null as string | null, ratedUserName: "User" };
    const viewerIsSender = booking.sender_id === user.id;
    return {
      ratedUserId: viewerIsSender ? booking.carrier_id : booking.sender_id,
      ratedUserName: viewerIsSender
        ? booking.carrier?.name ?? "Carrier"
        : booking.sender?.name ?? "Sender",
    };
  }, [booking, user]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("BookingsTab");
  }, [navigation]);

  const handleSubmit = useCallback(async () => {
    if (!bookingId || !ratedUserId || score === 0 || submitting) return;
    setSubmitting(true);
    try {
      await ratingsApi.rateDelivery({
        booking_id: bookingId,
        rated_user_id: ratedUserId,
        score,
        review: review.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      showToast({
        title: "Couldn't submit review",
        message: getErrorMessage(err),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [bookingId, ratedUserId, score, review, submitting]);

  // ───────── Loading ─────────
  if (loading && !booking) {
    return (
      <Screen refreshEnabled={false}>
        <ReviewHeader onBack={goBack} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centeredText}>Loading booking…</Text>
        </View>
      </Screen>
    );
  }

  // ───────── Error / not found ─────────
  if ((error || !booking) && !loading) {
    return (
      <Screen refreshEnabled={false}>
        <ReviewHeader onBack={goBack} />
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedText} />
          <Text style={styles.errorTitle}>Couldn't load booking</Text>
          {error ? <Text style={styles.errorBody}>{getErrorMessage(error)}</Text> : null}
          <Pressable style={styles.retryButton} onPress={() => void refetch()} accessibilityRole="button">
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // ───────── Success ─────────
  if (submitted) {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="star" size={40} color={colors.safe} />
          </View>
          <Text style={styles.successTitle}>Thank you!</Text>
          <Text style={styles.successSubtitle}>
            Your review for {ratedUserName} has been submitted.
          </Text>
          <AppButton
            label="Back to Bookings"
            onPress={() => navigation.navigate("BookingsTab")}
            style={styles.cta}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ReviewHeader onBack={goBack} />

      <Text style={styles.subtitle}>
        How was your experience with <Text style={styles.subtitleStrong}>{ratedUserName}</Text>?
      </Text>

      {booking?.parcel ? (
        <Card style={styles.bookingInfo}>
          <Text style={styles.bookingRoute}>
            {booking.parcel.from_city} {"→"} {booking.parcel.to_city}
          </Text>
          {booking.parcel.fee_offered != null ? (
            <Text style={styles.bookingFee}>USD ${booking.parcel.fee_offered}</Text>
          ) : null}
        </Card>
      ) : null}

      <Text style={styles.question}>Rating</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => setScore(star)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`${star} star${star > 1 ? "s" : ""}`}
          >
            <Ionicons
              name={star <= score ? "star" : "star-outline"}
              size={42}
              color={star <= score ? colors.warning : colors.border}
            />
          </Pressable>
        ))}
      </View>
      <Text style={styles.ratingLabel}>{score === 0 ? "Tap to rate" : SCORE_LABELS[score]}</Text>

      <AppInput
        label="Review (optional)"
        value={review}
        onChangeText={setReview}
        placeholder="Share your experience…"
        multiline
      />

      <AppButton
        label={submitting ? "Submitting…" : "Submit Review"}
        onPress={() => void handleSubmit()}
        disabled={score === 0 || submitting}
        style={styles.cta}
      />
    </Screen>
  );
}

function ReviewHeader({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <View style={styles.headerRow}>
      <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.title}>Rate Delivery</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 16, gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  subtitleStrong: { color: colors.text, fontWeight: "700" },
  bookingInfo: { paddingVertical: 14, paddingHorizontal: 14, marginBottom: 22, gap: 4 },
  bookingRoute: { color: colors.text, fontSize: 16, fontWeight: "700" },
  bookingFee: { color: colors.mutedText, fontSize: 13, fontWeight: "600" },
  question: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 8 },
  ratingLabel: { color: colors.text, fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 22 },
  cta: { marginTop: 18 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  centeredText: { color: colors.mutedText, fontSize: 14, fontWeight: "500" },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  errorBody: { color: colors.mutedText, fontSize: 13, textAlign: "center", maxWidth: 280 },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  retryButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  successWrap: { alignItems: "center", paddingTop: 72, gap: 12 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#DFF3E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: { color: colors.text, fontSize: 24, fontWeight: "800" },
  successSubtitle: { color: colors.mutedText, fontSize: 15, textAlign: "center", maxWidth: 280 },
});
