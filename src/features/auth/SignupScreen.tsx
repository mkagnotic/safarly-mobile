import { useCallback, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { mapAuthError } from "@/services/auth/authErrors";
import { colors } from "@/theme/colors";

interface Props {
  onSwitchToLogin: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Matches Supabase Auth's default minimum password length. */
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
  /** Form-level (server) error — already-registered, network, etc. */
  const [formError, setFormError] = useState<string | null>(null);

  const fullNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const clearError = useCallback(
    (key: keyof FormErrors) =>
      setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev)),
    [],
  );

  const validate = useCallback(
    (nextEmail: string): boolean => {
      const next: FormErrors = {};
      if (!fullName.trim()) next.fullName = "Name is required";
      if (!nextEmail) next.email = "Email is required";
      else if (!EMAIL_RE.test(nextEmail)) next.email = "Enter a valid email";
      if (!password) next.password = "Password is required";
      else if (password.length < PASSWORD_MIN) next.password = `Min ${PASSWORD_MIN} characters`;
      setErrors(next);
      // Standard pattern: focus the first invalid field on a failed submit.
      if (next.fullName) fullNameRef.current?.focus();
      else if (next.email) emailRef.current?.focus();
      else if (next.password) passwordRef.current?.focus();
      return Object.keys(next).length === 0;
    },
    [fullName, password],
  );

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setFormError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== email) setEmail(normalizedEmail);
    if (!validate(normalizedEmail)) return;
    setSubmitting(true);
    try {
      const { hasSession } = await signUpWithPassword(normalizedEmail, password, {
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
      const mapped = mapAuthError(err, "signup");
      if (mapped.target === "email") {
        setErrors((e) => ({ ...e, email: mapped.message }));
        emailRef.current?.focus();
      } else if (mapped.target === "password") {
        setErrors((e) => ({ ...e, password: mapped.message }));
        passwordRef.current?.focus();
      } else {
        setFormError(mapped.message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [submitting, validate, signUpWithPassword, email, password, fullName, phone, onSwitchToLogin]);

  return (
    <Screen edges={["top", "right", "left", "bottom"]} scroll={false}>
      {/* Screen already wraps in KeyboardAvoidingView; we add a ScrollView so
          the form stays reachable when the keyboard opens. flexGrow: 1 keeps
          marginTop:auto working (button pinned to bottom when there's room;
          scrollable when the keyboard shrinks the view). */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backButton}
              onPress={onSwitchToLogin}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              disabled={submitting}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.screenTitle}>Create account</Text>
          </View>

          <Text style={styles.subtitle}>
            Join Safarly and start connecting with travelers worldwide
          </Text>

          {formError ? (
            <View style={styles.bannerSlot}>
              <FormBanner message={formError} />
            </View>
          ) : null}

          <View style={styles.form}>
            <AppInput
              ref={fullNameRef}
              label="Full Name"
              value={fullName}
              onChangeText={(v) => {
                setFullName(v);
                clearError("fullName");
                if (formError) setFormError(null);
              }}
              placeholder="Enter your full name"
              autoCapitalize="words"
              autoCorrect
              editable={!submitting}
              error={errors.fullName}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
            <AppInput
              ref={emailRef}
              label="Email"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                clearError("email");
                if (formError) setFormError(null);
              }}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!submitting}
              error={errors.email}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <AppInput
              label="Phone (optional)"
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 234 567 8900"
              keyboardType="phone-pad"
              editable={!submitting}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <View>
              <AppInput
                ref={passwordRef}
                label="Password"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  clearError("password");
                  if (formError) setFormError(null);
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
            <AppButton
              label={submitting ? "Creating account…" : "Create account"}
              onPress={handleSubmit}
              disabled={submitting}
              gradientColors={[colors.ctaAccent, colors.ctaAccent]}
              leftIcon={
                submitting ? <ActivityIndicator size="small" color={colors.white} /> : undefined
              }
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Already have an account? </Text>
              <Pressable onPress={onSwitchToLogin} disabled={submitting} hitSlop={4}>
                <Text style={[styles.switchLink, submitting && styles.switchLinkDisabled]}>
                  Sign in
                </Text>
              </Pressable>
            </View>
            <Text style={styles.terms}>
              By creating an account, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /** flexGrow:1 keeps the inner container filling the scroll viewport so
   *  `marginTop: "auto"` on actions still pins the button to the bottom. */
  scrollContent: { flexGrow: 1 },
  // Shared visual structure with LoginScreen's email form (keep values in sync).
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
  subtitle: { color: colors.mutedText, fontSize: 14, lineHeight: 20, fontWeight: "500", marginBottom: 22 },
  bannerSlot: { marginBottom: 18 },
  form: { gap: 16, marginBottom: 24 },
  // Anchored to the input box itself: `top` clears the field label + its 8px
  // marginBottom; `height` matches AppInput's input (paddingVertical 12 + 1px
  // border + ~20px text) so the icon centers on the field, not the whole block.
  eyeToggle: {
    position: "absolute",
    right: 8,
    top: 24,
    height: 46,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { gap: 12, marginTop: "auto", paddingBottom: 28 },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  switchText: { color: colors.mutedText, fontSize: 14 },
  switchLink: { color: colors.ctaAccent, fontSize: 14, fontWeight: "700" },
  switchLinkDisabled: { opacity: 0.5 },
  terms: { color: colors.mutedText, textAlign: "center", fontSize: 12, marginTop: 4, lineHeight: 17 },
});
