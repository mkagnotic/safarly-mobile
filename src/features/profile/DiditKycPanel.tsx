import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { ApiClientError, getErrorMessage, kycApi, type KycConsentState, type KycStatusBlock } from "@/services/api";
import { colors } from "@/theme/colors";
import {
  DIDIT_PRIVACY_NOTICE_URL,
  DIDIT_CONSENT_AGREEMENT,
  KYC_CONSENT_TITLE,
  diditConsentParagraphs,
} from "@/features/profile/kycConsentText";
import {
  DIDIT_COPY,
  KYC_RETURN_URL,
  attemptsLeftText,
  diditView,
  initiateErrorAction,
  isDiditUrl,
  kycPollInterval,
  startLabel,
  statusCheckMessage,
  type KycCheckNote,
} from "@/features/profile/kycFlow";

/*
 * Automatic identity verification with Didit (provider switch "didit"). Same
 * states, rules and copy as web; decisions live in kycFlow.ts (tested).
 *
 * Didit opens in the SYSTEM browser (ASWebAuthenticationSession / Chrome
 * Custom Tabs), not a WebView: its camera prompt is the browser's own, so the
 * app needs no new permission. `preferEphemeralSession` skips iOS's "wants to
 * use … to Sign In" prompt. Didit sends the browser to safarly://kyc-return when
 * the user finishes; the result itself only ever comes from our server.
 */

interface Props {
  block: KycStatusBlock;
  consent: KycConsentState | null;
  refresh: () => Promise<void> | void;
  /** "Check status": asks Didit now (server `?check=1`) and returns the fresh block. */
  checkStatus: () => Promise<KycStatusBlock | null>;
  agreeToConsent: () => Promise<void>;
  agreeing: boolean;
  /** Didit unreachable and the server still accepts uploads: show today's wizard. */
  onUnavailable: () => void;
  onNotNow: () => void;
}

export function DiditKycPanel({ block, consent, refresh, checkStatus, agreeToConsent, agreeing, onUnavailable, onNotNow }: Props) {
  const [opening, setOpening] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState<KycCheckNote | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // Back in the foreground (returned from Didit, or the app was backgrounded): re-read.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void refreshRef.current(); });
    return () => sub.remove();
  }, []);

  // While in progress, poll (only while the app is active — AppState pauses it).
  const interval = kycPollInterval(block);
  useEffect(() => {
    if (!interval) return undefined;
    const id = setInterval(() => { if (AppState.currentState === "active") void refreshRef.current(); }, interval);
    return () => clearInterval(id);
  }, [interval]);

  const markUnavailable = useCallback(() => {
    if (block.manual_upload) onUnavailable();
    else setUnavailable(true);
  }, [block.manual_upload, onUnavailable]);

  // A note answers one tap; once the state moves on it no longer applies.
  useEffect(() => { setCheckNote(null); }, [block.state]);

  const check = useCallback(async () => {
    setCheckNote(null);
    setChecking(true);
    try {
      setCheckNote(statusCheckMessage(await checkStatus()));
    } catch {
      setCheckNote(statusCheckMessage({ state: "in_progress", check: { result: "unreachable" } }));
    } finally {
      setChecking(false);
    }
  }, [checkStatus]);

  const start = useCallback(async () => {
    setUnavailable(false);
    setMessage(null);
    setCheckNote(null);
    setOpening(true);
    try {
      const res = await kycApi.initiate(Platform.OS === "ios" ? "ios" : "android");
      const url = res.data?.url;
      if (!isDiditUrl(url)) { markUnavailable(); return; }
      // Resolves when Didit redirects to safarly://kyc-return or the user closes the sheet.
      await WebBrowser.openAuthSessionAsync(url, KYC_RETURN_URL, { preferEphemeralSession: true });
    } catch (err) {
      const action = initiateErrorAction(err instanceof ApiClientError ? err : null);
      if (action === "unavailable") markUnavailable();
      else if (action === "message") setMessage(getErrorMessage(err));
    } finally {
      setOpening(false);
      void refreshRef.current();
    }
  }, [markUnavailable]);

  const view = diditView(block, consent, { unavailable, consentAgreed });

  if (view.kind === "approved") {
    return <StatusCard icon="checkmark" tint={colors.safe} title={DIDIT_COPY.verifiedTitle} body={DIDIT_COPY.verifiedDesc} />;
  }
  if (view.kind === "in_review") {
    return <StatusCard icon="time-outline" tint={colors.warning} title={DIDIT_COPY.reviewTitle} body={DIDIT_COPY.reviewDesc} />;
  }
  if (view.kind === "exhausted") {
    return (
      <View style={styles.bannerSlot}>
        <FormBanner
          variant="warning"
          title={DIDIT_COPY.actionTitle}
          message={view.contactEmail ? `${view.reason} Questions? Email ${view.contactEmail}.` : view.reason}
          actionLabel={view.contactEmail ? "Email us" : undefined}
          onAction={view.contactEmail ? () => void Linking.openURL(`mailto:${view.contactEmail}?subject=Identity%20verification`) : undefined}
        />
      </View>
    );
  }
  if (view.kind === "unavailable") {
    return (
      <View style={styles.bannerSlot}>
        <FormBanner
          variant="warning"
          title={DIDIT_COPY.unavailableTitle}
          message={DIDIT_COPY.unavailable}
          actionLabel="Try again"
          onAction={() => void start()}
        />
      </View>
    );
  }
  if (view.kind === "consent" && consent) {
    return (
      <Card style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">{KYC_CONSENT_TITLE}</Text>
        {diditConsentParagraphs({ retentionDays: consent.retention_days!, contactEmail: consent.contact_email! }).map((p) => (
          <Text key={p.text.slice(0, 24)} style={styles.consentText}>
            {p.lead ? <Text style={styles.consentLead}>{p.lead} </Text> : null}
            {p.text}
          </Text>
        ))}
        <Pressable onPress={() => void Linking.openURL("https://mysafarly.com/privacy")} accessibilityRole="link" accessibilityLabel="Privacy Policy">
          <Text style={styles.link}>Read our Privacy Policy</Text>
        </Pressable>
        <Pressable onPress={() => void Linking.openURL(DIDIT_PRIVACY_NOTICE_URL)} accessibilityRole="link" accessibilityLabel="Didit's Verification Privacy Notice">
          <Text style={styles.link}>Read Didit's Verification Privacy Notice</Text>
        </Pressable>
        <Text style={styles.agreement}>{DIDIT_CONSENT_AGREEMENT}</Text>
        <AppButton
          label={agreeing ? "Saving…" : "I agree"}
          disabled={agreeing}
          onPress={() => {
            void agreeToConsent()
              .then(() => { setConsentAgreed(true); void refreshRef.current(); })
              .catch((err) => setMessage(getErrorMessage(err)));
          }}
          style={styles.button}
        />
        <AppButton label="Not now" variant="secondary" onPress={onNotNow} style={styles.button} />
        {message ? <Text style={styles.error} accessibilityLiveRegion="polite">{message}</Text> : null}
      </Card>
    );
  }

  const busy = opening || checking;
  return (
    <>
      {view.kind === "declined" ? (
        <View style={styles.bannerSlot}>
          <FormBanner variant="warning" title={DIDIT_COPY.actionTitle} message={`${view.reason} ${attemptsLeftText(view.attemptsLeft)}`} />
        </View>
      ) : null}

      {view.kind === "in_progress" ? (
        <Card style={styles.card}>
          <View style={styles.progressRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.cardTitle}>{DIDIT_COPY.progressTitle}</Text>
          </View>
          <Text style={styles.body}>{DIDIT_COPY.progressDesc}</Text>
          <Text style={styles.hint}>{DIDIT_COPY.progressHint}</Text>
        </Card>
      ) : null}

      {view.kind === "not_started" ? (
        <Card style={[styles.card, styles.introCard]}>
          <Text style={styles.cardTitle}>Before you start</Text>
          {DIDIT_COPY.beforeYouStart.map((p) => (
            <View key={p} style={styles.introRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.safe} />
              <Text style={styles.introText}>{p}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {message ? (
        <View style={styles.bannerSlot}>
          <FormBanner variant="error" title="Couldn't start verification" message={message} onDismiss={() => setMessage(null)} />
        </View>
      ) : null}

      <AppButton
        label={busy ? DIDIT_COPY.opening : startLabel(view.kind)}
        onPress={() => void start()}
        disabled={busy}
        gradientColors={[colors.ctaAccent, colors.ctaAccent]}
        leftIcon={busy ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
        style={styles.button}
      />
      {view.kind === "in_progress" ? (
        <AppButton
          label={checking ? "Checking…" : "Check status"}
          variant="secondary"
          onPress={() => void check()}
          disabled={busy}
          leftIcon={checking ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
          style={styles.button}
        />
      ) : null}
      {checkNote ? (
        <View style={styles.checkNote} accessibilityLiveRegion="polite">
          <FormBanner
            variant={checkNote.tone}
            title={checkNote.tone === "warning" ? "Couldn't check right now" : "Not finished yet"}
            message={checkNote.text}
            onDismiss={() => setCheckNote(null)}
          />
        </View>
      ) : null}
    </>
  );
}

function StatusCard({ icon, tint, title, body }: { icon: keyof typeof Ionicons.glyphMap; tint: string; title: string; body: string }) {
  return (
    <View style={styles.statusCard} accessibilityLiveRegion="polite">
      <View style={[styles.statusIconWrap, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={34} color={colors.white} />
      </View>
      <Text style={styles.statusHeadline}>{title}</Text>
      <Text style={styles.statusDescription}>{body}</Text>
    </View>
  );
}

// Same values as KycVerificationScreen's styles: no new visual language.
const styles = StyleSheet.create({
  bannerSlot: { marginBottom: 14 },
  checkNote: { marginTop: 12 },
  statusCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    marginBottom: 14,
  },
  statusIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  statusHeadline: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800", textAlign: "center", marginBottom: 10 },
  statusDescription: { color: colors.mutedText, fontSize: 15, lineHeight: 22, fontWeight: "500", textAlign: "center", maxWidth: 320 },
  card: { borderRadius: 16, marginBottom: 14, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 10 },
  introCard: { gap: 10 },
  introRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  introText: { flex: 1, color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  body: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  hint: { color: colors.subtleText, fontSize: 12, lineHeight: 18, marginTop: 8 },
  consentText: { color: colors.mutedText, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  consentLead: { color: colors.text, fontWeight: "700" },
  agreement: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: "700", marginTop: 6, marginBottom: 4 },
  link: { color: colors.ctaAccent, fontSize: 14, fontWeight: "700", marginBottom: 8 },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  button: { marginTop: 8, alignSelf: "stretch" },
});
