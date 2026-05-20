import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useShallow } from "zustand/react/shallow";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { CountryPicker } from "@/components/ui/CountryPicker";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import {
  ApiClientError,
  authApi,
  getErrorMessage,
  usersApi,
  type UserProfile as ApiUserProfile,
} from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

const TOTAL_STEPS = 3;
const TERMS_VERSION = "v1";

interface RestrictedItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}

/**
 * Mirrors `web app/safarly_web/src/customer/pages/CustomerOnboarding.tsx`.
 * Icons are mapped to the closest Ionicons equivalent so the mobile build
 * doesn't pull in a second icon font for one screen.
 */
const RESTRICTED_ITEMS: readonly RestrictedItem[] = [
  { icon: "laptop", label: "Electronics (laptops, phones, tablets, cameras)", color: "#3B82F6" },
  { icon: "water", label: "Liquids (>100ml bottles, perfumes, oils)", color: "#06B6D4" },
  { icon: "restaurant", label: "Perishable food items", color: "#F43F5E" },
  { icon: "cut", label: "Weapons or sharp objects", color: "#EF4444" },
  { icon: "ban", label: "Illegal items (drugs, counterfeit goods)", color: "#A855F7" },
  { icon: "paw", label: "Live animals or plants", color: "#22C55E" },
  { icon: "warning", label: "Hazardous materials", color: "#F97316" },
  { icon: "flame", label: "Flammable items", color: "#F59E0B" },
  { icon: "medkit", label: "Medications: Prescription only, with valid prescription copy", color: "#CA8A04" },
] as const;

type Step = 0 | 1 | 2;

export function ProfileSetupScreen() {
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

  // Step 1: terms
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [liabilityAccepted, setLiabilityAccepted] = useState(false);

  // Step 2: restricted items
  const [restrictedConfirmed, setRestrictedConfirmed] = useState(false);

  // Step 3: profile
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [bio, setBio] = useState("");

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
        showToast({
          title: "Couldn't load existing profile",
          message: getErrorMessage(err),
          variant: "warning",
        });
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
  };

  /**
   * Web behavior: a "Skip" finishes onboarding by accepting terms only.
   * "Complete" requires a name and saves the full profile + accepts terms.
   */
  const handleFinish = useCallback(
    async (skipProfile: boolean) => {
      if (submitting) return;
      if (!skipProfile && !name.trim()) {
        showToast({ title: "Name required", message: "Please enter your name.", variant: "error" });
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
        showToast({
          title: "Something went wrong",
          message: getErrorMessage(err),
          variant: "error",
        });
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [submitting, name, city, country, bio, user?.email, updateUserProfile, finishProfileSetup],
  );

  const goNext = useCallback(() => {
    if (step === 0 && termsAccepted && liabilityAccepted) setStep(1);
    else if (step === 1 && restrictedConfirmed) setStep(2);
  }, [step, termsAccepted, liabilityAccepted, restrictedConfirmed]);

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
    <Screen edges={["top", "right", "left", "bottom"]}>
      <View style={styles.container}>
        <Stepper step={step} />

        {step === 0 ? (
          <TermsStep
            termsAccepted={termsAccepted}
            onTerms={setTermsAccepted}
            liabilityAccepted={liabilityAccepted}
            onLiability={setLiabilityAccepted}
            onContinue={goNext}
          />
        ) : null}

        {step === 1 ? (
          <RestrictedItemsStep
            confirmed={restrictedConfirmed}
            onConfirm={setRestrictedConfirmed}
            onBack={goBack}
            onContinue={goNext}
          />
        ) : null}

        {step === 2 ? (
          <ProfileStep
            initials={initials}
            name={name}
            city={city}
            country={country}
            bio={bio}
            submitting={submitting}
            onName={setName}
            onCity={setCity}
            onCountry={setCountry}
            onBio={setBio}
            onBack={goBack}
            onComplete={() => handleFinish(false)}
            onSkip={() => handleFinish(true)}
          />
        ) : null}
      </View>
    </Screen>
  );
}

// ───────────────────────────── Stepper ─────────────────────────────

function Stepper({ step }: Readonly<{ step: Step }>) {
  return (
    <View style={styles.stepperRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <View key={i} style={styles.stepperCell}>
            <View
              style={[
                styles.stepperBubble,
                done || active ? styles.stepperBubbleActive : null,
              ]}
            >
              {done ? (
                <Ionicons name="checkmark" size={14} color={colors.white} />
              ) : (
                <Text style={[styles.stepperBubbleText, active ? styles.stepperBubbleTextActive : null]}>
                  {i + 1}
                </Text>
              )}
            </View>
            {i < TOTAL_STEPS - 1 ? (
              <View style={[styles.stepperLine, done ? styles.stepperLineActive : null]} />
            ) : null}
          </View>
        );
      })}
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
}

function TermsStep({
  termsAccepted,
  onTerms,
  liabilityAccepted,
  onLiability,
  onContinue,
}: Readonly<TermsStepProps>) {
  const canContinue = termsAccepted && liabilityAccepted;
  return (
    <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepIcon, styles.stepIconPrimary]}>
          <Ionicons name="shield-checkmark-outline" size={26} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Welcome to Safarly!</Text>
        <Text style={styles.stepSubtitle}>
          Before you get started, please review and accept our terms.
        </Text>
      </View>

      <View style={styles.termsBox}>
        <TermsParagraph
          heading="Platform Usage."
          body="Safarly connects travelers with people who need items shipped. By using our platform, you agree to use it responsibly and in accordance with local laws."
        />
        <TermsParagraph
          heading="Peer-to-Peer Nature."
          body="Safarly facilitates connections between senders and travelers. We do not physically handle, transport, or insure items. All arrangements are between users."
        />
        <TermsParagraph
          heading="User Responsibility."
          body="You are responsible for ensuring that the items you send or carry comply with all applicable laws, airline regulations, and customs requirements."
        />
        <TermsParagraph
          heading="Privacy."
          body="We collect and process personal data as described in our Privacy Policy. Your data is used to provide and improve our services."
        />
      </View>

      <View style={styles.linksRow}>
        <ExternalLink label="Full Terms of Service" url="https://safarly.com/terms" />
        <ExternalLink label="Privacy Policy" url="https://safarly.com/privacy" />
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

// ───────────────────────────── Step 2: Restricted Items ─────────────────────────────

interface RestrictedStepProps {
  confirmed: boolean;
  onConfirm: (v: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
}

function RestrictedItemsStep({
  confirmed,
  onConfirm,
  onBack,
  onContinue,
}: Readonly<RestrictedStepProps>) {
  return (
    <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepIcon, styles.stepIconDanger]}>
          <Ionicons name="alert-circle" size={26} color={colors.danger} />
        </View>
        <Text style={styles.stepTitle}>Restricted Items</Text>
        <Text style={styles.stepSubtitle}>
          For everyone's safety, certain items cannot be shipped through Safarly.
        </Text>
      </View>

      <View style={styles.restrictedList}>
        {RESTRICTED_ITEMS.map((item) => (
          <View key={item.label} style={styles.restrictedRow}>
            <Ionicons name={item.icon} size={20} color={item.color} />
            <Text style={styles.restrictedLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.checkboxColumn}>
        <Checkbox
          checked={confirmed}
          onChange={onConfirm}
          label="I confirm I will not send restricted items through Safarly"
        />
      </View>

      <View style={styles.buttonRow}>
        <BackButton onPress={onBack} />
        <PrimaryButton label="Continue" onPress={onContinue} disabled={!confirmed} flex />
      </View>
    </ScrollView>
  );
}

// ───────────────────────────── Step 3: Profile ─────────────────────────────

interface ProfileStepProps {
  initials: string;
  name: string;
  city: string;
  country: string | null;
  bio: string;
  submitting: boolean;
  onName: (v: string) => void;
  onCity: (v: string) => void;
  onCountry: (v: string) => void;
  onBio: (v: string) => void;
  onBack: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

function ProfileStep({
  initials,
  name,
  city,
  country,
  bio,
  submitting,
  onName,
  onCity,
  onCountry,
  onBio,
  onBack,
  onComplete,
  onSkip,
}: Readonly<ProfileStepProps>) {
  return (
    <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepIcon, styles.stepIconPrimary]}>
          <Ionicons name="person-outline" size={26} color={colors.primary} />
        </View>
        <Text style={styles.stepTitle}>Complete Your Profile</Text>
        <Text style={styles.stepSubtitle}>Help others trust you by completing your profile.</Text>
      </View>

      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
        {/* Avatar upload deferred — see report. */}
      </View>

      <View style={styles.formColumn}>
        <FieldBlock label="FULL NAME *">
          <TextInput
            value={name}
            onChangeText={onName}
            style={styles.input}
            placeholder="Your full name"
            placeholderTextColor={colors.subtleText}
            autoCapitalize="words"
            autoCorrect
            editable={!submitting}
            returnKeyType="next"
          />
        </FieldBlock>

        <View style={styles.gridRow}>
          <View style={styles.gridCol}>
            <FieldBlock label="CITY">
              <TextInput
                value={city}
                onChangeText={onCity}
                style={styles.input}
                placeholder="e.g. New York"
                placeholderTextColor={colors.subtleText}
                autoCapitalize="words"
                editable={!submitting}
              />
            </FieldBlock>
          </View>
          <View style={styles.gridCol}>
            <FieldBlock label="COUNTRY">
              <CountryPicker value={country} onChange={onCountry} disabled={submitting} />
            </FieldBlock>
          </View>
        </View>

        <FieldBlock label="SHORT BIO">
          <TextInput
            value={bio}
            onChangeText={onBio}
            style={[styles.input, styles.inputMultiline]}
            placeholder="Tell others about yourself…"
            placeholderTextColor={colors.subtleText}
            multiline
            textAlignVertical="top"
            editable={!submitting}
            maxLength={280}
          />
        </FieldBlock>
      </View>

      <View style={styles.buttonRow}>
        <BackButton onPress={onBack} disabled={submitting} />
        <PrimaryButton
          label="Complete Profile"
          onPress={onComplete}
          loading={submitting}
          flex
        />
      </View>
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

function ExternalLink({ label, url }: Readonly<{ label: string; url: string }>) {
  return (
    <Pressable
      onPress={() => {
        void Linking.openURL(url);
      }}
      hitSlop={4}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      <Text style={styles.externalLink}>
        {label} <Ionicons name="open" size={11} color={colors.primary} />
      </Text>
    </Pressable>
  );
}

function FieldBlock({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <View style={styles.fieldBlock}>
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
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.primaryButton,
        flex ? styles.primaryButtonFlex : null,
        (disabled || loading) && styles.primaryButtonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

function BackButton({ onPress, disabled }: Readonly<{ onPress: () => void; disabled?: boolean }>) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.backButton, disabled && styles.backButtonDisabled]}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="chevron-back" size={20} color={colors.text} />
    </Pressable>
  );
}

// ───────────────────────────── Styles ─────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },

  // Stepper
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    marginBottom: 18,
  },
  stepperCell: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepperBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBubbleActive: { backgroundColor: colors.primary },
  stepperBubbleText: { color: colors.mutedText, fontSize: 12, fontWeight: "700" },
  stepperBubbleTextActive: { color: colors.white },
  stepperLine: { width: 28, height: 2, borderRadius: 1, backgroundColor: colors.border },
  stepperLineActive: { backgroundColor: colors.primary },

  // Step shell
  stepScroll: { paddingBottom: 32 },
  stepHeader: { alignItems: "center", marginBottom: 18 },
  stepIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  stepIconPrimary: { backgroundColor: "rgba(255, 122, 38, 0.10)" },
  stepIconDanger: { backgroundColor: "rgba(239, 68, 68, 0.10)" },
  stepTitle: { color: colors.text, fontSize: 22, fontWeight: "800", textAlign: "center" },
  stepSubtitle: {
    color: colors.mutedText,
    fontSize: 14,
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
  termsText: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  linksRow: { flexDirection: "row", gap: 16, justifyContent: "center", marginBottom: 18 },
  externalLink: { color: colors.primary, fontSize: 12, fontWeight: "600" },

  // Restricted
  restrictedList: { gap: 8, marginBottom: 18 },
  restrictedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
  },
  restrictedLabel: { color: colors.text, fontSize: 13, fontWeight: "500", flex: 1 },

  // Checkboxes
  checkboxColumn: { gap: 12, marginBottom: 22 },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.controlOutline,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxBoxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxLabel: { color: colors.text, fontSize: 13, lineHeight: 19, flex: 1 },

  // Profile fields
  avatarWrap: { alignItems: "center", marginBottom: 20 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255, 122, 38, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: colors.primary, fontSize: 32, fontWeight: "800" },
  formColumn: { gap: 14, marginBottom: 18 },
  fieldBlock: { gap: 8 },
  fieldLabel: { color: colors.mutedText, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  input: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 16,
  },
  inputMultiline: { minHeight: 84, paddingTop: 12, paddingBottom: 12 },
  gridRow: { flexDirection: "row", gap: 10 },
  gridCol: { flex: 1 },

  // Buttons
  buttonRow: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 6 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primaryButtonFlex: { flex: 1 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonDisabled: { opacity: 0.5 },
  skipButton: { paddingVertical: 12, alignItems: "center" },
  skipButtonPressed: { opacity: 0.6 },
  skipText: { color: colors.mutedText, fontSize: 13, fontWeight: "600" },
  skipTextDisabled: { opacity: 0.5 },
});
