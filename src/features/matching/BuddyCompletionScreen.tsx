import { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { AppButton } from "@/components/ui/AppButton";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";
import { showToast } from "@/feedback/appFeedback";

export function BuddyCompletionScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const route = useRoute();
  const buddyName = (route.params as any)?.buddyName ?? "Sarah K.";
  const addReview = useAppStore((s) => s.addReview);

  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  const handleSubmit = () => {
    if (rating === 0) return;
    addReview({
      id: `REV-BUDDY-${Date.now()}`,
      bookingId: "buddy",
      reviewerName: "Alex Johnson",
      reviewerAvatar: "A",
      rating,
      text: `Great travel companion on our journey together!`,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
    setSubmitted(true);
    showToast({ title: "Review submitted!", variant: "success" });
  };

  if (submitted) {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <Ionicons name="heart-circle" size={72} color={colors.primary} />
          <Text style={styles.successTitle}>Journey Complete!</Text>
          <Text style={styles.successSubtitle}>
            Thanks for traveling with {buddyName}. Your review helps the community.
          </Text>
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
        <Text style={styles.title}>Journey Complete</Text>
      </View>

      <Card style={styles.completionCard}>
        <View style={styles.checkIcon}>
          <Ionicons name="airplane-outline" size={40} color={colors.safe} />
        </View>
        <Text style={styles.completionTitle}>You've arrived!</Text>
        <Text style={styles.completionSubtitle}>
          Your journey with {buddyName} is complete. How was the experience?
        </Text>
      </Card>

      <Card style={styles.buddyCard}>
        <View style={styles.buddyRow}>
          <View style={styles.buddyAvatar}>
            <Text style={styles.buddyAvatarText}>{buddyName.charAt(0)}</Text>
          </View>
          <View>
            <Text style={styles.buddyName}>{buddyName}</Text>
            <Text style={styles.buddyRoute}>Travel Companion</Text>
          </View>
        </View>
      </Card>

      <Text style={styles.rateLabel}>Rate your experience</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => setRating(star)}>
            <Ionicons
              name={star <= rating ? "star-outline" : "star-outline"}
              size={40}
              color={star <= rating ? colors.warning : colors.border}
            />
          </Pressable>
        ))}
      </View>

      <AppButton label="Submit & Complete" onPress={handleSubmit} disabled={rating === 0} style={styles.cta} />
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
  completionCard: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 20, marginBottom: 20 },
  checkIcon: { marginBottom: 12 },
  completionTitle: { color: colors.text, fontSize: 20, fontWeight: "800", marginBottom: 8 },
  completionSubtitle: { color: colors.mutedText, fontSize: 14, textAlign: "center", lineHeight: 20 },
  buddyCard: { paddingVertical: 14, paddingHorizontal: 14, marginBottom: 24 },
  buddyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  buddyAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center",
  },
  buddyAvatarText: { color: colors.text, fontWeight: "700", fontSize: 20 },
  buddyName: { color: colors.text, fontSize: 17, fontWeight: "700" },
  buddyRoute: { color: colors.mutedText, fontSize: 13 },
  rateLabel: { color: colors.text, fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 12 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 },
  cta: { marginTop: 8 },
  successWrap: { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 20 },
  successTitle: { color: colors.text, fontSize: 24, fontWeight: "800" },
  successSubtitle: { color: colors.mutedText, fontSize: 15, textAlign: "center", maxWidth: 280, lineHeight: 22 },
});
