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
import type { DisputeCategory } from "@/types/models";

const CATEGORIES: { key: DisputeCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "damaged", label: "Damaged Package", icon: "alert-circle" },
  { key: "late_delivery", label: "Late Delivery", icon: "time-outline" },
  { key: "wrong_items", label: "Wrong Items", icon: "swap-horizontal" },
  { key: "missing_items", label: "Missing Items", icon: "remove-circle" },
  { key: "no_show", label: "No Show", icon: "close-circle" },
  { key: "other", label: "Other", icon: "ellipsis-horizontal" },
];

export function FileDisputeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const route = useRoute();
  const bookingId = (route.params as any)?.bookingId ?? "";
  const addDispute = useAppStore((s) => s.addDispute);

  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  const handleSubmit = () => {
    if (!category || !description.trim()) return;
    addDispute({
      id: `DSP-${Date.now().toString().slice(-4)}`,
      bookingId,
      category,
      description: description.trim(),
      status: "open",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      messages: [],
    });
    setSubmitted(true);
    showToast({ title: "Dispute filed successfully", variant: "success" });
  };

  if (submitted) {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <Ionicons name="checkmark-circle" size={64} color={colors.safe} />
          <Text style={styles.successTitle}>Dispute Filed</Text>
          <Text style={styles.successSubtitle}>
            We've received your report. Our team will review it and get back to you within 48 hours.
          </Text>
          <AppButton label="View Disputes" onPress={() => navigation.navigate("DisputesTab" as any)} style={styles.cta} />
          <Pressable onPress={() => navigation.navigate("Home")} style={styles.homeLinkWrap}>
            <Text style={styles.homeLink}>Back to Home</Text>
          </Pressable>
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
        <Text style={styles.title}>Report an Issue</Text>
      </View>

      {bookingId ? (
        <Card style={styles.bookingRef}>
          <Text style={styles.bookingRefLabel}>Booking: {bookingId}</Text>
        </Card>
      ) : null}

      <Text style={styles.sectionTitle}>What happened?</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => (
          <Pressable key={cat.key} onPress={() => setCategory(cat.key)}>
            <Card style={[styles.categoryCard, category === cat.key && styles.categoryCardSelected]}>
              <Ionicons name={cat.icon} size={22} color={category === cat.key ? colors.primary : colors.mutedText} />
              <Text style={[styles.categoryLabel, category === cat.key && styles.categoryLabelSelected]}>
                {cat.label}
              </Text>
            </Card>
          </Pressable>
        ))}
      </View>

      <AppInput
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the issue in detail..."
        multiline
      />

      <Pressable style={styles.uploadRow}>
        <Ionicons name="cloud-upload" size={20} color={colors.primary} />
        <Text style={styles.uploadText}>Upload evidence (photos/documents)</Text>
      </Pressable>

      <AppButton
        label="Submit Dispute"
        onPress={handleSubmit}
        disabled={!category || !description.trim()}
        style={styles.cta}
      />
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
  bookingRef: { paddingVertical: 10, paddingHorizontal: 14, marginBottom: 20 },
  bookingRefLabel: { color: colors.mutedText, fontSize: 13, fontWeight: "600" },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  categoryCard: { paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 145 },
  categoryCardSelected: { borderColor: colors.primary, borderWidth: 2 },
  categoryLabel: { color: colors.mutedText, fontSize: 13, fontWeight: "600" },
  categoryLabelSelected: { color: colors.primary },
  uploadRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 14, paddingHorizontal: 14, marginBottom: 20,
    borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primary,
    backgroundColor: colors.surfaceTintPrimary,
  },
  uploadText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  cta: { marginTop: 8 },
  successWrap: { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 20 },
  successTitle: { color: colors.text, fontSize: 24, fontWeight: "800" },
  successSubtitle: { color: colors.mutedText, fontSize: 15, textAlign: "center", lineHeight: 22, maxWidth: 300 },
  homeLinkWrap: { marginTop: 8 },
  homeLink: { color: colors.primary, fontSize: 14, fontWeight: "700" },
});
