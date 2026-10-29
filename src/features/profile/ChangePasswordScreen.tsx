import { useCallback, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { FormBanner } from "@/components/ui/FormBanner";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { MainTabParamList } from "@/navigation/types";
import { authApi, getErrorMessage } from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "ChangePasswordTab">;

// The shared rule (passwordPolicy): 8+ characters with letters and numbers - the
// same as sign-up, reset and the server (27 Oct 2026; change used to demand upper
// AND lower case too). Mirrors web's AccountSecuritySettings.handleChangePassword.
const MIN_LEN = 8;
function validateNewPassword(current: string, next: string): string | null {
  if (next.length < MIN_LEN) return `Password must be at least ${MIN_LEN} characters`;
  if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return "Use both letters and numbers";
  if (current && current === next) return "New password must be different from current";
  return null;
}

type Errors = { current?: string; next?: string; confirm?: string };

export function ChangePasswordScreen() {
  const navigation = useNavigation<Nav>();
  const { user, signOut } = useAuth();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const currentRef = useRef<TextInput>(null);
  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const mountedRef = useRef(true);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("SecurityTab");
  }, [navigation]);

  const clearFormError = () => {
    if (formError) setFormError(null);
  };

  const validate = useCallback((): boolean => {
    const nextErrors: Errors = {};
    if (!current.trim()) nextErrors.current = "Current password is required";
    nextErrors.next = validateNewPassword(current, next) ?? undefined;
    if (!nextErrors.next && confirm !== next) nextErrors.confirm = "Passwords do not match";
    setErrors(nextErrors);
    if (nextErrors.current) currentRef.current?.focus();
    else if (nextErrors.next) nextRef.current?.focus();
    else if (nextErrors.confirm) confirmRef.current?.focus();
    return !nextErrors.current && !nextErrors.next && !nextErrors.confirm;
  }, [current, next, confirm]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await authApi.changePassword(current, next);
      if (!mountedRef.current) return;
      // Rare ("Secure password change" with an old login): the server had to sign
      // out every device, this one too, so sign in again now rather than later.
      if (res.data?.signed_out_here) {
        showToast({ title: "Password changed", message: "Sign in with your new password.", variant: "success" });
        await signOut();
        return;
      }
      showToast({
        title: "Password changed",
        // The server now ends every other session (27 Oct 2026): say so
        message: res.data?.signed_out_others
          ? "You're still signed in here. Your other devices have been signed out."
          : "Use your new password next time you sign in.",
        variant: "success",
      });
      goBack();
    } catch (err) {
      if (!mountedRef.current) return;
      const message = getErrorMessage(err);
      // A wrong current password goes on its field, not a banner. For an account
      // made with Google or Apple the server explains how to set a password; keep that.
      if (/current password|wrong|incorrect/i.test(message)) {
        setErrors((e) => ({ ...e, current: /Google or Apple/.test(message) ? message : "That's not your current password." }));
        currentRef.current?.focus();
      } else {
        setFormError(message);
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [submitting, validate, current, next, goBack, signOut]);

  return (
    <Screen contentContainerStyle={styles.content} refreshEnabled={false}>
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
        <Text style={styles.screenTitle}>Change password</Text>
      </View>

      <Text style={styles.subtitle}>Enter your current password, then choose a new one.</Text>

      {formError ? (
        <View style={styles.bannerSlot}>
          <FormBanner message={formError} onDismiss={() => setFormError(null)} />
        </View>
      ) : null}

      <AppInput
        ref={currentRef}
        label="Current password"
        value={current}
        onChangeText={(v) => {
          setCurrent(v);
          if (errors.current) setErrors((e) => ({ ...e, current: undefined }));
          clearFormError();
        }}
        placeholder="Enter current password"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        editable={!submitting}
        error={errors.current}
        returnKeyType="next"
        onSubmitEditing={() => nextRef.current?.focus()}
      />

      <Pressable
        onPress={() => navigation.navigate("ForgotPasswordTab", { email: user?.email })}
        accessibilityRole="button"
        disabled={submitting}
      >
        <Text style={styles.forgotText}>Forgot current password?</Text>
      </Pressable>

      <View style={styles.newPasswordWrap}>
        <AppInput
          ref={nextRef}
          label="New password"
          value={next}
          onChangeText={(v) => {
            setNext(v);
            if (errors.next) setErrors((e) => ({ ...e, next: undefined }));
            clearFormError();
          }}
          placeholder="Enter a new password"
          hint="At least 8 characters, with letters and numbers"
          secureTextEntry={!showNew}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password-new"
          textContentType="newPassword"
          editable={!submitting}
          error={errors.next}
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          style={styles.passwordInput}
        />
        <Pressable
          style={styles.eyeToggle}
          onPress={() => setShowNew((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showNew ? "Hide password" : "Show password"}
          hitSlop={8}
        >
          <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={20} color={colors.mutedText} />
        </Pressable>
      </View>

      <PasswordStrengthMeter password={next} />

      <AppInput
        ref={confirmRef}
        label="Confirm new password"
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          if (errors.confirm) setErrors((e) => ({ ...e, confirm: undefined }));
          clearFormError();
        }}
        placeholder="Re-enter your new password"
        secureTextEntry={!showNew}
        autoCapitalize="none"
        autoCorrect={false}
        // Same hints as the field above, so iOS strong-password autofill fills both.
        autoComplete="password-new"
        textContentType="newPassword"
        editable={!submitting}
        error={errors.confirm}
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        style={styles.confirmInput}
      />

      <AppButton
        label={submitting ? "Updating…" : "Update password"}
        onPress={handleSubmit}
        disabled={submitting}
        gradientColors={[colors.ctaAccent, colors.ctaAccent]}
        leftIcon={submitting ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 28 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    marginBottom: 14,
    minHeight: 34,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  bannerSlot: { marginBottom: 14 },
  forgotText: {
    color: colors.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  newPasswordWrap: { marginTop: 10 },
  passwordInput: { paddingRight: 44 },
  confirmInput: { marginTop: 6 },
  eyeToggle: {
    position: "absolute",
    right: 8,
    top: 24,
    height: 46,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: { marginTop: 22 },
});
