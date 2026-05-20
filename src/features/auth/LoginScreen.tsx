import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafarlyMark } from "@/components/brand/SafarlyMark";
import { GoogleG } from "@/components/icons/GoogleG";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { AuthCancelledError, useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { RootStackParamList } from "@/navigation/types";
import { getErrorMessage } from "@/services/api";
import { mapAuthError } from "@/services/auth/authErrors";
import { mapOAuthError } from "@/services/auth/oauthErrors";
import { colors } from "@/theme/colors";

type Nav = NativeStackNavigationProp<RootStackParamList, "Login">;

type Mode = "choose" | "email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { signInWithPassword, signInWithGoogle } = useAuth();

  const goToSignup = useCallback(() => navigation.navigate("Signup"), [navigation]);

  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  /** Form-level (server) error — wrong credentials, network, etc. */
  const [formError, setFormError] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const bubbleFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(bubbleFloat, { toValue: -6, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bubbleFloat, { toValue: 6, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    float.start();
    return () => {
      float.stop();
    };
  }, [bubbleFloat]);

  const validate = useCallback((nextEmail: string, nextPassword: string) => {
    const next: { email?: string; password?: string } = {};
    if (!nextEmail.trim()) next.email = "Email is required";
    else if (!EMAIL_RE.test(nextEmail.trim())) next.email = "Enter a valid email";
    if (!nextPassword) next.password = "Password is required";
    else if (nextPassword.length < 6) next.password = "Min 6 characters";
    setErrors(next);
    // Standard pattern: move focus to the first invalid field on a failed submit.
    if (next.email) emailRef.current?.focus();
    else if (next.password) passwordRef.current?.focus();
    return Object.keys(next).length === 0;
  }, []);

  const handleSignIn = useCallback(async () => {
    if (submitting) return;
    setFormError(null);
    // Normalize before validating + sending so a stray space/case can't cause
    // a confusing "incorrect credentials".
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== email) setEmail(normalizedEmail);
    if (!validate(normalizedEmail, password)) return;
    setSubmitting(true);
    try {
      await signInWithPassword(normalizedEmail, password);
      // Navigation transition is driven by the AuthContext -> store -> RootNavigator.
      // No imperative navigate() needed here.
    } catch (err) {
      const mapped = mapAuthError(err, "signin");
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
  }, [email, password, signInWithPassword, submitting, validate]);

  const handleGoogleSignIn = useCallback(async () => {
    if (googleSubmitting) return;
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      // Like password sign-in: AuthContext -> store -> RootNavigator drives the
      // screen transition. No imperative navigate() here.
    } catch (err) {
      // User backed out of the Google sheet — not an error, stay quiet.
      if (err instanceof AuthCancelledError) return;
      showToast({
        title: "Google sign-in failed",
        message: getErrorMessage(err),
        variant: "error",
      });
    } finally {
      setGoogleSubmitting(false);
    }
  }, [googleSubmitting, signInWithGoogle]);

  const onComingSoon = useCallback(
    (provider: string) =>
      showToast({
        title: `${provider} sign-in coming soon`,
        message: "Use your email and password for now.",
        variant: "info",
      }),
    [],
  );

  if (mode === "email") {
    return (
      <Screen scroll={false} edges={["top", "right", "left", "bottom"]}>
        {/* Screen already wraps in KeyboardAvoidingView; we add a ScrollView so
            the form stays reachable when the keyboard opens. flexGrow: 1 keeps
            marginTop:auto pinning the button to the bottom when there's room,
            and lets the form scroll when the keyboard shrinks the view —
            avoiding the layout jump that caused the white flash during the
            keyboard-rise animation. */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authContainer}>
            <View style={styles.headerRow}>
              <Pressable
                style={styles.backButton}
                onPress={() => setMode("choose")}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                disabled={submitting}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>
              <Text style={styles.screenTitle}>Sign in</Text>
            </View>

            <Text style={styles.subtitle}>Welcome back. Sign in to continue.</Text>

            {formError ? (
              <View style={styles.bannerSlot}>
                <FormBanner message={formError} />
              </View>
            ) : null}

            <View style={styles.form}>
              <AppInput
                ref={emailRef}
                label="Email"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
                  if (formError) setFormError(null);
                }}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!submitting}
                error={errors.email}
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
                    if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
                    if (formError) setFormError(null);
                  }}
                  placeholder="Min 6 characters"
                  style={styles.passwordInput}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  editable={!submitting}
                  error={errors.password}
                  returnKeyType="go"
                  onSubmitEditing={handleSignIn}
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

            <View style={styles.authActions}>
              <AppButton
                label={submitting ? "Signing in…" : "Sign in"}
                onPress={handleSignIn}
                disabled={submitting}
                gradientColors={[colors.ctaAccent, colors.ctaAccent]}
                leftIcon={
                  submitting ? <ActivityIndicator size="small" color={colors.white} /> : undefined
                }
              />
              <View style={styles.authSwitchRow}>
                <Text style={styles.switchText}>Don't have an account? </Text>
                <Pressable onPress={goToSignup} disabled={submitting} hitSlop={4}>
                  <Text style={[styles.switchLink, submitting && styles.switchLinkDisabled]}>
                    Sign up
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.authTerms}>
                By signing in, you agree to our Terms of Service and Privacy Policy
              </Text>
            </View>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  // ≈ height of the absolutely-positioned `actions` block, so the hero content
  // centers in the visible area above the buttons (not behind them).
  const bottomBlockHeight = 290;
  return (
    <Screen scroll={false} edges={["top", "right", "left", "bottom"]}>
      <View style={[styles.wrap, { paddingTop: 8 }]}>
        <View style={[styles.center, { paddingBottom: bottomBlockHeight }]}>
          <View style={styles.logoBlock}>
            <View style={styles.logoWrap}>
              <SafarlyMark size={48} />
            </View>
            <Text style={styles.title}>Welcome to Safarly</Text>
            <Text style={styles.subtitleHero}>Send parcels with travelers. Save money. Build trust.</Text>
          </View>

          <View style={styles.illustration}>
            <Animated.Image
              source={require("../../assets/brand/Container.png")}
              style={[styles.heroImage, { transform: [{ translateY: bubbleFloat }] }]}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
        </View>

        <View style={[styles.actions, { paddingBottom: 28 }]}>
          <AppButton
            label="Continue with Email"
            variant="primary"
            onPress={() => setMode("email")}
            disabled={googleSubmitting}
            style={styles.ctaButton}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            leftIcon={<Ionicons name="mail-outline" size={18} color={colors.white} />}
          />
          <View style={styles.separatorRow}>
            <View style={styles.separator} />
            <Text style={styles.or}>or</Text>
            <View style={styles.separator} />
          </View>
          <AppButton
            label={googleSubmitting ? "Signing in…" : "Continue with Google"}
            onPress={handleGoogleSignIn}
            variant="dark"
            disabled={googleSubmitting}
            style={styles.ctaButton}
            leftIcon={
              googleSubmitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <GoogleG size={18} />
              )
            }
          />
          <AppButton
            label="Continue with Apple"
            onPress={() => onComingSoon("Apple")}
            variant="dark"
            disabled={googleSubmitting}
            style={[styles.ctaButton, styles.gap]}
            leftIcon={<Ionicons name="logo-apple" size={18} color={colors.white} />}
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>New to Safarly? </Text>
            <Pressable onPress={goToSignup} disabled={googleSubmitting} hitSlop={4}>
              <Text style={[styles.switchLink, googleSubmitting && styles.switchLinkDisabled]}>
                Create an account
              </Text>
            </Pressable>
          </View>
          <Text style={styles.terms}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /** flexGrow:1 keeps the inner container filling the scroll viewport so
   *  `marginTop: "auto"` on authActions still pins the button to the bottom
   *  when there's room. Mirrors the SignupScreen pattern. */
  scrollContent: { flexGrow: 1 },
  wrap: { flex: 1, justifyContent: "space-between" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 10,
    paddingTop: 56,
  },
  logoBlock: { alignItems: "center" },
  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  /** Standalone hero — no longer constrained by the old inner ring, so it can fill more of the area. */
  heroImage: { width: 260, height: 260 },
  title: { color: colors.wordmark, fontWeight: "800", fontSize: 30, textAlign: "center" },
  subtitleHero: {
    color: colors.mutedText,
    marginTop: 8,
    fontSize: 15,
    textAlign: "center",
    maxWidth: 280,
  },
  illustration: { marginTop: 32, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  actions: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20 },
  // Full-bleed within the container's 20px side padding — matches the
  // Create account / Sign in primary button width.
  ctaButton: { alignSelf: "stretch" },
  gap: { marginTop: 10 },
  separatorRow: { flexDirection: "row", alignItems: "center", marginVertical: 12, gap: 8 },
  separator: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.mutedText, fontSize: 12, fontWeight: "700" },
  terms: { color: colors.mutedText, textAlign: "center", marginTop: 14, fontSize: 12 },

  // Email form — shared visual structure with SignupScreen (keep values in sync).
  authContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
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
  passwordInput: { paddingRight: 44 },
  // Anchored to the input box (label + 8px margin = ~24px; AppInput box ≈ 46px)
  // so the icon centers on the field. Keep in sync with SignupScreen.
  eyeToggle: {
    position: "absolute",
    right: 8,
    top: 24,
    height: 46,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  authActions: { gap: 12, marginTop: "auto", paddingBottom: 28 },
  authSwitchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  authTerms: { color: colors.mutedText, textAlign: "center", fontSize: 12, lineHeight: 17, marginTop: 4 },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 16 },
  switchText: { color: colors.mutedText, fontSize: 14 },
  switchLink: { color: colors.ctaAccent, fontSize: 14, fontWeight: "700" },
  switchLinkDisabled: { opacity: 0.5 },
});
