import { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";
import { showToast } from "@/feedback/appFeedback";

export function DeliveryReviewScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const route = useRoute();
  const bookingId = (route.params as any)?.bookingId ?? "BK-001";
  const booking = useAppStore((s) => s.bookings.find((b) => b.id === bookingId));
  const addReview = useAppStore((s) => s.addReview);

  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  const handleSubmit = () => {
    if (rating === 0) return;
    addReview({
      id: `REV-${Date.now()}`,
      bookingId,
      reviewerName: "Alex Johnson",
      reviewerAvatar: "A",
      rating,
      text: review.trim(),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
    setSubmitted(true);
    showToast({ title: "Review submitted!", variant: "success" });
  };

  if (submitted) {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <Ionicons name="star" size={64} color={colors.warning} />
          <Text style={styles.successTitle}>Thanks for your review!</Text>
          <Text style={styles.successSubtitle}>Your feedback helps build trust in the Safarly community.</Text>
          <AppButton label="Back to Home" onPress={() => navigation.navigate("Home")} style={styles.cta} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Rate Delivery</Text>
      </View>

      <Card style={styles.bookingInfo}>
        <Text style={styles.bookingLabel}>{bookingId}</Text>
        <Text style={styles.bookingRoute}>
          {booking?.from ?? "City A"} {"\u2192"} {booking?.to ?? "City B"}
        </Text>
      </Card>

      <Text style={styles.question}>How was your experience?</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => setRating(star)}>
            <Ionicons
              name={star <= rating ? "star" : "star"}
              size={42}
              color={star <= rating ? colors.warning : colors.border}
            />
          </Pressable>
        ))}
      </View>
      <Text style={styles.ratingLabel}>
        {rating === 0 ? "Tap to rate" : rating === 5 ? "Excellent!" : rating >= 4 ? "Great!" : rating >= 3 ? "Good" : rating >= 2 ? "Fair" : "Poor"}
      </Text>

      <AppInput
        label="Write a review (optional)"
        value={review}
        onChangeText={setReview}
        placeholder="Share your experience..."
        multiline
      />

      <AppButton label="Submit Review" onPress={handleSubmit} disabled={rating === 0} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 20, gap: 12 },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  bookingInfo: { paddingVertical: 14, paddingHorizontal: 14, marginBottom: 24 },
  bookingLabel: { color: colors.mutedText, fontSize: 12, fontWeight: "700" },
  bookingRoute: { color: colors.text, fontSize: 17, fontWeight: "700", marginTop: 4 },
  question: { color: colors.text, fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 16 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 8 },
  ratingLabel: { color: colors.mutedText, fontSize: 14, fontWeight: "600", textAlign: "center", marginBottom: 24 },
  cta: { marginTop: 16 },
  successWrap: { alignItems: "center", paddingTop: 80, gap: 12 },
  successTitle: { color: colors.text, fontSize: 24, fontWeight: "800" },
  successSubtitle: { color: colors.mutedText, fontSize: 15, textAlign: "center", maxWidth: 260 },
});
