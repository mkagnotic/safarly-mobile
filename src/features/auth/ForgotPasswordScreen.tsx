import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
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
import { mapPasswordResetError } from "@/services/auth/authErrors";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

/** Keep in sync with LoginScreen / SignupScreen. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Throttles the resend button. The server allows 5 requests per email per
 * 15 minutes, so a short client-side cooldown keeps an impatient user from
 * burning that budget and locking themselves out of their own recovery.
 */
const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Registered on two navigators — `ForgotPassword` in the pre-auth root stack
 * and `ForgotPasswordTab` inside MainTabs (reached from Change Password) — so
 * this screen stays navigator-agnostic: it only ever calls `goBack()`.
 */
type ForgotPasswordRoute = RouteProp<Record<string, { email?: string } | undefined>, string>;

export function ForgotPasswordScreen() {
  // Typed against the root stack for the `ResetPassword` push. When this screen
  // is mounted inside MainTabs (from Change Password) that route doesn't exist,
  // which is why the CTA is gated on `authenticated` below — only `goBack()` is
  // used on that path.
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ForgotPasswordRoute>();
  // Signed-in users arrive from Change Password; everyone else came from Login.
  const authenticated = useAppStore((s) => s.authenticated);

  const [email, setEmail] = useState(route.params?.email?.trim().toLowerCase() ?? "");
  /** The address we actually sent to — shown on the confirmation state. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const emailRef = useRef<TextInput>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => {
      setResendIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  /**
   * `resend` only changes the copy we show — the request is identical. The
   * endpoint reports success even for unregistered addresses (anti-enumeration),
   * so a resolved promise proves the request was accepted, never that an
   * account exists.
   */
  const submit = useCallback(
    async (resend: boolean) => {
      if (submitting) return;
      const normalized = email.trim().toLowerCase();
      if (normalized !== email) setEmail(normalized);

      setFormError(null);
      setResendNotice(null);
      if (!normalized) {
        setEmailError("Email is required");
        emailRef.current?.focus();
        return;
      }
      if (!EMAIL_RE.test(normalized)) {
        setEmailError("Enter a valid email");
        emailRef.current?.focus();
        return;
      }
      setEmailError(null);

      setSubmitting(true);
      try {
        await authApi.forgotPassword(normalized);
        if (!mountedRef.current) return;
        setSentTo(normalized);
        setResendIn(RESEND_COOLDOWN_SECONDS);
        if (resend) setResendNotice("We've sent another link.");
      } catch (err) {
        if (!mountedRef.current) return;
        setFormError(mapPasswordResetError(err));
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [email, submitting],
  );

  /** Back to the form with the address retained, so a typo is a quick fix. */
  const editEmail = useCallback(() => {
    setSentTo(null);
    setFormError(null);
    setResendNotice(null);
  }, []);

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        style={styles.backButton}
        onPress={goBack}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.screenTitle}>Forgot password</Text>
    </View>
  );

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
          {header}

          {sentTo ? (
            <SentState
              email={sentTo}
              notice={resendNotice}
              error={formError}
              resendIn={resendIn}
              submitting={submitting}
              onResend={() => submit(true)}
              onEditEmail={editEmail}
              onDone={goBack}
              onEnterCode={
                authenticated ? null : () => navigation.navigate("ResetPassword", { email: sentTo })
              }
            />
          ) : (
            <RequestState
              inputRef={emailRef}
              email={email}
              emailError={emailError}
              formError={formError}
              submitting={submitting}
              onChangeEmail={(v) => {
                setEmail(v);
                if (emailError) setEmailError(null);
                if (formError) setFormError(null);
              }}
              onSubmit={() => submit(false)}
              onBackToSignIn={authenticated ? null : goBack}
            />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

// ───────────────────────────── Request state ─────────────────────────────

interface RequestStateProps {
  inputRef: RefObject<TextInput | null>;
  email: string;
  emailError: string | null;
  formError: string | null;
  submitting: boolean;
  onChangeEmail: (value: string) => void;
  onSubmit: () => void;
  /** Null when signed in — there's no sign-in screen to go back to. */
  onBackToSignIn: (() => void) | null;
}

function RequestState({
  inputRef,
  email,
  emailError,
  formError,
  submitting,
  onChangeEmail,
  onSubmit,
  onBackToSignIn,
}: Readonly<RequestStateProps>) {
  return (
    <>
      <Text style={styles.subtitle}>
        Enter the email you signed up with and we'll send you a link to reset your password.
      </Text>

      {formError ? (
        <View style={styles.bannerSlot}>
          <FormBanner message={formError} />
        </View>
      ) : null}

      <AppInput
        ref={inputRef}
        label="Email"
        value={email}
        onChangeText={onChangeEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        editable={!submitting}
        error={emailError ?? undefined}
        returnKeyType="send"
        onSubmitEditing={onSubmit}
      />

      <View style={styles.actions}>
        <AppButton
          label={submitting ? "Sending…" : "Send reset link"}
          onPress={onSubmit}
          disabled={submitting}
          gradientColors={[colors.ctaAccent, colors.ctaAccent]}
          leftIcon={submitting ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
        />
        {onBackToSignIn ? (
          <Pressable
            onPress={onBackToSignIn}
            disabled={submitting}
            hitSlop={4}
            style={styles.textLinkRow}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
          >
            <Text style={[styles.textLink, submitting && styles.textLinkDisabled]}>
              Back to sign in
            </Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

// ───────────────────────────── Sent state ─────────────────────────────

interface SentStateProps {
  email: string;
  notice: string | null;
  error: string | null;
  resendIn: number;
  submitting: boolean;
  onResend: () => void;
  onEditEmail: () => void;
  onDone: () => void;
  /** Null when signed in — the in-app code flow is pre-auth only. */
  onEnterCode: (() => void) | null;
}

function SentState({
  email,
  notice,
  error,
  resendIn,
  submitting,
  onResend,
  onEditEmail,
  onDone,
  onEnterCode,
}: Readonly<SentStateProps>) {
  const canResend = resendIn === 0 && !submitting;
  return (
    <View style={styles.sentWrap}>
      <View style={styles.successIcon}>
        <Ionicons name="mail-open-outline" size={30} color={colors.safe} />
      </View>

      <Text style={styles.sentTitle}>Check your email</Text>
      {/*
        Anti-enumeration: the server responds the same way whether or not the
        address is registered, so the copy must stay conditional ("if an
        account exists") and never confirm one does.

        The stated lifetime tracks Supabase Auth's `mailer_otp_exp` (600s) —
        a project-level setting shared with the signup confirmation email.
        Change one and this copy has to change with it.
      */}
      <Text style={styles.sentBody}>
        If an account exists for <Text style={styles.sentEmail}>{email}</Text>, we've sent a 6-digit
        code to reset your password. It expires in 10 minutes.
      </Text>

      {error ? (
        <View style={styles.sentBannerSlot}>
          <FormBanner message={error} />
        </View>
      ) : null}
      {!error && notice ? (
        <View style={styles.sentBannerSlot}>
          <FormBanner variant="success" message={notice} />
        </View>
      ) : null}

      <Text style={styles.hint}>Didn't get it? Check your spam folder.</Text>

      <View style={styles.sentActions}>
        <AppButton
          label={onEnterCode ? "Enter code" : "Done"}
          onPress={onEnterCode ?? onDone}
          disabled={submitting}
          gradientColors={[colors.ctaAccent, colors.ctaAccent]}
        />
        <Pressable
          onPress={onResend}
          disabled={!canResend}
          hitSlop={4}
          style={styles.textLinkRow}
          accessibilityRole="button"
          accessibilityLabel={canResend ? "Resend reset link" : `Resend available in ${resendIn} seconds`}
        >
          <Text style={[styles.textLink, !canResend && styles.textLinkDisabled]}>
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend link"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onEditEmail}
          disabled={submitting}
          hitSlop={4}
          style={styles.textLinkRow}
          accessibilityRole="button"
          accessibilityLabel="Use a different email"
        >
          <Text style={[styles.mutedLink, submitting && styles.textLinkDisabled]}>
            Use a different email
          </Text>
        </Pressable>
        {onEnterCode ? (
          <Pressable
            onPress={onDone}
            disabled={submitting}
            hitSlop={4}
            style={styles.textLinkRow}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
          >
            <Text style={[styles.mutedLink, submitting && styles.textLinkDisabled]}>
              Back to sign in
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ───────────────────────────── Styles ─────────────────────────────
// Header/title/subtitle values are shared with LoginScreen, SignupScreen and
// ProfileSetupScreen — keep them in sync.

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
  bannerSlot: { marginBottom: 18 },

  actions: { gap: 12, marginTop: 8 },
  textLinkRow: { paddingVertical: 10, alignItems: "center" },
  textLink: { color: colors.ctaAccent, fontSize: 14, fontWeight: "700" },
  textLinkDisabled: { opacity: 0.5 },
  mutedLink: { color: colors.mutedText, fontSize: 14, fontWeight: "600" },

  // Sent state — centered within the remaining space, matching the app's other
  // confirmation screens.
  sentWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 24 },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(34, 195, 93, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  sentTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  sentBody: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 300,
  },
  sentEmail: { color: colors.text, fontWeight: "700" },
  sentBannerSlot: { alignSelf: "stretch", marginTop: 18 },
  hint: {
    color: colors.subtleText,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 14,
  },
  sentActions: { alignSelf: "stretch", marginTop: 26, gap: 4 },
});
