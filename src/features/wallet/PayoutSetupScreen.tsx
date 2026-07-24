import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as WebBrowser from "expo-web-browser";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { getErrorMessage, paymentsApi, type StripeConnectStatus } from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "PayoutSetupTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * Standalone Stripe Connect (payout) management — web parity with
 * `CustomerPayoutSetup`. Carriers set up / continue / manage their payout
 * account here. Stripe's hosted onboarding + Express dashboard open in an
 * in-app browser (the same pattern the signup wizard uses); the browser
 * closing is our only signal, so we re-read the server status afterwards —
 * the server is the authority on what actually happened.
 */
export function PayoutSetupScreen() {
  const navigation = useNavigation<Nav>();

  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await paymentsApi.stripeConnectStatus();
      if (mountedRef.current) setStatus(res.data ?? null);
    } catch (err) {
      if (mountedRef.current) setError(getErrorMessage(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const isConnected = !!status?.connected;
  const hasAccount = !!status?.account_id;
  const isPending = !!status?.details_submitted && !isConnected;

  const openOnboarding = useCallback(async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await paymentsApi.stripeConnectOnboard();
      const url = res.data?.onboarding_url;
      if (!url) {
        if (mountedRef.current) setError("Couldn't start payout setup. Please try again.");
        return;
      }
      await WebBrowser.openBrowserAsync(url);
      if (!mountedRef.current) return;
      // Re-read the authoritative status now the user is back.
      setLoading(true);
      await loadStatus();
    } catch (err) {
      if (mountedRef.current) setError(getErrorMessage(err));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [busy, loadStatus]);

  const openDashboard = useCallback(async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await paymentsApi.stripeConnectDashboardLink();
      const url = res.data?.url;
      if (url) await WebBrowser.openBrowserAsync(url);
      else if (mountedRef.current) setError("The Stripe dashboard isn't available yet.");
    } catch (err) {
      if (mountedRef.current) setError(getErrorMessage(err));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [busy]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Profile");
  }, [navigation]);

  // ── Status card content by state ──
  const statusMeta = isConnected
    ? { icon: "checkmark-circle" as const, tint: colors.safe, title: "Payouts connected", body: "Your account is ready to receive earnings. Payouts land in your bank automatically." }
    : isPending
      ? { icon: "time" as const, tint: colors.warning, title: "Verification pending", body: "Stripe is reviewing your details. This usually takes 1–2 business days." }
      : { icon: "card" as const, tint: colors.primary, title: "Set up payouts", body: "Connect your bank so earnings can be paid out to you automatically." };

  return (
    <Screen contentContainerStyle={styles.content} refreshEnabled onRefresh={loadStatus}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Payout setup</Text>
      </View>

      {error ? (
        <View style={{ marginBottom: 14 }}>
          <FormBanner variant="error" title="Something went wrong" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {loading && !status ? (
        <Card style={styles.centerCard}>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : (
        <>
          {/* Status card */}
          <Card style={styles.statusCard}>
            <View style={[styles.statusIcon, { backgroundColor: withAlpha(statusMeta.tint) }]}>
              <Ionicons name={statusMeta.icon} size={26} color={statusMeta.tint} />
            </View>
            <Text style={styles.statusTitle}>{statusMeta.title}</Text>
            <Text style={styles.statusBody}>{statusMeta.body}</Text>
            {isConnected ? (
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>Active</Text>
              </View>
            ) : null}
          </Card>

          {/* Benefits — only before an account exists */}
          {!hasAccount ? (
            <Card style={styles.card}>
              <Benefit icon="lock-closed-outline" title="Secure verification" body="Stripe verifies your identity and bank details — we never see them." />
              <Benefit icon="cash-outline" title="Direct bank deposits" body="Earnings are deposited straight to your bank account." />
              <Benefit icon="pricetag-outline" title="No fees to connect" body="Setting up payouts is free." last />
            </Card>
          ) : null}

          {/* Actions */}
          {isConnected ? (
            <>
              <AppButton
                label="View Stripe dashboard"
                onPress={() => void openDashboard()}
                disabled={busy}
                leftIcon={busy ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
                style={styles.action}
              />
              <AppButton
                label="Update bank details"
                variant="secondary"
                onPress={() => void openOnboarding()}
                disabled={busy}
                style={styles.action}
              />
            </>
          ) : (
            <AppButton
              label={hasAccount ? (isPending ? "Continue setup" : "Complete setup") : "Set up payouts"}
              onPress={() => void openOnboarding()}
              disabled={busy}
              leftIcon={busy ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
              style={styles.action}
            />
          )}

          {/* FAQ */}
          <Card style={styles.card}>
            <Text style={styles.faqHeading}>How payouts work</Text>
            <Faq q="When do I get paid?" a="Earnings pay out automatically to your linked bank 2–7 business days after each delivery (your first payout can take 7–14 days)." />
            <Faq q="What's the platform fee?" a="Safarly adds a 10% platform fee on top of the delivery fee, paid by the sender — you receive your full quoted fee." />
            <Faq q="What do I need?" a="A government ID and your bank details, entered securely on Stripe." last />
          </Card>
        </>
      )}
    </Screen>
  );
}

function Benefit({ icon, title, body, last }: Readonly<{ icon: keyof typeof Ionicons.glyphMap; title: string; body: string; last?: boolean }>) {
  return (
    <View style={[styles.benefitRow, !last && styles.benefitDivider]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitBody}>{body}</Text>
      </View>
    </View>
  );
}

function Faq({ q, a, last }: Readonly<{ q: string; a: string; last?: boolean }>) {
  return (
    <View style={[styles.faqRow, !last && styles.benefitDivider]}>
      <Text style={styles.faqQ}>{q}</Text>
      <Text style={styles.faqA}>{a}</Text>
    </View>
  );
}

/** 12%-alpha tint of a solid colour for icon chips. */
function withAlpha(hex: string): string {
  if (hex.startsWith("#") && hex.length === 7) return `${hex}1F`;
  return "rgba(0,0,0,0.06)";
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 28 },
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

  centerCard: { borderRadius: 16, alignItems: "center", paddingVertical: 40 },

  statusCard: { borderRadius: 16, alignItems: "center", paddingVertical: 22, paddingHorizontal: 18, marginBottom: 14, gap: 8 },
  statusIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  statusTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  statusBody: { color: colors.mutedText, fontSize: 13, textAlign: "center", lineHeight: 19, maxWidth: 300 },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    backgroundColor: "rgba(34,195,93,0.10)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.safe },
  activeText: { color: colors.safe, fontSize: 12, fontWeight: "800" },

  card: { borderRadius: 16, marginBottom: 14, paddingHorizontal: 16, paddingVertical: 6 },
  action: { borderRadius: 14, minHeight: 50, marginBottom: 12 },

  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 },
  benefitDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  benefitTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  benefitBody: { color: colors.mutedText, fontSize: 12, marginTop: 2, lineHeight: 16 },

  faqHeading: { color: colors.text, fontSize: 16, fontWeight: "800", paddingVertical: 10 },
  faqRow: { paddingVertical: 12 },
  faqQ: { color: colors.text, fontSize: 14, fontWeight: "700" },
  faqA: { color: colors.mutedText, fontSize: 13, marginTop: 3, lineHeight: 19 },
});

export default PayoutSetupScreen;
