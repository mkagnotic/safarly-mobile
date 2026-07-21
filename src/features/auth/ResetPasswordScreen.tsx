import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { FormBanner } from "@/components/ui/FormBanner";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { Screen } from "@/components/ui/Screen";
import { createRecoveryClient } from "@/integrations/supabase/recoveryClient";
import type { RootStackParamList } from "@/navigation/types";
import {
  PASSWORD_HINT,
  validatePassword,
  validatePasswordConfirm,
} from "@/features/auth/passwordPolicy";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";
import { sanitizeDigitsOnly } from "@/utils/inputSanitizers";

/** Supabase emails a 6-digit recovery OTP. */
const CODE_LENGTH = 6;

type Nav = NativeStackNavigationProp<RootStackParamList, "ResetPassword">;
type Route = RouteProp<RootStackParamList, "ResetPassword">;

export function ResetPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const email = route.params.email;
  const setPendingNotice = useAppStore((s) => s.setPendingNotice);

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const codeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const validate = useCallback(() => {
    const next: { code?: string; password?: string; confirm?: string } = {};
    if (code.length !== CODE_LENGTH) next.code = `Enter the ${CODE_LENGTH}-digit code`;
    next.password = validatePassword(password) ?? undefined;
    next.confirm = validatePasswordConfirm(password, confirm) ?? undefined;
    setErrors(next);
    if (next.code) codeRef.current?.focus();
    else if (next.password) passwordRef.current?.focus();
    else if (next.confirm) confirmRef.current?.focus();
    return !next.code && !next.password && !next.confirm;
  }, [code, password, confirm]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    // Isolated client: the recovery session must not reach the shared client,
    // or AuthContext would sign the user in and navigate away mid-request.
    const recovery = createRecoveryClient();
    try {
      const { error: verifyError } = await recovery.auth.verifyOtp({
        email,
        token: code,
        type: "recovery",
      });
      if (verifyError) {
        if (!mountedRef.current) return;
        setErrors((e) => ({ ...e, code: "That code is invalid or has expired" }));
        codeRef.current?.focus();
        return;
      }

      const { error: updateError } = await recovery.auth.updateUser({ password });
      if (updateError) {
        if (!mountedRef.current) return;
        setFormError(updateError.message || "Couldn't update your password. Please try again.");
        return;
      }

      // A reset implies the old password may be compromised, so drop every
      // session for this user on all devices. Same as web's reset page.
      await recovery.auth.signOut({ scope: "global" });

      // Hand the confirmation to Login — this screen is about to unmount.
      setPendingNotice({
        target: "login",
        variant: "success",
        title: "Password updated",
        message: "Sign in with your new password.",
      });
      navigation.popToTop();
    } catch (err) {
      if (!mountedRef.current) return;
      setFormError(
        err instanceof Error && err.message
          ? "Can't reach the server. Check your connection and try again."
          : "Something went wrong. Please try again.",
      );
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [submitting, validate, email, code, password, navigation, setPendingNotice]);

  const clearFormError = () => {
    if (formError) setFormError(null);
  };

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
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.screenTitle}>Set a new password</Text>
          </View>

          <Text style={styles.subtitle}>
            Enter the {CODE_LENGTH}-digit code we sent to{" "}
            <Text style={styles.email}>{email}</Text>, then choose a new password.
          </Text>

          {formError ? (
            <View style={styles.bannerSlot}>
              <FormBanner message={formError} />
            </View>
          ) : null}

          <AppInput
            ref={codeRef}
            label="Verification code"
            value={code}
            onChangeText={(v) => {
              setCode(sanitizeDigitsOnly(v, CODE_LENGTH));
              if (errors.code) setErrors((e) => ({ ...e, code: undefined }));
              clearFormError();
            }}
            // No placeholder: this field is styled large/bold/wide-tracked, so
            // any sample digits read as an already-entered code. The label and
            // the sentence above it already say what goes here.
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            editable={!submitting}
            error={errors.code}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            style={styles.codeInput}
          />

          <View>
            <AppInput
              ref={passwordRef}
              label="New password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
                clearFormError();
              }}
              placeholder="Enter a new password"
              hint={PASSWORD_HINT}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password-new"
              editable={!submitting}
              error={errors.password}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              style={styles.passwordInput}
            />
            <Pressable
              style={styles.eyeToggle}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              hitSlop={8}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.mutedText}
              />
            </Pressable>
          </View>

          <PasswordStrengthMeter password={password} />

          <AppInput
            ref={confirmRef}
            label="Confirm new password"
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              if (errors.confirm) setErrors((e) => ({ ...e, confirm: undefined }));
              clearFormError();
            }}
            placeholder="Re-enter your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            error={errors.confirm}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          <View style={styles.actions}>
            <AppButton
              label={submitting ? "Updating…" : "Update password"}
              onPress={handleSubmit}
              disabled={submitting}
              gradientColors={[colors.ctaAccent, colors.ctaAccent]}
              leftIcon={
                submitting ? <ActivityIndicator size="small" color={colors.white} /> : undefined
              }
            />
            <Text style={styles.note}>
              You'll be signed out on all devices and can sign in again with your new password.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

// Header/title/subtitle values are shared with LoginScreen, SignupScreen and
// ForgotPasswordScreen — keep them in sync.
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
  // Wide tracking makes a 6-digit code easy to scan back against the email.
  codeInput: { fontSize: 20, letterSpacing: 6, fontWeight: "700" },
  passwordInput: { paddingRight: 44 },
  eyeToggle: {
    position: "absolute",
    right: 8,
    top: 24,
    height: 46,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { gap: 12, marginTop: 8, paddingBottom: 28 },
  note: {
    color: colors.subtleText,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
