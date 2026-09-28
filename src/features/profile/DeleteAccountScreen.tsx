import { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { AuthCancelledError, useAuth } from "@/context/AuthContext";
import { showAppAlert } from "@/feedback/appFeedback";
import { MainTabParamList } from "@/navigation/types";
import { ApiClientError, getErrorMessage } from "@/services/api/client";
import { usersApi, type AccountDeletionStatus } from "@/services/api/users";
import { requestAppleAuthorizationCode } from "@/services/auth/appleOAuth";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "DeleteAccountTab">;

type Step = "overview" | "verify";

/** Same seconds the server enforces between codes, so the button never lies. */
const RESEND_COOLDOWN_S = 60;

/**
 * Worded identically on web (`DeleteAccountView`) and in the email the server
 * sends. Keep them in step.
 */
const CONSEQUENCES = [
  "Your profile, trips, parcel requests and travel-buddy listings are removed.",
  "You're signed out on every device and push notifications stop.",
  "Messages and reviews you exchanged stay visible to the other person, shown as “Deleted user”.",
  "Records of completed deliveries and payments are kept, as the law requires.",
];

/**
 * Permanent account deletion — Profile → Security → Delete account.
 *
 * Required in-app by App Store Guideline 5.1.1(v) and Google Play's data
 * deletion policy; neither accepts "email support to delete your account".
 *
 * Flow, identical on Android and iOS:
 *   1. Explain what deletion does. If a delivery is in progress or money is
 *      held, say so up front instead of after the user has typed a password.
 *   2. Confirm it's the account holder: the password, or — for accounts created
 *      through Google or Apple, which have none — a 6-digit code emailed by the
 *      server. Verification happens server-side, so it cannot be skipped by
 *      calling the API directly.
 *   3. A final "are you sure" dialog.
 *   4. iOS accounts linked to Apple confirm once more with Apple, so the server
 *      can revoke Apple's tokens as Apple requires.
 *   5. Delete, clear this device's session, and show the confirmation screen.
 */
export function DeleteAccountScreen() {
  const navigation = useNavigation<Nav>();
  const { signOutAfterAccountDeletion } = useAuth();
  const setAccountDeleted = useAppStore((s) => s.setAccountDeleted);

  const [status, setStatus] = useState<AccountDeletionStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("overview");

  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("SecurityTab");
  }, [navigation]);

  const loadStatus = useCallback(async () => {
    setLoadError(null);
    try {
      const { data } = await usersApi.getAccountDeletionStatus();
      setStatus(data);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    }
  }, []);

  // This is a hidden tab, and tabs stay mounted. Reload the status every time
  // the screen is opened (a delivery may have finished meanwhile), and wipe the
  // typed password or code and the step on leaving, so nothing sensitive lingers
  // in memory and the flow always restarts from the warning.
  useFocusEffect(
    useCallback(() => {
      void loadStatus();
      return () => {
        setStep("overview");
        setPassword("");
        setCode("");
        setCodeSent(false);
        setResendIn(0);
        setFieldError(null);
        setError(null);
      };
    }, [loadStatus]),
  );

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const sendCode = useCallback(async () => {
    setError(null);
    setFieldError(null);
    setSendingCode(true);
    try {
      await usersApi.sendAccountDeletionCode();
      setCodeSent(true);
      setResendIn(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSendingCode(false);
    }
  }, []);

  const performDeletion = useCallback(async () => {
    if (!status) return;
    setError(null);
    setDeleting(true);
    try {
      let appleCode: string | null = null;
      if (status.apple_linked) {
        try {
          appleCode = await requestAppleAuthorizationCode();
        } catch (err) {
          if (err instanceof AuthCancelledError) {
            setError("Your account was not deleted. Confirm with Apple to finish deleting it.");
            return;
          }
          // Revocation is best-effort on the server too; an Apple hiccup must
          // not trap the user in an account they are trying to leave.
          appleCode = null;
        }
      }

      await usersApi.deleteMyAccount({
        ...(status.method === "password" ? { password } : { code: code.trim() }),
        ...(appleCode ? { apple_authorization_code: appleCode } : {}),
      });

      // Order matters: raise the flag first so the signed-out stack opens on
      // the confirmation screen rather than flashing Login.
      setAccountDeleted(true);
      await signOutAfterAccountDeletion();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "REAUTH_FAILED") {
        setFieldError(getErrorMessage(err));
      } else if (err instanceof ApiClientError && err.code === "CONFLICT") {
        // Something started since the status check (e.g. a new delivery).
        setStatus((s) => (s ? { ...s, blocked: true, blocked_reason: getErrorMessage(err) } : s));
        setStep("overview");
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setDeleting(false);
    }
  }, [status, password, code, setAccountDeleted, signOutAfterAccountDeletion]);

  const confirmAndDelete = useCallback(() => {
    setFieldError(null);
    if (status?.method === "password" && !password) {
      setFieldError("Enter your password to confirm.");
      return;
    }
    if (status?.method === "email_code" && code.replace(/\D/g, "").length !== 6) {
      setFieldError("Enter the 6-digit code we emailed you.");
      return;
    }
    showAppAlert({
      title: "Delete your account?",
      message: "This permanently deletes your Safarly account. You can't undo this.",
      actions: [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: () => void performDeletion() },
      ],
    });
  }, [status, password, code, performDeletion]);

  return (
    <Screen contentContainerStyle={styles.content} refreshEnabled={false}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backButton}
          onPress={step === "verify" && !deleting ? () => setStep("overview") : goBack}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle} accessibilityRole="header">
          Delete account
        </Text>
      </View>

      {error ? <FormBanner variant="error" message={error} onDismiss={() => setError(null)} /> : null}

      {!status && !loadError ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {loadError ? (
        <View style={styles.stack}>
          <FormBanner variant="error" title="Couldn't load your account" message={loadError} />
          <AppButton label="Try again" onPress={() => void loadStatus()} variant="secondary" />
        </View>
      ) : null}

      {status && step === "overview" ? (
        <View style={styles.stack}>
          <View style={styles.warningCard}>
            <View style={styles.warningIcon}>
              <Ionicons name="warning-outline" size={20} color={colors.danger} />
            </View>
            <Text style={styles.warningTitle}>This can't be undone</Text>
            <Text style={styles.warningBody}>
              Deleting your account is permanent. Your data can't be recovered, and if you sign up
              again later it will be a brand-new account.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>What happens</Text>
          <View style={styles.card}>
            {CONSEQUENCES.map((line, index) => (
              <View key={line} style={[styles.bulletRow, index < CONSEQUENCES.length - 1 && styles.bulletDivider]}>
                <Ionicons name="ellipse" size={6} color={colors.mutedText} style={styles.bulletDot} />
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
          </View>

          {status.blocked ? (
            <>
              <FormBanner
                variant="warning"
                title="You can't delete your account yet"
                message={status.blocked_reason ?? undefined}
              />
              <AppButton label="Back" onPress={goBack} variant="secondary" />
            </>
          ) : (
            <>
              <AppButton label="Continue" onPress={() => setStep("verify")} variant="danger" />
              <AppButton label="Keep my account" onPress={goBack} variant="secondary" />
            </>
          )}
        </View>
      ) : null}

      {status && step === "verify" ? (
        <View style={styles.stack}>
          <Text style={styles.verifyTitle}>Confirm it's you</Text>

          {status.method === "password" ? (
            <>
              <Text style={styles.verifyBody}>Enter your password to confirm.</Text>
              <AppInput
                label="Password"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setFieldError(null);
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={confirmAndDelete}
                editable={!deleting}
                error={fieldError ?? undefined}
              />
              <Pressable
                onPress={() => navigation.navigate("ForgotPasswordTab", { email: status.email ?? undefined })}
                disabled={deleting}
                accessibilityRole="link"
                style={styles.linkWrap}
              >
                <Text style={styles.link}>Forgot your password?</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.verifyBody}>
                {codeSent
                  ? `Enter the 6-digit code we sent to ${status.email ?? "your email"}.`
                  : `We'll email a 6-digit code to ${status.email ?? "your email"}.`}
              </Text>
              {codeSent ? (
                <>
                  <AppInput
                    label="Code"
                    value={code}
                    onChangeText={(v) => {
                      setCode(v.replace(/\D/g, "").slice(0, 6));
                      setFieldError(null);
                    }}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    returnKeyType="done"
                    onSubmitEditing={confirmAndDelete}
                    editable={!deleting}
                    error={fieldError ?? undefined}
                  />
                  <Pressable
                    onPress={() => void sendCode()}
                    disabled={resendIn > 0 || sendingCode || deleting}
                    accessibilityRole="button"
                    style={styles.linkWrap}
                  >
                    <Text style={[styles.link, (resendIn > 0 || sendingCode) && styles.linkDisabled]}>
                      {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <AppButton
                  label={sendingCode ? "Sending code…" : "Email me a code"}
                  onPress={() => void sendCode()}
                  loading={sendingCode}
                  disabled={sendingCode}
                  variant="secondary"
                />
              )}
            </>
          )}

          {status.method === "password" || codeSent ? (
            <AppButton
              label={deleting ? "Deleting account…" : "Delete my account"}
              onPress={confirmAndDelete}
              loading={deleting}
              disabled={deleting}
              variant="danger"
              style={styles.deleteButton}
            />
          ) : null}
          <AppButton label="Keep my account" onPress={goBack} disabled={deleting} variant="secondary" />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  stack: { gap: 14 },
  loading: { paddingVertical: 48, alignItems: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  screenTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  warningCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  warningIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(220, 40, 40, 0.10)",
  },
  warningTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  warningBody: { fontSize: 14, lineHeight: 20, color: colors.mutedText },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.mutedText,
    marginTop: 4,
  },
  card: { backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 16 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12 },
  bulletDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  bulletDot: { marginTop: 7 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
  verifyTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  verifyBody: { fontSize: 14, lineHeight: 20, color: colors.mutedText, marginTop: -6 },
  linkWrap: { alignSelf: "flex-start", paddingVertical: 4 },
  link: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  linkDisabled: { color: colors.mutedText },
  deleteButton: { marginTop: 6 },
});
