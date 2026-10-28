import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/feedback/appFeedback";
import { FILE_CATEGORIES } from "@/features/disputes/disputeConfig";
import {
  DESCRIPTION_TOO_SHORT,
  MAX_DESCRIPTION,
  MIN_DESCRIPTION,
  descriptionCounter,
  DELIVERED_WINDOW_CLOSED_TEXT,
  eligibleDisputeBookings,
  windowClosedBookings,
  evidenceSkipNote,
  presetDisputeBooking,
} from "@/features/disputes/disputeRules";
import {
  EVIDENCE_MAX_FILES,
  evidenceCountLabel,
  screenEvidence,
  skippedEvidenceMessage,
} from "@/features/disputes/evidenceFiles";
import { useBookings } from "@/hooks/api/useBookings";
import { MainTabParamList } from "@/navigation/types";
import { getErrorMessage, disputesApi, type Booking, type RNUploadFile } from "@/services/api";
import { colors } from "@/theme/colors";
import { minLengthHint } from "@/features/bookings/lib/modalValidation";

type Nav = BottomTabNavigationProp<MainTabParamList, "FileDisputeTab">;

// Same limits as the server and the late-evidence path (evidenceFiles.ts).
const MAX_EVIDENCE = EVIDENCE_MAX_FILES;
const EVIDENCE_HINT = "JPEG, PNG, WebP, GIF or PDF · up to 8 files, 10 MB each";

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

  // Loading and a failed load used to read as "No eligible bookings" (27 Oct 2026).
  const { bookings, loading: bookingsLoading, error: bookingsError, refetch: refetchBookings } = useBookings({ perPage: 100 });
  // One dispute per booking, ever: bookings that already have one are not
  // offered (filing on them always failed with "Dispute already exists").
  const [disputedIds, setDisputedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [disputesLoading, setDisputesLoading] = useState(true);
  const loadDisputedIds = useCallback(async () => {
    setDisputesLoading(true);
    try {
      const res = await disputesApi.getMyDisputes({ page: 1, per_page: 100 });
      setDisputedIds(new Set((res.data ?? []).map((d) => d.booking_id)));
    } catch {
      // The server still refuses a second dispute; the form just can't pre-filter.
    } finally {
      setDisputesLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void loadDisputedIds();
    }, [loadDisputedIds]),
  );
  const disputable = useMemo(() => eligibleDisputeBookings(bookings, disputedIds), [bookings, disputedIds]);
  // Delivered more than 7 days ago: listed greyed, with the reason, not offered.
  const closedBookings = useMemo(() => windowClosedBookings(bookings, disputedIds), [bookings, disputedIds]);
  const presetClosed = Boolean(presetBookingId) && closedBookings.some((b) => b.id === presetBookingId);
  const listLoading = bookingsLoading || disputesLoading;

  const [bookingId, setBookingId] = useState<string>("");
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<RNUploadFile[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  /** Evidence files that were not stored, named on the success screen. */
  const [evidenceNote, setEvidenceNote] = useState<string | null>(null);
  const [descTouched, setDescTouched] = useState(false);

  const resetForm = useCallback(() => {
    setBookingId("");
    setCategory(null);
    setDescription("");
    setEvidence([]);
    setError(null);
    setSubmitted(false);
    setEvidenceNote(null);
    setDescTouched(false);
  }, []);

  // The tab stays mounted, so each navigation here (a chat's "Raise dispute",
  // the File button) starts again from its own params.
  useEffect(() => {
    resetForm();
  }, [route.params, resetForm]);

  // The chat's deal booking is selected only when it can be disputed; any other
  // preset leaves nothing selected (web parity), never a booking the server
  // would refuse.
  useEffect(() => {
    if (!presetBookingId || listLoading) return;
    setBookingId((current) => current || presetDisputeBooking(presetBookingId, disputable));
    // route.params: the same chat opening the form again must preselect again.
  }, [route.params, presetBookingId, listLoading, disputable]);

  const selectedBooking = useMemo(
    () => disputable.find((b) => b.id === bookingId) ?? null,
    [disputable, bookingId],
  );

  const descLen = description.trim().length;
  const isValid =
    Boolean(selectedBooking) && Boolean(category) && descLen >= MIN_DESCRIPTION && descLen <= MAX_DESCRIPTION;
  const descError = descTouched && descLen > 0 && descLen < MIN_DESCRIPTION ? DESCRIPTION_TOO_SHORT : undefined;
  const counter = descriptionCounter(description.length);

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
        type: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      // Only the types the server stores (no HEIC, no unknown files), 10 MB
      // each, 8 in all across picks. Every file left out is named.
      const screened = screenEvidence(
        result.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size })),
      );
      const room = Math.max(0, MAX_EVIDENCE - evidence.length);
      const kept: RNUploadFile[] = screened.files.slice(0, room);
      const note = skippedEvidenceMessage({
        ...screened,
        overLimit: screened.overLimit + (screened.files.length - kept.length),
      });
      if (note) {
        showToast({ title: kept.length ? "Some files skipped" : "No files added", message: note, variant: "warning" });
      }
      if (kept.length) setEvidence((prev) => [...prev, ...kept].slice(0, MAX_EVIDENCE));
    } catch (err) {
      showToast({ title: "Couldn't pick file", message: getErrorMessage(err), variant: "error" });
    }
  }, [evidence.length]);

  const removeEvidence = useCallback((uri: string) => {
    setEvidence((prev) => prev.filter((f) => f.uri !== uri));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isValid || submitting || !selectedBooking) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await disputesApi.create({
        booking_id: selectedBooking.id,
        category: category as string,
        description: description.trim(),
      });
      const disputeId = res.data?.id;
      let note: string | null = null;
      if (disputeId && evidence.length > 0) {
        try {
          const up = await disputesApi.uploadEvidence(disputeId, evidence);
          // Files the server would not store are named, not silently missing.
          note = evidenceSkipNote(null, up.data?.skipped_files);
        } catch (e) {
          // The dispute was created; only the evidence failed. Don't block success.
          note = `${getErrorMessage(e)} You can add it again in My Disputes.`;
        }
      }
      // One feedback for the whole action: the success screen, carrying any
      // evidence note, instead of a toast on top of it.
      setEvidenceNote(note);
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [isValid, submitting, selectedBooking, category, description, evidence]);

  if (submitted) {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={44} color={colors.safe} />
          </View>
          <Text style={styles.successTitle}>Dispute filed</Text>
          <Text style={styles.successSubtitle}>
            The Safarly support team will review it and reply in My Disputes.
          </Text>
          {evidenceNote ? (
            <View style={styles.successNote}>
              <FormBanner variant="warning" title="Some evidence wasn't added" message={evidenceNote} />
            </View>
          ) : null}
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
        <Text style={styles.title}>File a dispute</Text>
      </View>
      <Text style={styles.subtitle}>Describe the problem and the Safarly support team will look into it.</Text>

      {error ? (
        <View style={styles.bannerSlot}>
          <FormBanner variant="error" title="Couldn't file dispute" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {/* Booking selector */}
      <Text style={styles.label}>Booking</Text>
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
      ) : listLoading && disputable.length === 0 ? (
        <View style={styles.loadingRow} accessibilityRole="progressbar" accessibilityLabel="Loading your bookings">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.helperText}>Loading your bookings…</Text>
        </View>
      ) : bookingsError && bookings.length === 0 ? (
        <Pressable onPress={() => void refetchBookings()} accessibilityRole="button">
          <Text style={styles.helperText}>Couldn't load your bookings. Tap to try again.</Text>
        </Pressable>
      ) : presetClosed ? (
        // The chat's delivery was delivered more than 7 days ago.
        <Text style={styles.helperText}>{DELIVERED_WINDOW_CLOSED_TEXT}</Text>
      ) : disputable.length === 0 ? (
        <Text style={styles.helperText}>
          {closedBookings.length > 0
            ? DELIVERED_WINDOW_CLOSED_TEXT
            : "No eligible bookings to dispute yet. Disputes can be raised on confirmed, in-transit, or completed deliveries."}
        </Text>
      ) : null}

      {/* Category */}
      <Text style={[styles.label, styles.labelGap]}>What happened?</Text>
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
        onBlur={() => setDescTouched(true)}
        placeholder="Describe the problem in detail…"
        multiline
        maxLength={MAX_DESCRIPTION}
        editable={!submitting}
        error={descError}
      />
      {!descError && minLengthHint(descLen, MIN_DESCRIPTION) ? (
        <Text style={[styles.counter, descLen > 0 && styles.counterWarn]}>
          {minLengthHint(descLen, MIN_DESCRIPTION)}
        </Text>
      ) : null}
      {counter ? (
        <Text
          style={[styles.counter, styles.counterRight, description.length >= MAX_DESCRIPTION && styles.counterWarn]}
          accessibilityLiveRegion="polite"
        >
          {counter}
        </Text>
      ) : null}

      {/* Evidence */}
      <Text style={[styles.label, styles.labelGap]}>Evidence (optional)</Text>
      <Text style={styles.evidenceHint}>
        {EVIDENCE_HINT}
        {evidence.length > 0 ? ` · ${evidenceCountLabel(evidence.length)}` : ""}
      </Text>
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
            accessibilityLabel="Add evidence"
          >
            <Ionicons name="camera-outline" size={22} color={colors.primary} />
            <Text style={styles.evidenceAddText}>Add evidence</Text>
          </Pressable>
        ) : null}
      </View>

      <AppButton
        label={submitting ? "Filing…" : "File dispute"}
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
          {listLoading && disputable.length === 0 ? (
            <ActivityIndicator style={styles.sheetLoading} size="small" color={colors.primary} />
          ) : disputable.length === 0 ? (
            <Text style={styles.sheetEmpty}>
              {bookingsError
                ? "Couldn't load your bookings. Close and try again."
                : closedBookings.length > 0
                  ? DELIVERED_WINDOW_CLOSED_TEXT
                  : "No eligible bookings to dispute."}
            </Text>
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
              ListFooterComponent={
                closedBookings.length > 0 ? (
                  <View style={styles.closedBlock}>
                    <Text style={styles.sheetRowMeta}>{DELIVERED_WINDOW_CLOSED_TEXT}</Text>
                    {closedBookings.map((b) => (
                      <View key={b.id} style={[styles.sheetRow, styles.sheetRowDisabled]} accessibilityState={{ disabled: true }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.sheetRowTitle} numberOfLines={1}>
                            {bookingRoute(b)}
                          </Text>
                          <Text style={styles.sheetRowMeta} numberOfLines={1}>
                            #{b.id.slice(0, 8)} · Delivered more than 7 days ago
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null
              }
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
  subtitle: { color: colors.mutedText, fontSize: 14, lineHeight: 20, marginTop: -8, marginBottom: 18 },
  bannerSlot: { marginBottom: 14 },
  label: { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: 8 },
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
  counterRight: { textAlign: "right" },
  evidenceHint: { color: colors.mutedText, fontSize: 12, lineHeight: 17, marginTop: -4, marginBottom: 8 },
  successNote: { alignSelf: "stretch", marginTop: 4 },
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
  evidenceAddText: { color: colors.primary, fontSize: 11, fontWeight: "700", textAlign: "center" },
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
  sheetLoading: { paddingVertical: 24 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  sheetRowDisabled: { opacity: 0.5 },
  closedBlock: { marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sheetRowTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  sheetRowMeta: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
});
