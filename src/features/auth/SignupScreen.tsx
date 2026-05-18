import { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafarlyMark } from "@/components/brand/SafarlyMark";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { getErrorMessage } from "@/services/api";
import { colors } from "@/theme/colors";

interface Props {
  onSwitchToLogin: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Supabase Auth's default minimum is 6; bump to 8 for stricter UX. */
const PASSWORD_MIN = 6;

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
}

export function SignupScreen({ onSwitchToLogin }: Readonly<Props>) {
  const { signUpWithPassword } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const clearError = useCallback(
    (key: keyof FormErrors) =>
      setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev)),
    [],
  );

  const validate = useCallback((): boolean => {
    const next: FormErrors = {};
    if (!fullName.trim()) next.fullName = "Name is required";
    if (!email.trim()) next.email = "Email is required";
    else if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email";
    if (!password) next.password = "Password is required";
    else if (password.length < PASSWORD_MIN) next.password = `Min ${PASSWORD_MIN} characters`;
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [fullName, email, password]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { hasSession } = await signUpWithPassword(email, password, {
        full_name: fullName,
        phone,
      });
      if (hasSession) {
        // AuthContext fires SIGNED_IN -> RootNavigator transitions to ProfileSetup.
        showToast({ title: "Account created!", variant: "success" });
        return;
      }
      // Email confirmation is required by the project — user must confirm
      // before they can sign in. Bounce them back to Login with a hint.
      showToast({
        title: "Check your email",
        message: "We sent you a confirmation link to finish setup.",
        variant: "info",
        duration: 5000,
      });
      onSwitchToLogin();
    } catch (err) {
      showToast({ title: "Sign up failed", message: getErrorMessage(err), variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [submitting, validate, signUpWithPassword, email, password, fullName, phone, onSwitchToLogin]);

  return (
    <Screen edges={["top", "right", "left", "bottom"]} scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <SafarlyMark size={42} />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join Safarly and start connecting with travelers worldwide
            </Text>
          </View>

          <View style={styles.form}>
            <AppInput
              label="Full Name"
              value={fullName}
              onChangeText={(v) => {
                setFullName(v);
                clearError("fullName");
              }}
              placeholder="Enter your full name"
              autoCapitalize="words"
              autoCorrect
              editable={!submitting}
              error={errors.fullName}
            />
            <AppInput
              label="Email"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                clearError("email");
              }}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!submitting}
              error={errors.email}
            />
            <AppInput
              label="Phone (optional)"
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 234 567 8900"
              keyboardType="phone-pad"
              editable={!submitting}
            />
            <View>
              <AppInput
                label="Password"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  clearError("password");
                }}
                placeholder={`Min ${PASSWORD_MIN} characters`}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                editable={!submitting}
                error={errors.password}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
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
          </View>

          <View style={styles.actions}>
            {submitting ? (
              <View style={[styles.submitButton, styles.submitButtonDisabled]}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : (
              <AppButton label="Create Account" onPress={handleSubmit} />
            )}
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Already have an account? </Text>
              <Pressable onPress={onSwitchToLogin} disabled={submitting} hitSlop={4}>
                <Text style={[styles.switchLink, submitting && styles.switchLinkDisabled]}>
                  Sign In
                </Text>
              </Pressable>
            </View>
            <Text style={styles.terms}>
              By creating an account, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20 },
  header: { alignItems: "center", marginTop: 24, marginBottom: 28 },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { color: colors.text, fontWeight: "800", fontSize: 26, textAlign: "center" },
  subtitle: { color: colors.mutedText, marginTop: 8, fontSize: 14, textAlign: "center", maxWidth: 280 },
  form: { gap: 16, marginBottom: 24 },
  eyeToggle: { position: "absolute", right: 12, top: 36, padding: 4 },
  actions: { gap: 12, marginTop: "auto", paddingBottom: 12 },
  submitButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: { opacity: 0.7 },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  switchText: { color: colors.mutedText, fontSize: 14 },
  switchLink: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  switchLinkDisabled: { opacity: 0.5 },
  terms: { color: colors.mutedText, textAlign: "center", fontSize: 12, marginTop: 4, lineHeight: 17 },
});
