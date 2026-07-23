import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/feedback/appFeedback";
import {
  DISPUTABLE_STATUSES,
  FILE_CATEGORIES,
  MIN_DESCRIPTION,
} from "@/features/disputes/disputeConfig";
import { useBookings } from "@/hooks/api/useBookings";
import { MainTabParamList } from "@/navigation/types";
import { getErrorMessage, disputesApi, type Booking, type RNUploadFile } from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "FileDisputeTab">;

const MAX_EVIDENCE = 5;
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

function isPdf(file: RNUploadFile): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function bookingRoute(b: Booking): string {
  return b.parcel ? `${b.parcel.from_city} → ${b.parcel.to_city}` : "Booking";
}

function bookingLabel(b: Booking): string {
  return `#${b.id.slice(0, 8)} · ${bookingRoute(b)}`;
}

export function FileDisputeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainTabParamList, "FileDisputeTab">>();
  const presetBookingId = route.params?.bookingId;

  const { bookings } = useBookings({ perPage: 100 });
  const disputable = useMemo(
    () => bookings.filter((b) => DISPUTABLE_STATUSES.has(b.status)),
    [bookings],
  );

  const [bookingId, setBookingId] = useState<string>(presetBookingId ?? "");
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<RNUploadFile[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Show the selected booking from the full set (a chat-preset booking may not
  // be in the disputable list if its status is edge-case, but we still label it).
  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === bookingId) ?? null,
    [bookings, bookingId],
  );

  const descLen = description.trim().length;
  const isValid = Boolean(bookingId) && Boolean(category) && descLen >= MIN_DESCRIPTION;

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("DisputesTab");
  }, [navigation]);

  const pickEvidence = useCallback(async () => {
    if (evidence.length >= MAX_EVIDENCE) {
      showToast({ title: `Up to ${MAX_EVIDENCE} files`, variant: "info" });
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const tooBig = result.assets.some((a) => a.size != null && a.size > MAX_EVIDENCE_BYTES);
      const picked: RNUploadFile[] = result.assets
        .filter((a) => a.size == null || a.size <= MAX_EVIDENCE_BYTES)
        .map((a, i) => ({
          uri: a.uri,
          name: a.name ?? `evidence-${Date.now()}-${i}`,
          type: a.mimeType ?? "application/octet-stream",
        }));
      if (tooBig) {
        showToast({ title: "Some files skipped", message: "Each file must be under 10 MB.", variant: "warning" });
      }
      setEvidence((prev) => [...prev, ...picked].slice(0, MAX_EVIDENCE));
    } catch (err) {
      showToast({ title: "Couldn't pick file", message: getErrorMessage(err), variant: "error" });
    }
  }, [evidence.length]);

  const removeEvidence = useCallback((uri: string) => {
    setEvidence((prev) => prev.filter((f) => f.uri !== uri));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await disputesApi.create({
        booking_id: bookingId,
        category: category as string,
        description: description.trim(),
      });
      const disputeId = res.data?.id;
      if (disputeId && evidence.length > 0) {
        try {
          await disputesApi.uploadEvidence(disputeId, evidence);
        } catch (e) {
          // The dispute was created; only the photos failed. Don't block success.
          showToast({
            title: "Dispute filed, but evidence upload failed",
            message: getErrorMessage(e),
            variant: "warning",
          });
        }
      }
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [isValid, submitting, bookingId, category, description, evidence]);

  if (submitted) {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={44} color={colors.safe} />
          </View>
          <Text style={styles.successTitle}>Dispute filed</Text>
          <Text style={styles.successSubtitle}>
            We've received your report. Our team will review it and follow up here.
          </Text>
          <AppButton
            label="View Disputes"
            onPress={() => navigation.navigate("DisputesTab")}
            style={styles.cta}
          />
          <Pressable onPress={() => navigation.navigate("Home")} style={styles.homeLinkWrap}>
            <Text style={styles.homeLink}>Back to Home</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>File a Dispute</Text>
      </View>

      {error ? (
        <View style={styles.bannerSlot}>
          <FormBanner variant="error" title="Couldn't file dispute" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {/* Booking selector */}
      <Text style={styles.label}>BOOKING</Text>
      <Pressable
        style={styles.selectField}
        onPress={() => setPickerOpen(true)}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Select a booking"
      >
        <Text style={[styles.selectValue, !selectedBooking && styles.selectPlaceholder]} numberOfLines={1}>
          {selectedBooking ? bookingLabel(selectedBooking) : "Select a booking"}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.mutedText} />
      </Pressable>
      {selectedBooking ? (
        <Card style={styles.bookingSummary}>
          <Text style={styles.bookingSummaryRoute}>{bookingRoute(selectedBooking)}</Text>
          {selectedBooking.parcel?.category ? (
            <Text style={styles.bookingSummaryMeta}>{selectedBooking.parcel.category}</Text>
          ) : null}
        </Card>
      ) : disputable.length === 0 ? (
        <Text style={styles.helperText}>
          No eligible bookings to dispute yet. Disputes can be raised on confirmed, in-transit, or
          completed deliveries.
        </Text>
      ) : null}

      {/* Category */}
      <Text style={[styles.label, styles.labelGap]}>WHAT HAPPENED?</Text>
      <View style={styles.categoryGrid}>
        {FILE_CATEGORIES.map((cat) => {
          const active = category === cat.key;
          return (
            <Pressable
              key={cat.key}
              onPress={() => setCategory(cat.key)}
              disabled={submitting}
              style={[styles.categoryCard, active && styles.categoryCardActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={cat.icon} size={18} color={active ? colors.primary : colors.mutedText} />
              <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]} numberOfLines={2}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Description */}
      <AppInput
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the issue in detail…"
        multiline
        editable={!submitting}
      />
      <Text style={[styles.counter, descLen > 0 && descLen < MIN_DESCRIPTION && styles.counterWarn]}>
        {descLen}/{MIN_DESCRIPTION} minimum characters
      </Text>

      {/* Evidence */}
      <Text style={[styles.label, styles.labelGap]}>EVIDENCE (OPTIONAL)</Text>
      <View style={styles.evidenceRow}>
        {evidence.map((f) => (
          <View key={f.uri} style={styles.evidenceThumbWrap}>
            {isPdf(f) ? (
              <View style={[styles.evidenceThumb, styles.evidencePdf]}>
                <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                <Text style={styles.evidencePdfName} numberOfLines={1}>
                  {f.name}
                </Text>
              </View>
            ) : (
              <Image source={{ uri: f.uri }} style={styles.evidenceThumb} />
            )}
            <Pressable
              style={styles.evidenceRemove}
              onPress={() => removeEvidence(f.uri)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Remove file"
            >
              <Ionicons name="close" size={12} color={colors.white} />
            </Pressable>
          </View>
        ))}
        {evidence.length < MAX_EVIDENCE ? (
          <Pressable
            style={styles.evidenceAdd}
            onPress={() => void pickEvidence()}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Add evidence photo"
          >
            <Ionicons name="camera-outline" size={22} color={colors.primary} />
            <Text style={styles.evidenceAddText}>Add</Text>
          </Pressable>
        ) : null}
      </View>

      <AppButton
        label={submitting ? "Filing…" : "Submit Dispute"}
        onPress={() => void handleSubmit()}
        disabled={!isValid || submitting}
        leftIcon={submitting ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
        style={styles.cta}
      />

      {/* Booking picker modal */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select a booking</Text>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>
          {disputable.length === 0 ? (
            <Text style={styles.sheetEmpty}>No eligible bookings to dispute.</Text>
          ) : (
            <FlatList
              data={disputable}
              keyExtractor={(b) => b.id}
              ItemSeparatorComponent={() => <View style={styles.sheetSep} />}
              renderItem={({ item }) => {
                const active = item.id === bookingId;
                return (
                  <Pressable
                    style={[styles.sheetRow, active && styles.sheetRowActive]}
                    onPress={() => {
                      setBookingId(item.id);
                      setPickerOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.sheetRowTitle} numberOfLines={1}>
                        {bookingRoute(item)}
                      </Text>
                      <Text style={styles.sheetRowMeta} numberOfLines={1}>
                        #{item.id.slice(0, 8)}
                        {item.parcel?.category ? ` · ${item.parcel.category}` : ""}
                      </Text>
                    </View>
                    {active ? <Ionicons name="checkmark" size={16} color={colors.wordmark} /> : null}
                  </Pressable>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 18, gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  bannerSlot: { marginBottom: 14 },
  label: { color: colors.mutedText, fontSize: 11, fontWeight: "800", letterSpacing: 0.5, marginBottom: 8 },
  labelGap: { marginTop: 20 },
  selectField: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectValue: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1 },
  selectPlaceholder: { color: colors.subtleText, fontWeight: "500" },
  bookingSummary: { marginTop: 10, paddingVertical: 12, paddingHorizontal: 14, gap: 2 },
  bookingSummaryRoute: { color: colors.text, fontSize: 14, fontWeight: "700" },
  bookingSummaryMeta: { color: colors.mutedText, fontSize: 12, textTransform: "capitalize" },
  helperText: { color: colors.mutedText, fontSize: 13, lineHeight: 18, marginTop: 8 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  categoryCard: {
    width: "47%",
    flexGrow: 1,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryCardActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.surfaceTintPrimary },
  categoryLabel: { color: colors.mutedText, fontSize: 13, fontWeight: "600", flex: 1 },
  categoryLabelActive: { color: colors.primary, fontWeight: "700" },
  counter: { color: colors.subtleText, fontSize: 12, marginTop: 6, fontWeight: "500" },
  counterWarn: { color: colors.warning },
  evidenceRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  evidenceThumbWrap: { position: "relative" },
  evidenceThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  evidencePdf: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTintPrimary,
  },
  evidencePdfName: { color: colors.mutedText, fontSize: 9, fontWeight: "600", textAlign: "center", maxWidth: 64 },
  evidenceRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.card,
  },
  evidenceAdd: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  evidenceAddText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  cta: { marginTop: 24 },
  successWrap: { alignItems: "center", paddingTop: 72, gap: 12, paddingHorizontal: 20 },
  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#DFF3E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: { color: colors.text, fontSize: 24, fontWeight: "800" },
  successSubtitle: { color: colors.mutedText, fontSize: 15, textAlign: "center", lineHeight: 22, maxWidth: 300 },
  homeLinkWrap: { marginTop: 8 },
  homeLink: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  // Booking picker sheet
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.4)" },
  sheet: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    maxHeight: "70%",
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  sheetEmpty: { color: colors.mutedText, fontSize: 13, paddingVertical: 24, textAlign: "center" },
  sheetSep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  sheetRowActive: { backgroundColor: colors.surfaceTintPrimary, borderRadius: 8 },
  sheetRowTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  sheetRowMeta: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
});
