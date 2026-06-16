import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/AuthContext";
import { useBookingDetail } from "@/hooks/api/useBookingDetail";
import { useBookings } from "@/hooks/api/useBookings";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import {
  ApiClientError,
  bookingsApi,
  getErrorMessage,
  type Booking,
  type RNUploadFile,
} from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "BookingsTab">,
  NativeStackNavigationProp<RootStackParamList>
>;
type Route = RouteProp<MainTabParamList, "BookingsTab">;

const FILTERS: ReadonlyArray<{ label: string; status?: string }> = [
  { label: "All", status: undefined },
  { label: "Active", status: "active" },
  { label: "Completed", status: "delivered" },
  { label: "Cancelled", status: "cancelled" },
];

const STATUS_TONES: Record<string, { bg: string; fg: string }> = {
  pending_payment: { bg: "rgba(245,159,10,0.12)", fg: colors.warning },
  awaiting_handoff: { bg: primaryTint.fill12, fg: colors.primary },
  confirmed: { bg: primaryTint.fill12, fg: colors.primary },
  in_transit: { bg: "rgba(245,128,32,0.12)", fg: "#F08020" },
  delivered: { bg: "rgba(34,195,93,0.12)", fg: colors.safe },
  handoff_rejected: { bg: "rgba(220,40,40,0.12)", fg: colors.danger },
  cancelled: { bg: "rgba(220,40,40,0.12)", fg: colors.danger },
  cancelled_post_possession: { bg: "rgba(220,40,40,0.12)", fg: colors.danger },
  expired_unpaid: { bg: "rgba(120,120,120,0.12)", fg: colors.mutedText },
  disputed: { bg: "rgba(220,40,40,0.15)", fg: colors.danger },
};

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending_payment: "time-outline",
  awaiting_handoff: "hand-left-outline",
  confirmed: "checkmark-circle",
  in_transit: "car",
  delivered: "cube-outline",
  handoff_rejected: "close-circle-outline",
  cancelled: "ban",
  cancelled_post_possession: "ban",
  expired_unpaid: "hourglass-outline",
  disputed: "alert-circle",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRole(
  booking: Booking,
  userId: string | undefined,
): "sender" | "carrier" | "unknown" {
  if (!userId) return "unknown";
  if (booking.sender_id === userId) return "sender";
  if (booking.carrier_id === userId) return "carrier";
  return "unknown";
}

// ─────────────── Cancel modal ───────────────

interface CancelBookingModalProps {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

function CancelBookingModal({
  open,
  pending,
  onCancel,
  onConfirm,
}: Readonly<CancelBookingModalProps>) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  const handleClose = () => {
    if (pending) return;
    setReason("");
    onCancel();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose} />
      <View style={styles.modalCenter} pointerEvents="box-none">
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cancel Booking?</Text>
            <Pressable onPress={handleClose} hitSlop={8} disabled={pending}>
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Tell the other party why you're cancelling. This is shared with them.
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason for cancellation..."
            placeholderTextColor={colors.mutedText}
            style={styles.modalInput}
            maxLength={1000}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!pending}
            autoFocus
          />
          <View style={styles.modalFooter}>
            <Pressable
              onPress={handleClose}
              disabled={pending}
              style={[styles.modalButton, styles.modalButtonSecondary]}
              accessibilityRole="button"
              accessibilityLabel="Keep Booking"
            >
              <Text style={styles.modalButtonSecondaryText}>Keep Booking</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={pending || !reason.trim()}
              style={[
                styles.modalButton,
                styles.modalButtonDanger,
                (pending || !reason.trim()) && styles.modalButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Confirm Cancellation"
            >
              {pending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalButtonDangerText}>Confirm Cancel</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────── Reject handoff modal ───────────────

interface RejectHandoffModalProps {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, file?: RNUploadFile) => void;
}

const REJECT_REASON_MIN = 10;
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

function RejectHandoffModal({
  open,
  pending,
  onCancel,
  onConfirm,
}: Readonly<RejectHandoffModalProps>) {
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<RNUploadFile | null>(null);

  const handleClose = () => {
    if (pending) return;
    setReason("");
    setPhoto(null);
    onCancel();
  };

  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") return;
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_EVIDENCE_BYTES) return;
      setPhoto({
        uri: asset.uri,
        name: asset.fileName ?? `evidence-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      });
    } catch {
      /* ignore pick failures */
    }
  };

  const trimmed = reason.trim();
  const reasonOk = trimmed.length >= REJECT_REASON_MIN;

  const handleConfirm = () => {
    if (!reasonOk) return;
    onConfirm(trimmed, photo ?? undefined);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose} />
      <View style={styles.modalCenter} pointerEvents="box-none">
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderBubbleDanger}>
              <Ionicons name="close-circle" size={18} color={colors.danger} />
            </View>
            <Text style={styles.modalTitle}>Reject handoff?</Text>
            <Pressable onPress={handleClose} hitSlop={8} disabled={pending}>
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            The sender gets a full refund and the parcel re-opens for other carriers.
            Tell us what's wrong so we can keep records.
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={`Reason (min ${REJECT_REASON_MIN} characters)…`}
            placeholderTextColor={colors.mutedText}
            style={styles.modalInput}
            maxLength={1000}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!pending}
            autoFocus
          />
          <Text style={styles.modalHelper}>
            {trimmed.length}/{REJECT_REASON_MIN} characters minimum
          </Text>

          <Pressable
            onPress={() => void pickPhoto()}
            disabled={pending}
            style={[styles.photoPickerButton, photo && styles.photoPickerButtonSelected]}
            accessibilityRole="button"
            accessibilityLabel={photo ? "Photo selected" : "Add photo evidence"}
          >
            <Ionicons
              name={photo ? "checkmark-circle" : "camera-outline"}
              size={16}
              color={photo ? colors.safe : colors.subtleText}
            />
            <Text style={[styles.photoPickerText, photo && styles.photoPickerTextSelected]} numberOfLines={1}>
              {photo ? photo.name : "Add photo evidence (optional)"}
            </Text>
          </Pressable>

          <View style={styles.modalFooter}>
            <Pressable
              onPress={handleClose}
              disabled={pending}
              style={[styles.modalButton, styles.modalButtonSecondary]}
              accessibilityRole="button"
              accessibilityLabel="Keep handoff"
            >
              <Text style={styles.modalButtonSecondaryText}>Keep handoff</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={pending || !reasonOk}
              style={[
                styles.modalButton,
                styles.modalButtonDanger,
                (pending || !reasonOk) && styles.modalButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Reject handoff"
            >
              {pending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalButtonDangerText}>Reject handoff</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────── Cancel post-possession modal (carrier mid-trip) ───────────────

interface CancelPostPossessionModalProps {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (
    reason: string,
    answers: { will_return: boolean; was_online_order: boolean; free_return_eligible: boolean },
  ) => void;
}

interface WaiverQuestion {
  key: "online_order" | "seller_will_accept_return" | "seller_will_refund";
  label: string;
}

const WAIVER_QUESTIONS: ReadonlyArray<WaiverQuestion> = [
  {
    key: "online_order",
    label: "Was this an online order the sender placed at a merchant?",
  },
  {
    key: "seller_will_accept_return",
    label: "Will the merchant accept a return of this parcel?",
  },
  {
    key: "seller_will_refund",
    label: "Will the merchant refund the sender after the return?",
  },
];

function CancelPostPossessionModal({
  open,
  pending,
  onCancel,
  onConfirm,
}: Readonly<CancelPostPossessionModalProps>) {
  const [reason, setReason] = useState("");
  const [answers, setAnswers] = useState<Record<WaiverQuestion["key"], "yes" | "no" | null>>({
    online_order: null,
    seller_will_accept_return: null,
    seller_will_refund: null,
  });

  const handleClose = () => {
    if (pending) return;
    setReason("");
    setAnswers({
      online_order: null,
      seller_will_accept_return: null,
      seller_will_refund: null,
    });
    onCancel();
  };

  const trimmed = reason.trim();
  const reasonOk = trimmed.length >= REJECT_REASON_MIN;
  const allAnswered = WAIVER_QUESTIONS.every((q) => answers[q.key] !== null);
  const allYes = WAIVER_QUESTIONS.every((q) => answers[q.key] === "yes");

  const handleConfirm = () => {
    if (!reasonOk || !allAnswered) return;
    onConfirm(trimmed, {
      was_online_order: answers.online_order === "yes",
      free_return_eligible: answers.seller_will_accept_return === "yes",
      will_return: answers.seller_will_refund === "yes",
    });
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose} />
      <View style={styles.modalCenter} pointerEvents="box-none">
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderBubbleDanger}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
            </View>
            <Text style={styles.modalTitle}>Cancel mid-trip?</Text>
            <Pressable onPress={handleClose} hitSlop={8} disabled={pending}>
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            You've already accepted the parcel. A penalty applies (5–25%) based on how close
            you are to the delivery deadline. If this parcel is returnable to its merchant,
            the sender can waive the cash penalty.
          </Text>

          <Text style={styles.modalFieldLabel}>Why are you cancelling?</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={`Reason (min ${REJECT_REASON_MIN} characters)…`}
            placeholderTextColor={colors.mutedText}
            style={styles.modalInput}
            maxLength={1000}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!pending}
          />
          <Text style={styles.modalHelper}>
            {trimmed.length}/{REJECT_REASON_MIN} characters minimum
          </Text>

          <Text style={[styles.modalFieldLabel, { marginTop: 12 }]}>
            Return-eligibility check
          </Text>
          <View style={styles.waiverList}>
            {WAIVER_QUESTIONS.map((q) => {
              const current = answers[q.key];
              return (
                <View key={q.key} style={styles.waiverRow}>
                  <Text style={styles.waiverLabel}>{q.label}</Text>
                  <View style={styles.waiverChoices}>
                    {(["yes", "no"] as const).map((choice) => {
                      const selected = current === choice;
                      const isYes = choice === "yes";
                      return (
                        <Pressable
                          key={choice}
                          onPress={() =>
                            setAnswers((prev) => ({ ...prev, [q.key]: choice }))
                          }
                          disabled={pending}
                          style={[
                            styles.waiverChoice,
                            selected &&
                              (isYes ? styles.waiverChoiceYes : styles.waiverChoiceNo),
                          ]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                        >
                          <Text
                            style={[
                              styles.waiverChoiceText,
                              selected &&
                                (isYes
                                  ? styles.waiverChoiceTextYes
                                  : styles.waiverChoiceTextNo),
                            ]}
                          >
                            {isYes ? "Yes" : "No"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          {allAnswered ? (
            <View style={allYes ? styles.waiverHintGood : styles.waiverHintNeutral}>
              <Ionicons
                name={allYes ? "shield-checkmark" : "information-circle-outline"}
                size={14}
                color={allYes ? colors.safe : colors.mutedText}
              />
              <Text
                style={[
                  styles.waiverHintText,
                  allYes && { color: colors.safe },
                ]}
              >
                {allYes
                  ? "The sender can waive the cash penalty after reviewing — strike still applies."
                  : "A cash penalty will be deducted from your wallet."}
              </Text>
            </View>
          ) : null}

          <View style={styles.modalFooter}>
            <Pressable
              onPress={handleClose}
              disabled={pending}
              style={[styles.modalButton, styles.modalButtonSecondary]}
              accessibilityRole="button"
              accessibilityLabel="Don't cancel"
            >
              <Text style={styles.modalButtonSecondaryText}>Don't cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={pending || !reasonOk || !allAnswered}
              style={[
                styles.modalButton,
                styles.modalButtonDanger,
                (pending || !reasonOk || !allAnswered) && styles.modalButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancel mid-trip"
            >
              {pending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalButtonDangerText}>Cancel mid-trip</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────── Expanded section (mirrors web's expanded card body) ───────────────

interface ExpandedBodyProps {
  bookingId: string;
  role: "sender" | "carrier" | "unknown";
  onNavigateRate: (bookingId: string) => void;
  onNavigatePay: (bookingId: string) => void;
}

function ExpandedBody({
  bookingId,
  role,
  onNavigateRate,
  onNavigatePay,
}: Readonly<ExpandedBodyProps>) {
  // Detail fetch only fires when this row is expanded — so the list remains
  // light. Mirrors web's TanStack `useBookingDetail` enabled-on-mount of the
  // expanded card.
  const { booking, timeline, error, refetch } = useBookingDetail(bookingId);

  const [actionPending, setActionPending] = useState<
    | null
    | "accept-handoff"
    | "reject-handoff"
    | "cancel"
    | "cancel-post-possession"
    | "generate-otp"
    | "confirm-otp"
  >(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rejectHandoffOpen, setRejectHandoffOpen] = useState(false);
  const [cancelPostPossessionOpen, setCancelPostPossessionOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  // The server returns the plaintext OTP exactly once on generate-otp; if we
  // drop it here the sender can never see it again. Keep it in screen state.
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);

  // Inline action feedback — matches the rest of the app (see SendParcelScreen)
  // by rendering `FormBanner` at the top of the affected card instead of toasts.
  type BannerVariant = "success" | "error" | "info" | "warning";
  const [actionBanner, setActionBanner] = useState<
    { variant: BannerVariant; title?: string; message?: string } | null
  >(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setActionBanner(null);
  }, []);

  const showBanner = useCallback(
    (next: { variant: BannerVariant; title?: string; message?: string }, autoDismissMs = 4000) => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      setActionBanner(next);
      if (autoDismissMs > 0) {
        bannerTimerRef.current = setTimeout(() => {
          setActionBanner(null);
          bannerTimerRef.current = null;
        }, autoDismissMs);
      }
    },
    [],
  );

  useEffect(
    () => () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    },
    [],
  );

  const runAction = useCallback(
    async <T,>(
      key:
        | "accept-handoff"
        | "reject-handoff"
        | "cancel"
        | "cancel-post-possession"
        | "generate-otp"
        | "confirm-otp",
      task: () => Promise<T>,
      successMessage: string,
      /** Optional per-action mapper for friendlier copy on specific error codes. */
      formatError?: (code: string, message: string) => string,
    ): Promise<T | null> => {
      setActionPending(key);
      try {
        const result = await task();
        await refetch();
        showBanner({ variant: "success", title: successMessage });
        return result;
      } catch (err) {
        const code = err instanceof ApiClientError ? err.code : "";
        const base =
          err instanceof ApiClientError ? err.message : getErrorMessage(err as Error);
        const message = formatError ? formatError(code, base) : base;
        showBanner({ variant: "error", title: "Action failed", message }, 6000);
        // The guard may have rejected because the state moved — re-derive actions.
        void refetch();
        return null;
      } finally {
        setActionPending(null);
      }
    },
    [refetch, showBanner],
  );

  if (!booking && !error) {
    return (
      <View style={styles.expandedLoading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={styles.expandedError}>
        <Text style={styles.expandedErrorText}>
          {error ? getErrorMessage(error) : "Booking unavailable"}
        </Text>
      </View>
    );
  }

  const handleAcceptHandoff = () =>
    void runAction(
      "accept-handoff",
      () => bookingsApi.acceptHandoff(booking.id),
      "Parcel accepted — trip started",
    );

  const handleRejectHandoffConfirm = async (reason: string, file?: RNUploadFile) => {
    const result = await runAction(
      "reject-handoff",
      async () => {
        // Upload evidence first (if attached), then pass its path on reject.
        let photo_path: string | undefined;
        if (file) {
          const up = await bookingsApi.uploadHandoffEvidence(booking.id, file);
          photo_path = up.path;
        }
        return bookingsApi.rejectHandoff(booking.id, { reason, photo_path });
      },
      "Handoff rejected — sender refunded",
    );
    if (result) setRejectHandoffOpen(false);
  };

  const handleCancelConfirm = async (reason: string) => {
    const result = await runAction(
      "cancel",
      () => bookingsApi.cancel(booking.id, reason),
      "Booking cancelled",
    );
    if (result) setCancelOpen(false);
  };

  const handleCancelPostPossessionConfirm = async (
    reason: string,
    answers: { will_return: boolean; was_online_order: boolean; free_return_eligible: boolean },
  ) => {
    const result = await runAction(
      "cancel-post-possession",
      () => bookingsApi.cancelPostPossession(booking.id, { reason, return_answers: answers }),
      "Cancelled mid-trip",
      (code, base) => {
        if (code === "RETURN_ADDRESS_REQUIRED")
          return "The sender has no return address on file — a returnable cancellation needs one first.";
        if (code === "STRIKE_LIMIT_REACHED")
          return "You’ve hit the cancellation strike limit and can’t cancel mid-trip.";
        return base;
      },
    );
    if (!result) return;
    setCancelPostPossessionOpen(false);
    // Tier/penalty are server-driven — surface whatever the response reports.
    const data = result.data;
    if (data?.waiver_eligible) {
      showBanner(
        {
          variant: "info",
          title: "Return waiver opened",
          message: "The sender can waive the cash penalty — your strike still applies.",
        },
        7000,
      );
    } else if (typeof data?.penalty_amount === "number") {
      showBanner(
        {
          variant: "warning",
          title: `Penalty applied: $${data.penalty_amount}`,
          message: `Tier: ${data.tier}. The sender has been refunded in full.`,
        },
        7000,
      );
    }
  };

  const handleGenerateOtp = async () => {
    const result = await runAction(
      "generate-otp",
      () => bookingsApi.generateOtp(booking.id),
      "Delivery code generated",
    );
    const otp = result?.data?.otp;
    if (otp) setGeneratedOtp(otp);
  };

  const handleCopyOtp = async () => {
    if (!generatedOtp) return;
    await Clipboard.setStringAsync(generatedOtp);
    showBanner({ variant: "success", title: "Code copied to clipboard" }, 2400);
  };

  const handleConfirmOtp = async () => {
    const trimmed = otpCode.trim();
    if (trimmed.length === 0) return;
    const result = await runAction(
      "confirm-otp",
      () => bookingsApi.confirmOtp(booking.id, trimmed),
      "Delivery confirmed",
      (code, base) => {
        if (code === "RATE_LIMITED")
          return "Too many wrong codes. Ask the sender to tap Resend for a fresh code.";
        if (code === "UNAUTHENTICATED")
          return "That delivery code has expired. Ask the sender to resend a new one.";
        if (code === "CONFLICT")
          return "No delivery code has been generated yet. Ask the sender to generate one.";
        return base;
      },
    );
    if (result) setOtpCode("");
  };

  // Action gates — mirror web `CustomerBookings.tsx` expanded-card rules.
  // `confirmed` is kept for back-compat with bookings the server still labels
  // that way; `awaiting_handoff` is the new post-payment status.
  const isAwaitingHandoff =
    booking.status === "awaiting_handoff" || booking.status === "confirmed";
  const canPay = booking.status === "pending_payment" && role === "sender";
  const canCancel = booking.status === "pending_payment" || isAwaitingHandoff;
  const canAcceptHandoff = isAwaitingHandoff && role === "carrier";
  const canRejectHandoff = canAcceptHandoff;
  // Sender may pre-generate the delivery code from awaiting_handoff onward.
  const canGenerateOtp =
    (booking.status === "in_transit" || isAwaitingHandoff) && role === "sender";
  const canConfirmOtp = booking.status === "in_transit" && role === "carrier";
  const canCancelPostPossession = booking.status === "in_transit" && role === "carrier";
  const canRate = booking.status === "delivered";

  return (
    <View style={styles.expandedRoot}>
      {actionBanner ? (
        <FormBanner
          variant={actionBanner.variant}
          title={actionBanner.title ?? null}
          message={actionBanner.message ?? null}
          onDismiss={dismissBanner}
        />
      ) : null}

      {/* Parcel details */}
      {booking.parcel ? (
        <View style={styles.expandedSection}>
          <Text style={styles.expandedLabel}>Parcel Details</Text>
          <View style={styles.parcelGrid}>
            <View style={styles.parcelCell}>
              <Text style={styles.parcelCellKey}>Category: </Text>
              <Text style={styles.parcelCellValue}>{booking.parcel.category}</Text>
            </View>
            <View style={styles.parcelCell}>
              <Text style={styles.parcelCellKey}>Fee: </Text>
              <Text style={[styles.parcelCellValue, { color: colors.primary }]}>
                ${booking.parcel.fee_offered}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Sender / Carrier */}
      {(booking.sender || booking.carrier) ? (
        <View style={styles.partiesRow}>
          {booking.sender ? (
            <View style={styles.partyItem}>
              <View style={[styles.partyAvatar, { backgroundColor: primaryTint.fill12 }]}>
                <Text style={[styles.partyAvatarText, { color: colors.primary }]}>
                  {booking.sender.name?.charAt(0)?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={{ minWidth: 0, flex: 1 }}>
                <Text style={styles.partyKey}>Sender</Text>
                <Text style={styles.partyValue} numberOfLines={2}>
                  {booking.sender.name}
                </Text>
              </View>
            </View>
          ) : null}
          {booking.carrier ? (
            <View style={styles.partyItem}>
              <View style={[styles.partyAvatar, { backgroundColor: "rgba(245,128,32,0.12)" }]}>
                <Text style={[styles.partyAvatarText, { color: "#F08020" }]}>
                  {booking.carrier.name?.charAt(0)?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={{ minWidth: 0, flex: 1 }}>
                <Text style={styles.partyKey}>Carrier</Text>
                <Text style={styles.partyValue} numberOfLines={2}>
                  {booking.carrier.name}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Timeline */}
      {timeline && timeline.length > 0 ? (
        <View style={styles.expandedSection}>
          <Text style={styles.expandedLabel}>Timeline</Text>
          {timeline.map((e, idx) => (
            <View key={`${e.event}-${e.created_at}-${idx}`} style={styles.timelineRow}>
              <View style={styles.timelineDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineEvent}>
                  <Text style={styles.timelineEventName}>{e.event.replace(/_/g, " ")}</Text>
                  {e.description ? (
                    <Text style={styles.timelineEventDesc}> - {e.description}</Text>
                  ) : null}
                </Text>
                <Text style={styles.timelineDate}>{formatDateTime(e.created_at)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Action buttons */}
      <View style={styles.actionsWrap}>
        {canPay ? (
          <Pressable
            style={[styles.actionButton, styles.actionPrimary, styles.fullWidthAction]}
            onPress={() => onNavigatePay(booking.id)}
            accessibilityRole="button"
            accessibilityLabel="Pay now"
          >
            <Ionicons name="card" size={14} color={colors.white} />
            <Text style={styles.actionPrimaryText}>Pay now · ${booking.parcel?.fee_offered ?? ""}</Text>
          </Pressable>
        ) : null}

        {canAcceptHandoff ? (
          <Pressable
            style={[styles.actionButton, styles.actionPrimary]}
            onPress={handleAcceptHandoff}
            disabled={actionPending !== null}
            accessibilityRole="button"
            accessibilityLabel="Accept Handoff"
          >
            {actionPending === "accept-handoff" ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={14} color={colors.white} />
                <Text style={styles.actionPrimaryText}>Accept Handoff</Text>
              </>
            )}
          </Pressable>
        ) : null}

        {canRejectHandoff ? (
          <Pressable
            style={[styles.actionButton, styles.actionDanger]}
            onPress={() => setRejectHandoffOpen(true)}
            disabled={actionPending !== null}
            accessibilityRole="button"
            accessibilityLabel="Reject Handoff"
          >
            <Ionicons name="close-circle" size={14} color={colors.danger} />
            <Text style={styles.actionDangerText}>Reject Handoff</Text>
          </Pressable>
        ) : null}

        {canCancel && !canAcceptHandoff ? (
          <Pressable
            style={[styles.actionButton, styles.actionDanger]}
            onPress={() => setCancelOpen(true)}
            disabled={actionPending !== null}
            accessibilityRole="button"
            accessibilityLabel="Cancel Booking"
          >
            <Ionicons name="ban" size={14} color={colors.danger} />
            <Text style={styles.actionDangerText}>Cancel Booking</Text>
          </Pressable>
        ) : null}

        {canGenerateOtp ? (
          <View style={styles.fullWidthAction}>
            {generatedOtp ? (
              <View style={styles.otpDisplayCard}>
                <View style={styles.otpDisplayHeader}>
                  <Ionicons name="key" size={14} color={colors.safe} />
                  <Text style={styles.otpDisplayHeaderText}>Your delivery code</Text>
                </View>
                <Text style={styles.otpDisplayCode} accessibilityLabel="Delivery code">
                  {generatedOtp}
                </Text>
                <Text style={styles.otpDisplayHint}>
                  Share this code with the carrier in person at handoff. It expires in 30 min.
                </Text>
                <View style={styles.otpDisplayActions}>
                  <Pressable
                    onPress={handleCopyOtp}
                    style={[styles.actionButton, styles.actionSafe, styles.otpDisplayBtn]}
                    accessibilityRole="button"
                    accessibilityLabel="Copy delivery code"
                  >
                    <Ionicons name="copy-outline" size={14} color={colors.safe} />
                    <Text style={styles.actionSafeText}>Copy code</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleGenerateOtp}
                    disabled={actionPending !== null}
                    style={[styles.actionButton, styles.actionGhost, styles.otpDisplayBtn]}
                    accessibilityRole="button"
                    accessibilityLabel="Generate a new code"
                  >
                    {actionPending === "generate-otp" ? (
                      <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                      <>
                        <Ionicons name="refresh-outline" size={14} color={colors.text} />
                        <Text style={styles.actionGhostText}>Resend</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                style={[styles.actionButton, styles.actionSafe]}
                onPress={handleGenerateOtp}
                disabled={actionPending !== null}
                accessibilityRole="button"
                accessibilityLabel="Generate Delivery Code"
              >
                {actionPending === "generate-otp" ? (
                  <ActivityIndicator size="small" color={colors.safe} />
                ) : (
                  <>
                    <Ionicons name="key-outline" size={14} color={colors.safe} />
                    <Text style={styles.actionSafeText}>Generate Delivery Code</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        ) : null}

        {canConfirmOtp ? (
          <View style={styles.otpRow}>
            <TextInput
              value={otpCode}
              onChangeText={setOtpCode}
              placeholder="Enter delivery code…"
              placeholderTextColor={colors.mutedText}
              style={styles.otpInput}
              keyboardType="number-pad"
              maxLength={6}
              accessibilityLabel="Delivery code"
            />
            <Pressable
              onPress={handleConfirmOtp}
              disabled={actionPending !== null || otpCode.trim().length === 0}
              style={[
                styles.otpConfirmButton,
                (actionPending !== null || otpCode.trim().length === 0) && styles.actionDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Confirm Delivery"
            >
              {actionPending === "confirm-otp" ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={14} color={colors.white} />
                  <Text style={styles.otpConfirmText}>Confirm Delivery</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        {canCancelPostPossession ? (
          <Pressable
            style={[styles.actionButton, styles.actionDanger, styles.fullWidthAction]}
            onPress={() => setCancelPostPossessionOpen(true)}
            disabled={actionPending !== null}
            accessibilityRole="button"
            accessibilityLabel="Cancel mid-trip"
          >
            <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
            <Text style={styles.actionDangerText}>Cancel mid-trip</Text>
          </Pressable>
        ) : null}

        {canRate ? (
          <Pressable
            style={[styles.actionButton, styles.actionWarning]}
            onPress={() => onNavigateRate(booking.id)}
            accessibilityRole="button"
            accessibilityLabel="Rate Delivery"
          >
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={styles.actionWarningText}>Rate Delivery</Text>
          </Pressable>
        ) : null}
      </View>

      <CancelBookingModal
        open={cancelOpen}
        pending={actionPending === "cancel"}
        onCancel={() => setCancelOpen(false)}
        onConfirm={handleCancelConfirm}
      />

      <RejectHandoffModal
        open={rejectHandoffOpen}
        pending={actionPending === "reject-handoff"}
        onCancel={() => setRejectHandoffOpen(false)}
        onConfirm={handleRejectHandoffConfirm}
      />

      <CancelPostPossessionModal
        open={cancelPostPossessionOpen}
        pending={actionPending === "cancel-post-possession"}
        onCancel={() => setCancelPostPossessionOpen(false)}
        onConfirm={handleCancelPostPossessionConfirm}
      />
    </View>
  );
}

// ─────────────── Booking row (collapsed + expanded) ───────────────

interface BookingRowProps {
  booking: Booking;
  role: "sender" | "carrier" | "unknown";
  expanded: boolean;
  onToggle: () => void;
  onNavigateRate: (bookingId: string) => void;
  onNavigatePay: (bookingId: string) => void;
}

function BookingRow({
  booking,
  role,
  expanded,
  onToggle,
  onNavigateRate,
  onNavigatePay,
}: Readonly<BookingRowProps>) {
  const tone = STATUS_TONES[booking.status] ?? { bg: "#E5E7EB", fg: colors.subtleText };
  const icon = STATUS_ICONS[booking.status] ?? "ellipse";
  const roleColor = role === "sender" ? colors.primary : "#F08020";

  return (
    <Card style={styles.bookingCard}>
      <Pressable
        onPress={onToggle}
        style={styles.cardSummary}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? "Collapse" : "Expand"} booking ${booking.id}`}
        accessibilityState={{ expanded }}
      >
        {/* Header: route headline + chevron */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderMain}>
            <Text style={styles.routeText} numberOfLines={2}>
              {booking.parcel
                ? `${booking.parcel.from_city}  →  ${booking.parcel.to_city}`
                : "Booking"}
            </Text>
            <View style={styles.subRow}>
              {role !== "unknown" ? (
                <>
                  <Ionicons
                    name={role === "sender" ? "person" : "car"}
                    size={12}
                    color={roleColor}
                  />
                  <Text style={[styles.roleText, { color: roleColor }]}>
                    {role === "sender" ? "Sender" : "Carrier"}
                  </Text>
                  <Text style={styles.subDot}>·</Text>
                </>
              ) : null}
              <Ionicons name="calendar-outline" size={12} color={colors.subtleText} />
              <Text style={styles.metaText} numberOfLines={1}>
                {formatDate(booking.created_at)}
              </Text>
              <Text style={styles.subDot}>·</Text>
              <Text style={styles.bookingId} numberOfLines={1}>
                #{booking.id.slice(0, 6)}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.mutedText}
          />
        </View>

        {/* Footer: status + fee */}
        <View style={styles.cardFooter}>
          <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
            <Ionicons name={icon} size={11} color={tone.fg} />
            <Text style={[styles.statusBadgeText, { color: tone.fg }]} numberOfLines={1}>
              {booking.status.replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>
          {booking.parcel ? (
            <Text style={styles.feeText}>${booking.parcel.fee_offered}</Text>
          ) : null}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.expandedDivider}>
          <ExpandedBody
            bookingId={booking.id}
            role={role}
            onNavigateRate={onNavigateRate}
            onNavigatePay={onNavigatePay}
          />
        </View>
      ) : null}
    </Card>
  );
}

// ─────────────── Screen ───────────────

export function BookingsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user } = useAuth();
  const userId = user?.id;

  const [filterIdx, setFilterIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const status = FILTERS[filterIdx]?.status;
  const { bookings, loading, error, refetch } = useBookings({ status });

  // Auto-expand if a notification deep-link or other navigator passed `expandId`.
  // Mirrors web's `/customer/bookings` page where deep-links land on the list
  // and the user finds their booking in the list.
  useEffect(() => {
    const expandId = route.params?.expandId;
    if (expandId && bookings.some((b) => b.id === expandId)) {
      setExpandedId(expandId);
    }
  }, [route.params?.expandId, bookings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        b.parcel?.from_city?.toLowerCase().includes(q) ||
        b.parcel?.to_city?.toLowerCase().includes(q),
    );
  }, [bookings, search]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  const handleToggle = useCallback(
    (id: string) => setExpandedId((prev) => (prev === id ? null : id)),
    [],
  );

  const handleNavigateRate = useCallback(
    (id: string) => navigation.navigate("DeliveryReviewTab", { bookingId: id }),
    [navigation],
  );

  const handleNavigatePay = useCallback(
    (id: string) => navigation.navigate("PayBookingTab", { bookingId: id }),
    [navigation],
  );

  return (
    <Screen onRefresh={refetch}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>My Bookings</Text>
          <Text style={styles.subtitle}>Manage your delivery bookings</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.subtleText} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by city, booking ID..."
          placeholderTextColor={colors.subtleText}
          style={styles.searchInput}
          accessibilityLabel="Search bookings"
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f, i) => {
          const active = i === filterIdx;
          return (
            <Pressable
              key={f.label}
              onPress={() => {
                setFilterIdx(i);
                setExpandedId(null);
              }}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter: ${f.label}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Body */}
      {loading && bookings.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading bookings…</Text>
        </View>
      ) : error && bookings.length === 0 ? (
        <Card style={styles.errorCard}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
          <Text style={styles.errorTitle}>Failed to load bookings</Text>
          <Text style={styles.errorBody}>
            {error instanceof Error ? error.message : "Unknown error"}
          </Text>
          <Pressable
            onPress={() => void refetch()}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </Card>
      ) : filtered.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="cube-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySubtitle}>
            {filterIdx > 0
              ? "Try a different filter."
              : "Browse parcels or trips to create your first booking."}
          </Text>
        </Card>
      ) : (
        <View>
          {filtered.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              role={getRole(booking, userId)}
              expanded={expandedId === booking.id}
              onToggle={() => handleToggle(booking.id)}
              onNavigateRate={handleNavigateRate}
              onNavigatePay={handleNavigatePay}
            />
          ))}
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
    marginBottom: 14,
    gap: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { flex: 1 },
  title: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 13, marginTop: 2, fontWeight: "500" },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
    padding: 0,
  },

  // Filter chips
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.mutedText, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.white },

  // Cards
  bookingCard: { borderRadius: 16, marginBottom: 12, overflow: "hidden" },
  cardSummary: { padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardHeaderMain: { flex: 1, minWidth: 0, gap: 5 },
  routeText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
    rowGap: 2,
  },
  bookingId: { color: colors.subtleText, fontSize: 12, fontWeight: "700", flexShrink: 1 },
  subDot: { color: colors.subtleText, fontSize: 12, fontWeight: "700" },
  roleText: { fontSize: 12, fontWeight: "800" },
  metaText: { color: colors.subtleText, fontSize: 12, fontWeight: "500" },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 1,
    minWidth: 0,
  },
  statusBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, flexShrink: 1 },
  feeText: { color: colors.primary, fontSize: 16, fontWeight: "800" },

  // Expanded body
  expandedDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  expandedRoot: { gap: 14 },
  expandedSection: { gap: 6 },
  expandedLabel: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  expandedLoading: { paddingVertical: 12, alignItems: "center" },
  expandedError: { paddingVertical: 12, alignItems: "center" },
  expandedErrorText: { color: colors.danger, fontSize: 13, fontWeight: "600" },

  parcelGrid: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  parcelCell: { flex: 1, minWidth: 140, flexDirection: "row" },
  parcelCellKey: { color: colors.mutedText, fontSize: 13 },
  parcelCellValue: { color: colors.text, fontSize: 13, fontWeight: "700" },

  partiesRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  partyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 140,
  },
  partyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  partyAvatarText: { fontSize: 13, fontWeight: "800" },
  partyKey: { color: colors.subtleText, fontSize: 11, fontWeight: "600" },
  partyValue: { color: colors.text, fontSize: 13, fontWeight: "700" },

  // Timeline
  timelineRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  timelineEvent: { color: colors.text, fontSize: 12, lineHeight: 16 },
  timelineEventName: { color: colors.text, fontWeight: "700", textTransform: "capitalize" },
  timelineEventDesc: { color: colors.mutedText },
  timelineDate: { color: colors.subtleText, fontSize: 11, marginTop: 2 },

  // Actions
  actionsWrap: { gap: 8, flexDirection: "row", flexWrap: "wrap" },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  actionDanger: { backgroundColor: "rgba(220,40,40,0.10)" },
  actionDangerText: { color: colors.danger, fontSize: 13, fontWeight: "800" },
  actionSafe: { backgroundColor: "rgba(34,195,93,0.12)" },
  actionSafeText: { color: colors.safe, fontSize: 13, fontWeight: "800" },
  actionWarning: { backgroundColor: "rgba(245,159,10,0.12)" },
  actionWarningText: { color: colors.warning, fontSize: 13, fontWeight: "800" },
  actionGhost: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionGhostText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  actionDisabled: { opacity: 0.5 },
  fullWidthAction: { width: "100%" },
  helperText: { color: colors.safe, fontSize: 12, fontWeight: "500", marginTop: 6 },

  // OTP display card — sacred per the implementation guide: the plaintext
  // code is returned by the server exactly once, so we surface it big and
  // copyable until the screen unmounts.
  otpDisplayCard: {
    backgroundColor: "rgba(34,195,93,0.08)",
    borderWidth: 1,
    borderColor: "rgba(34,195,93,0.30)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
    width: "100%",
  },
  otpDisplayHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  otpDisplayHeaderText: {
    color: colors.safe,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  otpDisplayCode: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 8,
    fontFamily: "Courier",
    textAlign: "center",
    paddingVertical: 6,
  },
  otpDisplayHint: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  otpDisplayActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  otpDisplayBtn: { flex: 1 },

  // OTP entry
  otpRow: { flexDirection: "row", gap: 8, width: "100%" },
  otpInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 4,
    fontFamily: "Courier",
  },
  otpConfirmButton: {
    backgroundColor: colors.safe,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  otpConfirmText: { color: colors.white, fontSize: 13, fontWeight: "800" },

  // Modal
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,25,0.4)",
  },
  modalCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalHeaderBubbleDanger: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(220,40,40,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 },
  modalBody: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  modalFieldLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 4,
  },
  modalHelper: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
  },

  photoPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  photoPickerButtonSelected: {
    backgroundColor: "rgba(34,195,93,0.08)",
    borderColor: "rgba(34,195,93,0.40)",
    borderStyle: "solid",
  },
  photoPickerText: { color: colors.subtleText, fontSize: 13, fontWeight: "700" },
  photoPickerTextSelected: { color: colors.safe },

  waiverList: { gap: 10 },
  waiverRow: { gap: 6 },
  waiverLabel: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  waiverChoices: { flexDirection: "row", gap: 8 },
  waiverChoice: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: "transparent",
  },
  waiverChoiceYes: {
    backgroundColor: "rgba(34,195,93,0.10)",
    borderColor: "rgba(34,195,93,0.35)",
  },
  waiverChoiceNo: {
    backgroundColor: "rgba(220,40,40,0.08)",
    borderColor: "rgba(220,40,40,0.32)",
  },
  waiverChoiceText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  waiverChoiceTextYes: { color: colors.safe },
  waiverChoiceTextNo: { color: colors.danger },
  waiverHintGood: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34,195,93,0.08)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  waiverHintNeutral: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  waiverHintText: { color: colors.mutedText, fontSize: 12, fontWeight: "600", flex: 1 },
  modalInput: {
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "500",
    minHeight: 80,
  },
  modalFooter: { flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 4 },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    minWidth: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonSecondary: { backgroundColor: colors.surfaceMuted },
  modalButtonSecondaryText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  modalButtonDanger: { backgroundColor: colors.danger },
  modalButtonDangerText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  modalButtonDisabled: { opacity: 0.5 },

  // States
  loadingWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 64, gap: 12 },
  loadingText: { color: colors.mutedText, fontSize: 13, fontWeight: "500" },
  errorCard: { borderRadius: 16, alignItems: "center", paddingVertical: 24, paddingHorizontal: 18 },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 8 },
  errorBody: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
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
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 4 },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 300,
  },
});
