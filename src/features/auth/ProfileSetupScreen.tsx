import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useShallow } from "zustand/react/shallow";

import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { AvatarUpload } from "@/components/ui/AvatarUpload";
import { CountryPicker } from "@/components/ui/CountryPicker";
import { FormBanner } from "@/components/ui/FormBanner";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/AuthContext";
import { ONBOARDING_COUNTRIES } from "@/features/profile/countries";
import { RootStackParamList } from "@/navigation/types";
import {
  ApiClientError,
  authApi,
  getErrorMessage,
  paymentsApi,
  usersApi,
  type StripeConnectStatus,
  type UserProfile as ApiUserProfile,
} from "@/services/api";
import { mapAuthError } from "@/services/auth/authErrors";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

const TERMS_VERSION = "v1";

/** 0 Terms, 1 Profile, 2 Payout (optional). Mirrors web's onboarding. */
type Step = 0 | 1 | 2;

const TOTAL_STEPS = 3;

type Nav = NativeStackNavigationProp<RootStackParamList, "ProfileSetup">;

export function ProfileSetupScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { updateUserProfile, finishProfileSetup } = useAppStore(
    useShallow((s) => ({
      updateUserProfile: s.updateUserProfile,
      finishProfileSetup: s.finishProfileSetup,
    })),
  );

  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Terms step
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [liabilityAccepted, setLiabilityAccepted] = useState(false);

  // Profile step
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Payout step
  const [payoutStatus, setPayoutStatus] = useState<StripeConnectStatus | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    void hydrateProfile();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Pre-fill the profile step from the server so a mid-flow user doesn't lose data. */
  const hydrateProfile = async () => {
    try {
      const res = await usersApi.getMyProfile();
      if (!mountedRef.current) return;
      const profile = res.data?.profile;
      if (profile) prefill(profile);
    } catch (err) {
      // 404 is expected for a fresh signup with no profile row yet.
      if (!(err instanceof ApiClientError) || err.status !== 404) {
        setFormError(mapAuthError(err, "signup").message);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const prefill = (profile: ApiUserProfile) => {
    setName(profile.name ?? "");
    setBio(profile.bio ?? "");
    setCity(profile.city ?? "");
    setCountry(profile.country ?? null);
    setAvatarUrl(profile.avatar_url ?? null);
  };

  /**
   * Step 1 -> Step 2. Mirrors web's `handleProfileNext`: "Skip" advances
   * without saving, "Complete" requires a name and persists first. Terms are
   * accepted on the final step either way, so abandoning here re-runs setup
   * rather than stranding a half-onboarded account.
   */
  const handleProfileNext = useCallback(
    async (skipProfile: boolean) => {
      if (submitting) return;
      setFormError(null);
      setNameError(null);
      if (skipProfile) {
        setStep(2);
        return;
      }
      if (!name.trim()) {
        setNameError("Name is required");
        return;
      }
      setSubmitting(true);
      try {
        const res = await usersApi.updateMyProfile({
          name: name.trim(),
          city: city.trim() || undefined,
          country: country ?? undefined,
          bio: bio.trim() || undefined,
          avatar_url: avatarUrl ?? undefined,
        });
        const saved = res.data;
        updateUserProfile({
          fullName: saved?.name ?? name.trim(),
          bio: saved?.bio ?? bio.trim(),
          city: saved?.city ?? city.trim(),
          country: saved?.country ?? country ?? "",
          email: user?.email ?? "",
          kycStatus: (saved?.kyc_status as never) ?? "not_started",
        });
        if (mountedRef.current) setStep(2);
      } catch (err) {
        if (mountedRef.current) setFormError(mapAuthError(err, "signup").message);
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [submitting, name, city, country, bio, avatarUrl, user?.email, updateUserProfile],
  );

  /**
   * Accept the terms exactly once, and always BEFORE handing off to Stripe.
   * If a user bails out of Stripe's hosted flow, their terms are already
   * recorded, so they land in the app instead of being bounced back through
   * setup. Idempotent via the ref so a retry after a failed hand-off doesn't
   * re-post it.
   */
  /** Non-fatal: the payout screen in Profile re-checks this later anyway. */
  const refreshPayoutStatus = useCallback(async () => {
    try {
      const res = await paymentsApi.stripeConnectStatus();
      if (mountedRef.current) setPayoutStatus(res.data ?? null);
    } catch {
      // Leave the step in its default "not set up" state.
    }
  }, []);

  // Read the real status when the payout step opens, so a user who already
  // onboarded (e.g. re-running setup) isn't asked to do it again.
  useEffect(() => {
    if (step === 2 && !payoutStatus) void refreshPayoutStatus();
  }, [step, payoutStatus, refreshPayoutStatus]);

  const termsCommitted = useRef(false);
  const commitTerms = useCallback(async (): Promise<boolean> => {
    if (termsCommitted.current) return true;
    try {
      await authApi.acceptTerms(TERMS_VERSION);
      termsCommitted.current = true;
      return true;
    } catch (err) {
      if (mountedRef.current) setFormError(mapAuthError(err, "signup").message);
      return false;
    }
  }, []);

  const handleSetUpPayouts = useCallback(async () => {
    if (submitting) return;
    setFormError(null);
    setSubmitting(true);
    try {
      if (!(await commitTerms())) return;
      const res = await paymentsApi.stripeConnectOnboard();
      const url = res.data?.onboarding_url;
      if (!url) {
        if (mountedRef.current) setFormError("Couldn't start payout setup. Please try again.");
        return;
      }
      // Stripe's `return_url` is built from APP_URL server-side, so it lands on
      // the *web* payout page — there is no deep link back into the app. The
      // browser closing is therefore our only signal, and the server is the
      // authority on what actually happened, so we just re-read the status.
      await WebBrowser.openBrowserAsync(url);
      if (!mountedRef.current) return;
      await refreshPayoutStatus();
    } catch (err) {
      if (mountedRef.current) setFormError(getErrorMessage(err));
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [submitting, commitTerms, refreshPayoutStatus]);

  /** "I'll do this later" / "Continue" — commit terms and enter the app. */
  const handleFinishSetup = useCallback(async () => {
    if (submitting) return;
    setFormError(null);
    setSubmitting(true);
    try {
      if (await commitTerms()) finishProfileSetup();
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [submitting, commitTerms, finishProfileSetup]);

  const goNext = useCallback(() => {
    if (step === 0 && termsAccepted && liabilityAccepted) setStep(1);
  }, [step, termsAccepted, liabilityAccepted]);

  const goBack = useCallback(() => {
    if (step === 1) setStep(0);
    else if (step === 2) setStep(1);
  }, [step]);

  const initials = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return "?";
    return trimmed
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [name]);

  if (loading) {
    return <LoadingScreen message="Loading your profile…" />;
  }

  return (
    <Screen edges={["top", "right", "left", "bottom"]} scroll={false}>
      <View style={styles.container}>
        <StepIndicator current={step} />

        {step === 0 ? (
          <TermsStep
            termsAccepted={termsAccepted}
            onTerms={setTermsAccepted}
            liabilityAccepted={liabilityAccepted}
            onLiability={setLiabilityAccepted}
            onContinue={goNext}
            onShowTerms={() => navigation.navigate("TermsOfService")}
            onShowPrivacy={() => navigation.navigate("PrivacyPolicy")}
          />
        ) : null}

        {step === 1 ? (
          <ProfileStep
            userId={user?.id ?? ""}
            initials={initials}
            name={name}
            city={city}
            country={country}
            bio={bio}
            avatarUrl={avatarUrl}
            submitting={submitting}
            formError={formError}
            nameError={nameError}
            onClearFormError={() => setFormError(null)}
            onClearNameError={() => setNameError(null)}
            onName={setName}
            onCity={setCity}
            onCountry={setCountry}
            onBio={setBio}
            onAvatar={setAvatarUrl}
            onBack={goBack}
            onComplete={() => handleProfileNext(false)}
            onSkip={() => handleProfileNext(true)}
          />
        ) : null}

        {step === 2 ? (
          <PayoutStep
            status={payoutStatus}
            submitting={submitting}
            formError={formError}
            onBack={goBack}
            onSetUp={handleSetUpPayouts}
            onFinish={handleFinishSetup}
          />
        ) : null}
      </View>
    </Screen>
  );
}

// ───────────────────────────── Step indicator ─────────────────────────────

/** Numbered rail with a check on completed steps — mirrors web's onboarding. */
function StepIndicator({ current }: Readonly<{ current: Step }>) {
  return (
    <View style={styles.stepRail} accessibilityLabel={`Step ${current + 1} of ${TOTAL_STEPS}`}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View key={`step-${i}`} style={styles.stepRailItem}>
          <View style={[styles.stepDot, i <= current && styles.stepDotActive]}>
            {i < current ? (
              <Ionicons name="checkmark" size={14} color={colors.white} />
            ) : (
              <Text style={[styles.stepDotText, i === current && styles.stepDotTextActive]}>
                {i + 1}
              </Text>
            )}
          </View>
          {i < TOTAL_STEPS - 1 ? (
            <View style={[styles.stepBar, i < current && styles.stepBarActive]} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

// ───────────────────────────── Step 1: Terms ─────────────────────────────

interface TermsStepProps {
  termsAccepted: boolean;
  onTerms: (v: boolean) => void;
  liabilityAccepted: boolean;
  onLiability: (v: boolean) => void;
  onContinue: () => void;
  onShowTerms: () => void;
  onShowPrivacy: () => void;
}

const TERMS_SUMMARY: readonly Readonly<{ heading: string; body: string }>[] = [
  {
    heading: "Platform usage.",
    body: "Safarly connects individuals who need to send items with travelers willing to carry them, and enables travel companionship between users.",
  },
  {
    heading: "Peer-to-peer nature.",
    body: "Safarly facilitates connections only — we don't physically handle, transport, or store items. All arrangements are between users.",
  },
  {
    heading: "User responsibility.",
    body: "You're responsible for providing accurate information, complying with applicable laws and airline rules, and not sending prohibited or illegal items.",
  },
  {
    heading: "Privacy.",
    body: "We process personal data as described in our Privacy Policy. Tap below to read the full policy.",
  },
];

function TermsStep({
  termsAccepted,
  onTerms,
  liabilityAccepted,
  onLiability,
  onContinue,
  onShowTerms,
  onShowPrivacy,
}: Readonly<TermsStepProps>) {
  const canContinue = termsAccepted && liabilityAccepted;
  return (
    <ScrollView
      contentContainerStyle={styles.stepScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.stepHeader}>
        <View style={[styles.stepIcon, styles.stepIconPrimary]}>
          <Ionicons name="shield-checkmark-outline" size={26} color={colors.ctaAccent} />
        </View>
        <Text style={styles.stepTitle}>Welcome to Safarly!</Text>
        <Text style={styles.stepSubtitle}>
          Before you get started, please review and accept our terms.
        </Text>
      </View>

      <View style={styles.termsBox}>
        {TERMS_SUMMARY.map((item) => (
          <TermsParagraph key={item.heading} heading={item.heading} body={item.body} />
        ))}
      </View>

      <View style={styles.linksRow}>
        <InAppLink label="Full Terms of Service" onPress={onShowTerms} />
        <InAppLink label="Privacy Policy" onPress={onShowPrivacy} />
      </View>

      <View style={styles.checkboxColumn}>
        <Checkbox
          checked={termsAccepted}
          onChange={onTerms}
          label="I agree to the Terms of Service and Privacy Policy"
        />
        <Checkbox
          checked={liabilityAccepted}
          onChange={onLiability}
          label="I understand that Safarly is a peer-to-peer platform and is not liable for items in transit"
        />
      </View>

      <PrimaryButton label="Continue" onPress={onContinue} disabled={!canContinue} />
    </ScrollView>
  );
}

function TermsParagraph({ heading, body }: Readonly<{ heading: string; body: string }>) {
  return (
    <Text style={styles.termsText}>
      <Text style={styles.termsHeading}>{heading} </Text>
      {body}
    </Text>
  );
}

// ───────────────────────────── Profile step ─────────────────────────────

interface ProfileStepProps {
  userId: string;
  initials: string;
  name: string;
  city: string;
  country: string | null;
  bio: string;
  avatarUrl: string | null;
  submitting: boolean;
  formError: string | null;
  nameError: string | null;
  onClearFormError: () => void;
  onClearNameError: () => void;
  onName: (v: string) => void;
  onCity: (v: string) => void;
  onCountry: (v: string) => void;
  onBio: (v: string) => void;
  onAvatar: (url: string | null) => void;
  onBack: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

function ProfileStep({
  userId,
  initials,
  name,
  city,
  country,
  bio,
  avatarUrl,
  submitting,
  formError,
  nameError,
  onClearFormError,
  onClearNameError,
  onName,
  onCity,
  onCountry,
  onBio,
  onAvatar,
  onBack,
  onComplete,
  onSkip,
}: Readonly<ProfileStepProps>) {
  return (
    <ScrollView
      contentContainerStyle={styles.stepScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.authHeaderRow}>
        <Pressable
          style={styles.authBackButton}
          onPress={onBack}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.authTitle}>Complete profile</Text>
      </View>
      <Text style={styles.authSubtitle}>Help others trust you by completing your profile.</Text>

      {formError ? (
        <View style={styles.bannerSlot}>
          <FormBanner message={formError} />
        </View>
      ) : null}

      <View style={styles.avatarWrap}>
        <AvatarUpload
          userId={userId}
          initials={initials}
          currentUrl={avatarUrl}
          onChange={(url) => {
            onAvatar(url);
            if (formError) onClearFormError();
          }}
          disabled={submitting}
        />
      </View>

      <View style={styles.formColumn}>
        <AppInput
          label="Full name *"
          value={name}
          onChangeText={(v) => {
            onName(v);
            if (nameError) onClearNameError();
            if (formError) onClearFormError();
          }}
          placeholder="Your full name"
          autoCapitalize="words"
          autoCorrect
          editable={!submitting}
          returnKeyType="next"
          error={nameError ?? undefined}
        />

        {/* Country before City — matches web's onboarding step, and reads in the
            natural narrowing order (country, then the city within it). */}
        <View style={styles.gridRow}>
          <View style={styles.gridCol}>
            <FieldBlock label="Country">
              <CountryPicker
                value={country}
                onChange={onCountry}
                disabled={submitting}
                options={ONBOARDING_COUNTRIES}
              />
            </FieldBlock>
          </View>
          <View style={styles.gridCol}>
            <AppInput
              label="City"
              value={city}
              onChangeText={onCity}
              placeholder="e.g. New York"
              autoCapitalize="words"
              editable={!submitting}
            />
          </View>
        </View>

        <AppInput
          label="Short bio"
          value={bio}
          onChangeText={onBio}
          placeholder="Tell others about yourself…"
          multiline
          editable={!submitting}
          maxLength={280}
        />
      </View>

      <PrimaryButton
        label="Complete profile"
        onPress={onComplete}
        loading={submitting}
      />
      <Pressable
        onPress={onSkip}
        disabled={submitting}
        style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Skip for now"
      >
        <Text style={[styles.skipText, submitting && styles.skipTextDisabled]}>Skip for now</Text>
      </Pressable>
    </ScrollView>
  );
}

// ───────────────────────────── Payout step ─────────────────────────────

interface PayoutStepProps {
  status: StripeConnectStatus | null;
  submitting: boolean;
  formError: string | null;
  onBack: () => void;
  onSetUp: () => void;
  onFinish: () => void;
}

/**
 * Optional final step: connect a Stripe account so this user can be paid for
 * carrying parcels. Anyone can skip — senders never need it, and carriers are
 * prompted again at the point it actually blocks them (accepting an offer).
 */
function PayoutStep({
  status,
  submitting,
  formError,
  onBack,
  onSetUp,
  onFinish,
}: Readonly<PayoutStepProps>) {
  const connected = !!status?.connected;
  const pending = !connected && !!status?.details_submitted;

  return (
    <ScrollView
      contentContainerStyle={styles.stepScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.authHeaderRow}>
        <Pressable
          style={styles.authBackButton}
          onPress={onBack}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.authTitle}>How you get paid</Text>
      </View>

      <Text style={styles.authSubtitle}>
        Planning to carry parcels for others? Connect a bank account so you can accept deliveries
        and receive your earnings. You can always do this later from your profile.
      </Text>

      {formError ? (
        <View style={styles.bannerSlot}>
          <FormBanner message={formError} />
        </View>
      ) : null}

      {connected ? (
        <View style={styles.payoutNotice}>
          <View style={[styles.payoutIcon, styles.payoutIconSafe]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.safe} />
          </View>
          <Text style={styles.payoutNoticeText}>
            <Text style={styles.payoutNoticeStrong}>Payouts are set up.</Text> You're ready to accept
            deliveries and get paid.
          </Text>
        </View>
      ) : (
        <View style={styles.payoutNotice}>
          <View style={styles.payoutIcon}>
            <Ionicons name="cash-outline" size={18} color={colors.ctaAccent} />
          </View>
          <Text style={styles.payoutNoticeText}>
            {pending ? (
              <>
                <Text style={styles.payoutNoticeStrong}>Verification in progress.</Text> Stripe is
                still reviewing your details — this usually takes a few minutes.
              </>
            ) : (
              <>
                Payouts are handled securely by{" "}
                <Text style={styles.payoutNoticeStrong}>Stripe</Text>. It's free to connect, and you
                only need it when someone books you to carry their parcel. Senders don't need this.
              </>
            )}
          </Text>
        </View>
      )}

      {connected ? (
        <PrimaryButton label="Continue" onPress={onFinish} loading={submitting} />
      ) : (
        <>
          <PrimaryButton
            label={pending ? "Continue setup" : "Set up payouts"}
            onPress={onSetUp}
            loading={submitting}
          />
          <Pressable
            onPress={onFinish}
            disabled={submitting}
            style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="I'll do this later"
          >
            <Text style={[styles.skipText, submitting && styles.skipTextDisabled]}>
              I'll do this later
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

// ───────────────────────────── Shared UI primitives ─────────────────────────────

function Checkbox({
  checked,
  onChange,
  label,
}: Readonly<{ checked: boolean; onChange: (v: boolean) => void; label: string }>) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      style={styles.checkboxRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.checkboxBox, checked ? styles.checkboxBoxChecked : null]}>
        {checked ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

function InAppLink({ label, onPress }: Readonly<{ label: string; onPress: () => void }>) {
  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="link" accessibilityLabel={label}>
      <Text style={styles.externalLink}>
        {label} <Ionicons name="chevron-forward" size={12} color={colors.ctaAccent} />
      </Text>
    </Pressable>
  );
}

function FieldBlock({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  flex,
}: Readonly<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  flex?: boolean;
}>) {
  return (
    <AppButton
      label={label}
      onPress={onPress}
      disabled={disabled || loading}
      gradientColors={[colors.ctaAccent, colors.ctaAccent]}
      style={flex ? styles.primaryButtonFlex : styles.primaryButtonFull}
      leftIcon={loading ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
    />
  );
}

// ───────────────────────────── Styles ─────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },

  stepScroll: { paddingBottom: 28 },
  stepHeader: { alignItems: "center", marginTop: 24, marginBottom: 18 },

  // Shared auth-screen header — keep values in sync with LoginScreen / SignupScreen.
  authHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 18,
    minHeight: 34,
    gap: 12,
  },
  authBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  authTitle: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  authSubtitle: { color: colors.mutedText, fontSize: 14, lineHeight: 20, fontWeight: "500", marginBottom: 22 },
  bannerSlot: { marginBottom: 18 },
  stepIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  stepIconPrimary: { backgroundColor: "rgba(255, 122, 38, 0.10)" },
  stepTitle: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800", textAlign: "center" },
  stepSubtitle: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 6,
    lineHeight: 20,
  },

  // Terms — no maxHeight: fixed height caused overflow to paint over checkboxes (RN overflow).
  termsBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 14,
    overflow: "hidden",
  },
  termsHeading: { color: colors.text, fontWeight: "700" },
  termsText: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  linksRow: { flexDirection: "row", gap: 16, justifyContent: "center", marginBottom: 18 },
  externalLink: { color: colors.ctaAccent, fontSize: 14, fontWeight: "700" },

  // Checkboxes
  checkboxColumn: { gap: 12, marginBottom: 22 },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.ctaAccent,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxBoxChecked: { backgroundColor: colors.ctaAccent, borderColor: colors.ctaAccent },
  checkboxLabel: { color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 },

  // Profile fields
  avatarWrap: { alignItems: "center", marginBottom: 20 },
  formColumn: { gap: 14, marginBottom: 18 },
  fieldLabel: { color: colors.mutedText, fontSize: 12, fontWeight: "600", marginBottom: 8 },
  gridRow: { flexDirection: "row", gap: 10 },
  gridCol: { flex: 1 },

  // Step indicator
  stepRail: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12 },
  stepRailItem: { flexDirection: "row", alignItems: "center" },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: { backgroundColor: colors.ctaAccent },
  stepDotText: { color: colors.mutedText, fontSize: 12, fontWeight: "800" },
  stepDotTextActive: { color: colors.white },
  stepBar: { width: 32, height: 2, borderRadius: 1, backgroundColor: colors.surfaceMuted, marginHorizontal: 6 },
  stepBarActive: { backgroundColor: colors.ctaAccent },

  // Payout step
  payoutNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
    marginBottom: 22,
  },
  payoutIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255, 122, 38, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  payoutIconSafe: { backgroundColor: "rgba(34, 195, 93, 0.12)" },
  payoutNoticeText: { flex: 1, color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  payoutNoticeStrong: { color: colors.text, fontWeight: "700" },

  // Buttons
  primaryButtonFlex: { flex: 1 },
  primaryButtonFull: { alignSelf: "stretch" },
  skipButton: { paddingVertical: 12, alignItems: "center" },
  skipButtonPressed: { opacity: 0.6 },
  skipText: { color: colors.ctaAccent, fontSize: 14, fontWeight: "700" },
  skipTextDisabled: { opacity: 0.5 },
});
