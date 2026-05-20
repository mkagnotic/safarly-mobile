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
import { RootStackParamList } from "@/navigation/types";
import { showToast } from "@/feedback/appFeedback";
import {
  ApiClientError,
  authApi,
  usersApi,
  type UserProfile as ApiUserProfile,
} from "@/services/api";
import { mapAuthError } from "@/services/auth/authErrors";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

const TERMS_VERSION = "v1";

type Step = 0 | 1;

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
   * Web behavior: a "Skip" finishes onboarding by accepting terms only.
   * "Complete" requires a name and saves the full profile + accepts terms.
   */
  const handleFinish = useCallback(
    async (skipProfile: boolean) => {
      if (submitting) return;
      setFormError(null);
      setNameError(null);
      if (!skipProfile && !name.trim()) {
        setNameError("Name is required");
        return;
      }
      setSubmitting(true);
      try {
        if (!skipProfile) {
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
        }
        await authApi.acceptTerms(TERMS_VERSION);
        finishProfileSetup();
        showToast({ title: "Welcome to Safarly!", variant: "success" });
      } catch (err) {
        setFormError(mapAuthError(err, "signup").message);
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [submitting, name, city, country, bio, avatarUrl, user?.email, updateUserProfile, finishProfileSetup],
  );

  const goNext = useCallback(() => {
    if (step === 0 && termsAccepted && liabilityAccepted) setStep(1);
  }, [step, termsAccepted, liabilityAccepted]);

  const goBack = useCallback(() => {
    if (step === 1) setStep(0);
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
            onComplete={() => handleFinish(false)}
            onSkip={() => handleFinish(true)}
          />
        ) : null}
      </View>
    </Screen>
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
    <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
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
    <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
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

        <View style={styles.gridRow}>
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
          <View style={styles.gridCol}>
            <FieldBlock label="Country">
              <CountryPicker value={country} onChange={onCountry} disabled={submitting} />
            </FieldBlock>
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

  // Buttons
  primaryButtonFlex: { flex: 1 },
  primaryButtonFull: { alignSelf: "stretch" },
  skipButton: { paddingVertical: 12, alignItems: "center" },
  skipButtonPressed: { opacity: 0.6 },
  skipText: { color: colors.ctaAccent, fontSize: 14, fontWeight: "700" },
  skipTextDisabled: { opacity: 0.5 },
});
