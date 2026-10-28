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
import { ErrorState } from "@/components/ui/ErrorState";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { getErrorMessage, paymentsApi, PAYOUT_RETURN_URL, type PayoutStatus } from "@/services/api";
import { RazorpayPayoutForm } from "./RazorpayPayoutForm";
import { colors } from "@/theme/colors";
import { useKycGate } from "@/hooks/api/useKycGate";
import { useMyProfile } from "@/hooks/api/useMyProfile";
import { countryName, payoutBlock } from "@/utils/payoutEligibility";
import { showToast } from "@/feedback/appFeedback";

/** The processor's name when we must not (or cannot) name it. */
const PAYMENT_PARTNER = "our payment partner";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "PayoutSetupTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * Standalone payout management — web parity with `CustomerPayoutSetup`.
 * Carriers set up / continue / manage their payout account here.
 *
 * The SERVER decides which processor pays this carrier (Stripe Connect in the
 * US, RazorpayX in India) and how its setup is collected — this screen renders
 * that answer and never looks at the user's country:
 *
 *   setup_kind 'hosted'       -> Stripe's hosted onboarding + Express dashboard
 *                                open in an in-app browser (the same pattern the
 *                                signup wizard uses). Onboarding returns through
 *                                the web bounce page to `safarly://payout-return`,
 *                                which closes the browser on its own.
 *   setup_kind 'bank_details' -> the bank-account / UPI form is shown inline.
 *
 * Either way we re-read the server status afterwards, since the server is the
 * authority on what actually happened.
 */
export function PayoutSetupScreen() {
  const navigation = useNavigation<Nav>();
  // Client requirement: KYC is mandatory before setting up payouts (the server
  // enforces it too - payment-handler requireKycForPayouts).
  const kyc = useKycGate();

  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [loading, setLoading] = useState(true);
  // ONE busy flag for every button on the screen; `busyAction` only picks the label.
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"onboard" | "dashboard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The status load failing, kept apart from button errors: without a status
   *  the cards below would claim "Set up payouts" for an account that may be live. */
  const [loadError, setLoadError] = useState<unknown>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Whether a status is already on screen, read inside loadStatus without
  // re-creating it. A refresh that fails while a status is shown must be SAID:
  // the error panel below only renders when there is no status at all.
  const hasStatusRef = useRef(false);
  const loadStatus = useCallback(async (): Promise<PayoutStatus | null> => {
    setLoadError(null);
    try {
      const res = await paymentsApi.payoutStatus();
      const next = res.data ?? null;
      if (mountedRef.current) setStatus(next);
      hasStatusRef.current = !!next;
      return next;
    } catch (err) {
      if (mountedRef.current) {
        setLoadError(err);
        if (hasStatusRef.current) {
          showToast({ title: "Couldn't refresh your payout status", message: getErrorMessage(err), variant: "error" });
        }
      }
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // KYC re-reads on every focus; only the FIRST read may hold the screen on a
  // spinner, or each return to the screen would flash it.
  const [kycSettled, setKycSettled] = useState(false);
  useEffect(() => {
    if (!kyc.isLoading) setKycSettled(true);
  }, [kyc.isLoading]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const isConnected = !!status?.connected;
  const hasAccount = !!status?.account_id;
  const isPending = !!status?.details_submitted && !isConnected;
  // 'hosted' = open the provider's onboarding in a browser; 'bank_details' =
  // collect the destination account here. Defaults to hosted so the screen keeps
  // behaving exactly as before while the status request is in flight.
  const isHostedSetup = (status?.setup_kind ?? "hosted") === "hosted";
  // An India-profile carrier can't be onboarded by the US Stripe platform: say so
  // here instead of a Set-up button that ends in a Stripe error (web parity).
  const { profile } = useMyProfile();
  const countryBlock = !isConnected ? payoutBlock(status?.provider ?? "stripe", profile?.country) : null;
  // Name the processor only on the hosted (Stripe) path, and only from the
  // server. A bank-details (India) or country-blocked carrier never sees
  // "Stripe" or "Razorpay" (money canon #17).
  const providerLabel =
    isHostedSetup && !countryBlock && status?.provider_label ? status.provider_label : PAYMENT_PARTNER;
  const ProviderLabel = providerLabel.charAt(0).toUpperCase() + providerLabel.slice(1);

  const openOnboarding = useCallback(async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    setBusyAction("onboard");
    try {
      const res = await paymentsApi.payoutOnboard();
      const url = res.data?.onboarding_url;
      if (!url) {
        if (mountedRef.current) setError("Couldn't start payout setup. Please try again.");
        return;
      }
      // Resolves as soon as Stripe bounces through /mobile-return to
      // PAYOUT_RETURN_URL, so the browser closes itself; it also resolves if the
      // user dismisses it early. Either way the server is the authority, so we
      // re-read the status rather than trusting the result.
      // Ephemeral (iOS only) skips the "wants to use stripe.com to Sign In" prompt.
      await WebBrowser.openAuthSessionAsync(url, PAYOUT_RETURN_URL, { preferEphemeralSession: true });
      if (!mountedRef.current) return;
      setLoading(true);
      const next = await loadStatus();
      // Say what happened on EVERY return, not only the first onboarding.
      if (mountedRef.current && next?.connected) {
        showToast({ title: "Payouts connected — you're all set to accept deliveries.", variant: "success" });
      } else if (mountedRef.current && next?.details_submitted) {
        showToast({ title: `Details submitted — ${next.provider_label ?? "our payment partner"} is verifying your account.`, variant: "info" });
      }
    } catch (err) {
      if (mountedRef.current) setError(getErrorMessage(err));
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setBusyAction(null);
      }
    }
  }, [busy, loadStatus]);

  const openDashboard = useCallback(async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    setBusyAction("dashboard");
    try {
      const res = await paymentsApi.stripeConnectDashboardLink();
      const url = res.data?.url;
      if (url) await WebBrowser.openBrowserAsync(url);
      else if (mountedRef.current) setError(providerLabel === PAYMENT_PARTNER ? "The payout dashboard isn't available yet." : `The ${providerLabel} dashboard isn't available yet.`);
    } catch (err) {
      if (mountedRef.current) setError(getErrorMessage(err));
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setBusyAction(null);
      }
    }
  }, [busy, providerLabel]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Profile");
  }, [navigation]);

  // ── Status card content by state ──
  const statusMeta = isConnected
    ? { icon: "checkmark-circle" as const, tint: colors.safe, title: "Payouts connected", body: "Your bank account is connected. Earnings are paid to it after the sender confirms each delivery." }
    : countryBlock
      ? { icon: "alert-circle" as const, tint: colors.warning, title: "Payouts unavailable in your country", body: `Payouts to ${countryName(countryBlock.country)} aren't available yet, so this can't be completed right now.` }
      : isPending
        ? { icon: "time" as const, tint: colors.warning, title: "Verification pending", body: `${ProviderLabel} is reviewing your details. This usually takes 1–2 business days.` }
        : { icon: "card" as const, tint: colors.primary, title: "Set up payouts", body: "Connect your bank account to receive your earnings after each confirmed delivery." };

  // Not verified and no payout account yet: identity first. An account set up
  // before this rule still shows its status.
  // Wait for the payout status too: an older account that isn't verified used
  // to flash "Verify your identity first" until its status arrived.
  const header = (
    <>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Payout setup</Text>
      </View>
      <Text style={styles.subtitle}>Connect your bank account to receive your delivery earnings.</Text>
    </>
  );

  // Nothing actionable until BOTH identity and payout status are known: an
  // active "Set up payouts" used to flash while KYC was still loading.
  if (!kycSettled || (loading && !status && !loadError)) {
    return (
      <Screen contentContainerStyle={styles.content}>
        {header}
        <Card style={styles.centerCard}>
          <ActivityIndicator color={colors.primary} />
        </Card>
      </Screen>
    );
  }
  if (!kyc.isLoading && kyc.isError && !hasAccount && !loading) {
    return (
      <Screen contentContainerStyle={styles.content}>
        {header}
        <ErrorState
          error={new Error("Couldn't check your identity verification.")}
          title="Couldn't check your identity verification"
          body="Please try again in a moment."
          onRetry={() => void kyc.refetch()}
        />
      </Screen>
    );
  }
  if (!kyc.isLoading && !kyc.isApproved && !hasAccount && !loading) {
    return (
      <Screen contentContainerStyle={styles.content}>
        {header}
        <Card>
          <Text style={styles.kycTitle}>Verify your identity first</Text>
          <Text style={styles.kycBody}>
            Identity verification is required before you can set up payouts. It only takes a few minutes.
          </Text>
          <AppButton
            label={kyc.isPending ? "View verification status" : "Verify identity"}
            onPress={() => navigation.navigate("KycVerificationTab")}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshEnabled
      onRefresh={async () => {
        await loadStatus();
      }}
    >
      {header}

      {error ? (
        <View style={{ marginBottom: 14 }}>
          <FormBanner variant="error" title="Couldn't open payout setup" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {loading && !status ? (
        <Card style={styles.centerCard}>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : loadError && !status ? (
        <ErrorState
          error={loadError}
          subject="your payout status"
          onRetry={() => {
            setLoading(true);
            void loadStatus();
          }}
        />
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

          {/* Benefits — only before an account exists, and never to a carrier
              whose country can't be paid (they would read a processor's name). */}
          {!hasAccount && !countryBlock ? (
            <Card style={styles.card}>
              <Benefit
                icon="lock-closed-outline"
                title="Secure verification"
                body={
                  providerLabel === PAYMENT_PARTNER
                    ? `Our payment partner checks your bank details${isHostedSetup ? " and identity" : ""}.`
                    : `${providerLabel}, our payment partner, checks your bank details${isHostedSetup ? " and identity" : ""}.`
                }
              />
              <Benefit icon="cash-outline" title="Direct bank deposits" body="Earnings are paid to your bank account after the sender confirms delivery." />
              <Benefit icon="pricetag-outline" title="No fees to connect" body="Setting up payouts is free, and you receive your full quoted fee for each delivery." last />
            </Card>
          ) : null}

          {/*
            What to expect on the NEXT screen, not this one.

            Stripe asks "how do you earn or collect money" and offers a product
            description or a website URL. Carriers read "website" and stall:
            they are individuals carrying parcels, they have no site of their
            own, and mysafarly.com is not theirs to claim — Stripe's own note
            says giving a URL asserts you use it to promote or sell. So they
            abandon onboarding, and payouts never get set up.

            Raised by a carrier who hit exactly this. The suggested wording is
            offered verbatim so there is nothing to compose.
          */}
          {/* Only Stripe's hosted page asks "what do you sell"; Razorpay is a form here. */}
          {!hasAccount && isHostedSetup && !countryBlock ? (
            <Card style={styles.hintCard}>
              <Text style={styles.hintTitle}>Before you continue</Text>
              <Text style={styles.hintBody}>
                {ProviderLabel} will ask what you sell. Choose the product description option — you
                don’t need a website.
              </Text>
              <View style={styles.hintQuote}>
                <Text style={styles.hintQuoteText}>
                  “I deliver parcels for customers and earn a fee for each delivery.”
                </Text>
              </View>
            </Card>
          ) : null}

          {countryBlock ? (
            <Card style={styles.hintCard}>
              <Text style={styles.hintTitle}>We can't pay into {countryName(countryBlock.country)} yet</Text>
              <Text style={styles.hintBody}>
                Your profile country is {countryName(countryBlock.country)}. Payouts to banks there aren't
                switched on yet; you'll be able to finish setup once they are. If your bank account is in
                the United States, change your country in Edit profile and you can set up payouts now.
              </Text>
              <AppButton label="Edit profile" variant="secondary" onPress={() => navigation.navigate("EditProfileTab")} style={styles.action} />
            </Card>
          ) : null}

          {/* Actions */}
          {countryBlock ? null : isHostedSetup ? (
            isConnected ? (
              <>
                <AppButton
                  label={busyAction === "dashboard" ? "Opening…" : providerLabel === PAYMENT_PARTNER ? "View payout dashboard" : `View ${providerLabel} dashboard`}
                  onPress={() => void openDashboard()}
                  disabled={busy}
                  leftIcon={busyAction === "dashboard" ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
                  style={styles.action}
                />
                <AppButton
                  label={busyAction === "onboard" ? `Redirecting to ${providerLabel}…` : "Update bank details"}
                  variant="secondary"
                  onPress={() => void openOnboarding()}
                  disabled={busy}
                  style={styles.action}
                />
              </>
            ) : (
              <AppButton
                label={
                  busyAction === "onboard"
                    ? `Redirecting to ${providerLabel}…`
                    : hasAccount
                      ? isPending
                        ? "Continue setup"
                        : "Complete setup"
                      : "Set up payouts"
                }
                onPress={() => void openOnboarding()}
                disabled={busy}
                leftIcon={busy ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
                style={styles.action}
              />
            )
          ) : (
            // Razorpay: no hosted flow and no carrier-facing dashboard — entering
            // (or updating) the destination account IS the whole surface.
            <Card style={styles.card}>
              <RazorpayPayoutForm hasAccount={hasAccount} onSaved={loadStatus} defaultName={profile?.name ?? undefined} />
            </Card>
          )}

          {/* FAQ */}
          <Card style={styles.card}>
            <Text style={styles.faqHeading}>How payouts work</Text>
            <Faq q="When do I receive my earnings?" a="Earnings are released when the sender confirms delivery and usually reach your bank 2–7 business days later (your first payout can take 7–14 days)." />
            <Faq q="What documents do I need?" a={isHostedSetup ? `A government ID, your bank details and your address, entered securely on ${providerLabel}.` : "Your bank account number and IFSC code, or a UPI ID."} />
            <Faq q="Are there any fees?" a="Safarly adds a 10% platform fee on top of the delivery fee, paid by the sender, so you receive your full quoted fee. Connecting your bank is free." last />
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
  kycTitle: { color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 6 },
  kycBody: { color: colors.mutedText, fontSize: 14, lineHeight: 20, marginBottom: 14 },
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
  subtitle: { color: colors.mutedText, fontSize: 13, lineHeight: 18, marginTop: -8, marginBottom: 14 },

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

  // The "what Stripe will ask you next" note. Padded like a normal card rather
  // than the Benefit list's tighter rhythm, because it is prose to be read once
  // and a sentence to be copied, not a row to be scanned.
  hintCard: { borderRadius: 16, marginBottom: 14, paddingHorizontal: 16, paddingVertical: 16 },
  hintTitle: { color: colors.text, fontSize: 14, fontWeight: "800", marginBottom: 6 },
  hintBody: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  hintQuote: { backgroundColor: colors.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 },
  hintQuoteText: { color: colors.text, fontSize: 12, lineHeight: 18, fontStyle: "italic" },
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
