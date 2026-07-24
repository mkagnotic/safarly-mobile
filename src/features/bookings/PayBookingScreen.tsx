import { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { DetailSkeleton } from "@/components/ui/Skeletons";
import { useAuth } from "@/context/AuthContext";
import { feeBreakdown, formatCountdown, isUrgent } from "@/features/bookings/paymentMath";
import { useBookingDetail } from "@/hooks/api/useBookingDetail";
import { useKycGate } from "@/hooks/api/useKycGate";
import { usePayBooking } from "@/hooks/api/usePayBooking";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { ApiClientError, getErrorMessage } from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "PayBookingTab">,
  NativeStackNavigationProp<RootStackParamList>
>;
type Route = RouteProp<MainTabParamList, "PayBookingTab">;

const money = (n: number) => `$${n.toFixed(2)}`;

export function PayBookingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user } = useAuth();
  const bookingId = route.params?.bookingId;

  const { booking, loading, error, refetch } = useBookingDetail(bookingId);
  const kyc = useKycGate();
  const { phase, error: payError, cancelled, pay } = usePayBooking(bookingId);

  const [banner, setBanner] = useState<
    { variant: "error" | "warning" | "info"; title: string; message?: string } | null
  >(null);
  const [showKycPrompt, setShowKycPrompt] = useState(false);
  const [nowTs, setNowTs] = useState(() => 0);

  // Tick the expiry countdown every 30s (never call Date.now() during render).
  useEffect(() => {
    setNowTs(Date.now());
    const t = setInterval(() => setNowTs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const { fee, platformFee, total } = feeBreakdown(booking?.parcel?.fee_offered);

  const isSender = !!booking && booking.sender_id === user?.id;
  const isPayable = booking?.status === "pending_payment";
  const paying = phase === "paying";

  const expiresAt = booking?.payment_expires_at
    ? new Date(booking.payment_expires_at).getTime()
    : null;
  const msLeft = expiresAt != null && nowTs > 0 ? expiresAt - nowTs : null;
  const expired =
    booking?.status === "expired_unpaid" || (msLeft != null && msLeft <= 0);
  const urgent = msLeft != null && isUrgent(msLeft);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("BookingsTab", undefined);
  }, [navigation]);

  const goKyc = useCallback(() => {
    setShowKycPrompt(false);
    navigation.navigate("KycVerificationTab");
  }, [navigation]);

  // Map payment errors to inline banners / KYC routing.
  useEffect(() => {
    if (!payError) return;
    const code = payError instanceof ApiClientError ? payError.code : "";
    if (code === "KYC_REQUIRED") {
      void kyc.refetch();
      setShowKycPrompt(true);
    } else if (code === "PAYMENT_EXPIRED") {
      setBanner({ variant: "error", title: "Payment window expired", message: "This booking can no longer be paid." });
      void refetch();
    } else if (code === "SUSPENDED") {
      setBanner({ variant: "error", title: "Account suspended", message: payError.message });
    } else if (code === "CONFLICT") {
      // Multi-bidder race: the charge went through but another carrier was booked
      // (or the trip filled) first, so it was auto-refunded. Surface the server's
      // message and refresh — the booking is now cancelled.
      setBanner({ variant: "warning", title: "Refunded — carrier no longer available", message: payError.message });
      void refetch();
    } else if (code === "PAYMENT_FAILED") {
      setBanner({ variant: "error", title: "Payment declined", message: payError.message || "Your bank declined the charge. Try again." });
    } else {
      setBanner({ variant: "error", title: "Payment failed", message: getErrorMessage(payError) });
    }
  }, [payError, kyc, refetch]);

  // The user closed Stripe before finishing — a soft "not completed" prompt.
  useEffect(() => {
    if (!cancelled) return;
    setBanner({
      variant: "info",
      title: "Payment not completed",
      message: "You closed the checkout before finishing. Your booking is still awaiting payment.",
    });
  }, [cancelled]);

  // After a successful confirm, land on the booking (now awaiting_handoff).
  useEffect(() => {
    if (phase !== "succeeded") return;
    const t = setTimeout(() => navigation.navigate("BookingsTab", { expandId: bookingId }), 2000);
    return () => clearTimeout(t);
  }, [phase, navigation, bookingId]);

  const handlePay = useCallback(async () => {
    setBanner(null);
    if (!kyc.isApproved) {
      setShowKycPrompt(true);
      return;
    }
    await pay();
  }, [kyc.isApproved, pay]);

  const headerTitle = useMemo(() => "Secure payment", []);

  // ───────── Render branches ─────────

  if (phase === "succeeded") {
    return (
      <Screen scroll={false}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="shield-checkmark" size={44} color={colors.safe} />
          </View>
          <Text style={styles.successTitle}>Payment secured 🎉</Text>
          <Text style={styles.successBody}>
            {money(total)} is held safely in escrow. The funds release automatically to the
            carrier once you confirm delivery.
          </Text>
          <ActivityIndicator color={colors.primary} style={{ marginTop: 18 }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{headerTitle}</Text>
      </View>

      {loading && !booking ? (
        <DetailSkeleton />
      ) : error || !booking ? (
        <Card style={styles.panel}>
          <Ionicons name="receipt-outline" size={34} color={colors.mutedText} />
          <Text style={styles.panelTitle}>Booking not found</Text>
          <Text style={styles.panelBody}>{error ? getErrorMessage(error) : "We couldn't load this booking."}</Text>
          <AppButton label="Back to bookings" onPress={goBack} style={styles.panelButton} />
        </Card>
      ) : !isSender ? (
        <Card style={styles.panel}>
          <Ionicons name="lock-closed-outline" size={34} color={colors.mutedText} />
          <Text style={styles.panelTitle}>Only the sender can pay</Text>
          <Text style={styles.panelBody}>This booking is paid by the parcel sender.</Text>
          <AppButton label="Go back" onPress={goBack} style={styles.panelButton} />
        </Card>
      ) : expired ? (
        <Card style={styles.panel}>
          <Ionicons name="time-outline" size={34} color={colors.danger} />
          <Text style={styles.panelTitle}>Payment window expired</Text>
          <Text style={styles.panelBody}>
            This booking wasn’t paid in time and can no longer be confirmed.
          </Text>
          <AppButton label="Back to bookings" onPress={goBack} style={styles.panelButton} />
        </Card>
      ) : !isPayable ? (
        <Card style={styles.panel}>
          <Ionicons name="information-circle-outline" size={34} color={colors.mutedText} />
          <Text style={styles.panelTitle}>This booking can’t be paid right now</Text>
          <Text style={styles.panelBody}>Current status: {booking.status.replace(/_/g, " ")}.</Text>
          <AppButton label="Back to bookings" onPress={goBack} style={styles.panelButton} />
        </Card>
      ) : (
        <>
          {banner ? (
            <View style={{ marginBottom: 14 }}>
              <FormBanner
                variant={banner.variant}
                title={banner.title}
                message={banner.message}
                onDismiss={() => setBanner(null)}
              />
            </View>
          ) : null}

          {/* Expiry countdown */}
          {msLeft != null ? (
            <View style={[styles.countdown, urgent && styles.countdownUrgent]}>
              <Ionicons name="time-outline" size={14} color={urgent ? colors.danger : colors.warning} />
              <Text style={[styles.countdownText, urgent && { color: colors.danger }]}>
                {formatCountdown(msLeft)}
              </Text>
            </View>
          ) : null}

          {/* Parcel summary */}
          <Card style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="cube-outline" size={15} color={colors.primary} />
              <Text style={styles.sectionTitle}>Delivery</Text>
            </View>
            <Row
              label="Route"
              value={`${booking.parcel?.from_city ?? "—"} → ${booking.parcel?.to_city ?? "—"}`}
            />
            {booking.parcel?.category ? <Row label="Category" value={booking.parcel.category} /> : null}
          </Card>

          {/* Fee breakdown */}
          <Card style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="cash-outline" size={15} color={colors.primary} />
              <Text style={styles.sectionTitle}>Payment</Text>
            </View>
            <Row label="Carrier fee" value={money(fee)} strong />
            <Row label="Platform fee (10%)" value={money(platformFee)} strong />
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total due now</Text>
              <Text style={styles.totalValue}>{money(total)}</Text>
            </View>
          </Card>

          {/* KYC gate */}
          {!kyc.isApproved && !kyc.isLoading ? (
            <Pressable style={styles.kycCard} onPress={goKyc} accessibilityRole="button" accessibilityLabel="Complete identity verification">
              <Ionicons name="shield-half-outline" size={20} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.kycTitle}>
                  {kyc.isPending ? "Verification under review" : "Identity verification required"}
                </Text>
                <Text style={styles.kycBody}>
                  {kyc.isPending
                    ? "We’ll enable payment once your verification is approved."
                    : "Verify your identity to pay and protect both sides."}
                </Text>
              </View>
              <Text style={styles.kycAction}>{kyc.isPending ? "View status" : "Verify"}</Text>
            </Pressable>
          ) : null}

          {/* How payment works — Stripe hosted checkout */}
          <View style={styles.stripeCard}>
            <View style={styles.stripeRow}>
              <Ionicons name="card-outline" size={18} color={colors.primary} />
              <Text style={styles.stripeText}>
                You’ll enter your card on Stripe’s secure checkout, then come right back to the app.
              </Text>
            </View>
            <View style={styles.stripeRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.warning} />
              <Text style={styles.stripeText}>
                Your payment is held in escrow and released to the carrier only after you confirm delivery.
              </Text>
            </View>
          </View>

          <AppButton
            label={paying ? "Opening secure checkout…" : `Pay ${money(total)}`}
            disabled={paying || !kyc.isApproved}
            onPress={() => void handlePay()}
            leftIcon={paying ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
            style={styles.payButton}
          />
        </>
      )}

      {/* KYC prompt */}
      {showKycPrompt ? (
        <View style={styles.kycPromptWrap}>
          <FormBanner
            variant="warning"
            title={kyc.isPending ? "Verification under review" : "Identity verification required"}
            message={
              kyc.isPending
                ? "Payment unlocks once your verification is approved."
                : "Complete identity verification to pay."
            }
            onDismiss={() => setShowKycPrompt(false)}
          />
          <AppButton
            label={kyc.isPending ? "View status" : "Complete verification"}
            onPress={goKyc}
            style={{ marginTop: 8 }}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, strong }: Readonly<{ label: string; value: string; strong?: boolean }>) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && { fontWeight: "700" }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 24 },
  headerRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 16, gap: 12, minHeight: 34 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800", lineHeight: 28 },

  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 64, gap: 12 },
  centeredBody: { color: colors.mutedText, fontSize: 13, fontWeight: "500" },

  panel: { borderRadius: 16, alignItems: "center", paddingVertical: 28, paddingHorizontal: 18, gap: 8 },
  panelTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 6 },
  panelBody: { color: colors.mutedText, fontSize: 13, textAlign: "center", maxWidth: 280, lineHeight: 18 },
  panelButton: { marginTop: 8, alignSelf: "stretch" },

  countdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(245,159,10,0.10)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  countdownUrgent: { backgroundColor: "rgba(220,40,40,0.10)" },
  countdownText: { color: colors.warning, fontSize: 12, fontWeight: "800" },

  card: { borderRadius: 16, marginBottom: 14, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10 },
  rowLabel: { color: colors.mutedText, fontSize: 15 },
  rowValue: { color: colors.text, fontSize: 15, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 2, marginBottom: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: colors.text, fontSize: 16, fontWeight: "700" },
  totalValue: { color: colors.primary, fontSize: 22, fontWeight: "800" },

  kycCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(245,159,10,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,159,10,0.32)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  kycTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  kycBody: { color: colors.mutedText, fontSize: 12, marginTop: 2, lineHeight: 16 },
  kycAction: { color: colors.warning, fontSize: 13, fontWeight: "800" },

  stripeCard: {
    backgroundColor: "rgba(245,159,10,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245,159,10,0.24)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 10,
  },
  stripeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  stripeText: { flex: 1, color: colors.mutedText, fontSize: 13, lineHeight: 18 },

  payButton: { borderRadius: 14, minHeight: 50 },

  kycPromptWrap: { marginTop: 16 },

  // Success
  successWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  successIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(34,195,93,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  successTitle: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  successBody: { color: colors.mutedText, fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 320 },
});
