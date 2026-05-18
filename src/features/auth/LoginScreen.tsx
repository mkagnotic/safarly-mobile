import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafarlyMark } from "@/components/brand/SafarlyMark";
import { GoogleG } from "@/components/icons/GoogleG";
import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { RootStackParamList } from "@/navigation/types";
import { getErrorMessage } from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = NativeStackNavigationProp<RootStackParamList, "Login">;

/** Same fill as the big visual inner circle (`ringInner`). */
const HERO_INNER_PEACH = "#F0DDC8";
const HERO_INNER_RING_BORDER = "rgba(255, 252, 248, 0.95)";

type Mode = "choose" | "email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { signInWithPassword } = useAuth();

  const goToSignup = useCallback(() => navigation.navigate("Signup"), [navigation]);

  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const bubbleFloat = useRef(new Animated.Value(0)).current;
  const bubbleSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(bubbleFloat, { toValue: -6, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bubbleFloat, { toValue: 6, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const spin = Animated.loop(
      Animated.sequence([
        Animated.timing(bubbleSpin, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bubbleSpin, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    float.start();
    spin.start();
    return () => {
      float.stop();
      spin.stop();
    };
  }, [bubbleFloat, bubbleSpin]);

  const bubbleRotate = bubbleSpin.interpolate({ inputRange: [0, 1], outputRange: ["-5deg", "5deg"] });

  const validate = useCallback((nextEmail: string, nextPassword: string) => {
    const next: { email?: string; password?: string } = {};
    if (!nextEmail.trim()) next.email = "Email is required";
    else if (!EMAIL_RE.test(nextEmail.trim())) next.email = "Enter a valid email";
    if (!nextPassword) next.password = "Password is required";
    else if (nextPassword.length < 6) next.password = "Min 6 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  }, []);

  const handleSignIn = useCallback(async () => {
    if (submitting) return;
    if (!validate(email, password)) return;
    setSubmitting(true);
    try {
      await signInWithPassword(email, password);
      // Navigation transition is driven by the AuthContext -> store -> RootNavigator.
      // No imperative navigate() needed here.
    } catch (err) {
      showToast({ title: "Sign in failed", message: getErrorMessage(err), variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [email, password, signInWithPassword, submitting, validate]);

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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <View style={styles.emailWrap}>
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

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
                }}
                style={[styles.input, errors.email ? styles.inputError : null]}
                placeholder="you@example.com"
                placeholderTextColor={colors.subtleText}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!submitting}
                returnKeyType="next"
              />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <View>
                <TextInput
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
                  }}
                  style={[styles.input, styles.inputWithIcon, errors.password ? styles.inputError : null]}
                  placeholder="Min 6 characters"
                  placeholderTextColor={colors.subtleText}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  editable={!submitting}
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
                    size={18}
                    color={colors.mutedText}
                  />
                </Pressable>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            <Pressable
              style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
              onPress={handleSignIn}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Sign in</Text>
              )}
            </Pressable>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Don't have an account? </Text>
              <Pressable onPress={goToSignup} disabled={submitting} hitSlop={4}>
                <Text style={[styles.switchLink, submitting && styles.switchLinkDisabled]}>
                  Sign up
                </Text>
              </Pressable>
            </View>

            <Text style={styles.terms}>
              By signing in, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </KeyboardAvoidingView>
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
            <Animated.View style={[styles.ringOuter, { transform: [{ translateY: bubbleFloat }] }]}>
              <View style={styles.ringInner}>
                <View style={styles.heroMark}>
                  <Image
                    source={require("../../assets/brand/team.png")}
                    style={styles.heroImage}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                </View>
              </View>
              <Animated.View
                style={[styles.floatingBadge, styles.floatingMint, { transform: [{ rotate: bubbleRotate }] }]}
              >
                <Text style={styles.badgeText}>📦</Text>
              </Animated.View>
              <Animated.View
                style={[
                  styles.floatingBadge,
                  styles.floatingTravelBubble,
                  { transform: [{ rotate: bubbleRotate }] },
                ]}
              >
                <Text style={styles.badgeText}>✈️</Text>
              </Animated.View>
            </Animated.View>
          </View>
        </View>

        <View style={[styles.actions, { paddingBottom: 28 }]}>
          <AppButton
            label="Continue with Email"
            variant="primary"
            onPress={() => setMode("email")}
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
            label="Continue with Google"
            onPress={() => onComingSoon("Google")}
            variant="dark"
            style={styles.ctaButton}
            leftIcon={<GoogleG size={18} />}
          />
          <AppButton
            label="Continue with Apple"
            onPress={() => onComingSoon("Apple")}
            variant="dark"
            style={[styles.ctaButton, styles.gap]}
            leftIcon={<Ionicons name="logo-apple" size={18} color={colors.white} />}
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>New to Safarly? </Text>
            <Pressable onPress={goToSignup} hitSlop={4}>
              <Text style={styles.switchLink}>Create an account</Text>
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
  heroMark: { alignItems: "center", justifyContent: "center" },
  /** Sized to sit inside the 112px inner ring (4px border) with margin to spare. */
  heroImage: { width: 88, height: 88 },
  title: { color: colors.wordmark, fontWeight: "800", fontSize: 30, textAlign: "center" },
  subtitleHero: {
    color: colors.mutedText,
    marginTop: 8,
    fontSize: 15,
    textAlign: "center",
    maxWidth: 280,
  },
  illustration: { marginTop: 32, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  ringOuter: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: "#F5EFE6",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ringInner: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: HERO_INNER_PEACH,
    borderWidth: 4,
    borderColor: HERO_INNER_RING_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingBadge: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  floatingMint: { right: -6, top: -6, backgroundColor: "#D8F0E5" },
  floatingTravelBubble: {
    left: -6,
    bottom: -6,
    backgroundColor: HERO_INNER_PEACH,
    borderWidth: 0,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  badgeText: { fontSize: 18 },
  actions: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20 },
  ctaButton: { alignSelf: "center", width: "88%", maxWidth: 340 },
  gap: { marginTop: 10 },
  separatorRow: { flexDirection: "row", alignItems: "center", marginVertical: 12, gap: 8 },
  separator: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.mutedText, fontSize: 12, fontWeight: "700" },
  terms: { color: colors.mutedText, textAlign: "center", marginTop: 14, fontSize: 12 },

  // Email mode
  emailWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
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
  screenTitle: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 14, lineHeight: 20, fontWeight: "500", marginBottom: 22 },
  fieldBlock: { marginBottom: 16 },
  fieldLabel: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500",
    paddingHorizontal: 16,
  },
  inputWithIcon: { paddingRight: 44 },
  inputError: { borderWidth: 1, borderColor: colors.danger },
  eyeToggle: { position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: "500", marginTop: 6 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: colors.white, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 16 },
  switchText: { color: colors.mutedText, fontSize: 14 },
  switchLink: { color: colors.ctaAccent, fontSize: 14, fontWeight: "700" },
  switchLinkDisabled: { opacity: 0.5 },
});
