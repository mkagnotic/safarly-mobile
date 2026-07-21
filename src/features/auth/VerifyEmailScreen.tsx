import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import type { RootStackParamList } from "@/navigation/types";
import { authApi } from "@/services/api";
import { mapOtpError } from "@/services/auth/authErrors";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";
import { sanitizeDigitsOnly } from "@/utils/inputSanitizers";

const CODE_LENGTH = 6;
/** Supabase throttles resend to one per 60s; mirror it so the button is honest. */
const RESEND_COOLDOWN_SECONDS = 60;

type Nav = NativeStackNavigationProp<RootStackParamList, "VerifyEmail">;
type Route = RouteProp<RootStackParamList, "VerifyEmail">;

/**
 * Signup email confirmation, in-app.
 *
 * The confirmation email is code-only (the Supabase template uses
 * `{{ .Token }}` with no link), so the whole flow stays on the device —
 * no browser hand-off, which is the standard mobile pattern.
 *
 * On success `verifyEmailOtp` establishes a session on the shared client,
 * `AuthContext` mirrors it into the store, and `RootNavigator` swaps to the
 * profile-setup stack. This screen deliberately does not navigate itself.
 */
export function VerifyEmailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const email = route.params.email;
  const setKycWelcomePending = useAppStore((s) => s.setKycWelcomePending);

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SECONDS);

  const codeRef = useRef<TextInput>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const handleVerify = useCallback(async () => {
    if (submitting) return;
    setFormError(null);
    setNotice(null);
    if (code.length !== CODE_LENGTH) {
      setCodeError(`Enter the ${CODE_LENGTH}-digit code`);
      codeRef.current?.focus();
      return;
    }
    setCodeError(null);
    setSubmitting(true);
    try {
      await authApi.verifyEmailOtp(email, code);
      // Arm the one-shot KYC welcome prompt for Home, exactly as the
      // confirmation-disabled path in SignupScreen does.
      setKycWelcomePending(true);
      // No navigation: the new session drives RootNavigator.
    } catch (err) {
      if (!mountedRef.current) return;
      setCodeError(mapOtpError(err));
      codeRef.current?.focus();
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [submitting, code, email, setKycWelcomePending]);

  const handleResend = useCallback(async () => {
    if (resending || resendIn > 0) return;
    setFormError(null);
    setNotice(null);
    setResending(true);
    try {
      await authApi.resendEmailOtp(email);
      if (!mountedRef.current) return;
      setNotice("We've sent another code.");
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (!mountedRef.current) return;
      setFormError(mapOtpError(err));
      // Still start the cooldown — the failure is usually the server throttle.
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } finally {
      if (mountedRef.current) setResending(false);
    }
  }, [resending, resendIn, email]);

  const busy = submitting || resending;
  const canResend = resendIn === 0 && !busy;

  return (
    <Screen scroll={false} edges={["top", "right", "left", "bottom"]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.screenTitle}>Verify your email</Text>
          </View>

          <Text style={styles.subtitle}>
            We sent a {CODE_LENGTH}-digit code to <Text style={styles.email}>{email}</Text>. Enter it
            below to finish creating your account.
          </Text>

          {formError ? (
            <View style={styles.bannerSlot}>
              <FormBanner message={formError} />
            </View>
          ) : null}
          {!formError && notice ? (
            <View style={styles.bannerSlot}>
              <FormBanner variant="success" message={notice} />
            </View>
          ) : null}

          <AppInput
            ref={codeRef}
            label="Verification code"
            value={code}
            onChangeText={(v) => {
              setCode(sanitizeDigitsOnly(v, CODE_LENGTH));
              if (codeError) setCodeError(null);
              if (formError) setFormError(null);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            autoFocus
            editable={!busy}
            error={codeError ?? undefined}
            returnKeyType="go"
            onSubmitEditing={handleVerify}
            style={styles.codeInput}
          />

          <View style={styles.actions}>
            <AppButton
              label={submitting ? "Verifying…" : "Verify email"}
              onPress={handleVerify}
              disabled={busy}
              gradientColors={[colors.ctaAccent, colors.ctaAccent]}
              leftIcon={
                submitting ? <ActivityIndicator size="small" color={colors.white} /> : undefined
              }
            />
            <Pressable
              onPress={handleResend}
              disabled={!canResend}
              hitSlop={4}
              style={styles.textLinkRow}
              accessibilityRole="button"
              accessibilityLabel={
                canResend ? "Resend code" : `Resend available in ${resendIn} seconds`
              }
            >
              <Text style={[styles.textLink, !canResend && styles.textLinkDisabled]}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.goBack()}
              disabled={busy}
              hitSlop={4}
              style={styles.textLinkRow}
              accessibilityRole="button"
              accessibilityLabel="Use a different email"
            >
              <Text style={[styles.mutedLink, busy && styles.textLinkDisabled]}>
                Wrong email? Go back
              </Text>
            </Pressable>
            <Text style={styles.note}>Check your spam folder if it hasn't arrived.</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

// Header/title/subtitle values are shared across the auth screens — keep in sync.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 18,
    minHeight: 34,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  subtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    marginBottom: 22,
  },
  email: { color: colors.text, fontWeight: "700" },
  bannerSlot: { marginBottom: 18 },
  codeInput: { fontSize: 20, letterSpacing: 6, fontWeight: "700" },
  actions: { gap: 4, marginTop: 8, paddingBottom: 28 },
  textLinkRow: { paddingVertical: 10, alignItems: "center" },
  textLink: { color: colors.ctaAccent, fontSize: 14, fontWeight: "700" },
  textLinkDisabled: { opacity: 0.5 },
  mutedLink: { color: colors.mutedText, fontSize: 14, fontWeight: "600" },
  note: { color: colors.subtleText, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 6 },
});
