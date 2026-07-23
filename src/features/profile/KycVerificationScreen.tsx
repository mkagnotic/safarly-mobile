import { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { useKycStatus } from "@/hooks/api/useKycStatus";
import { useSubmitKyc } from "@/hooks/api/useSubmitKyc";
import { kycExtFromMime, validateKycAsset } from "@/features/profile/kycValidation";
import { RootStackParamList } from "@/navigation/types";
import { getErrorMessage, type KycDocType } from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = NativeStackNavigationProp<RootStackParamList, "KycVerification">;

const DOC_TYPES: { value: KycDocType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "passport", label: "Passport", icon: "airplane-outline" },
  { value: "drivers_license", label: "Driver's License", icon: "car-outline" },
  { value: "national_id", label: "National ID", icon: "id-card-outline" },
];

type PickedFile = { uri: string; mimeType: string | null; ext: string };
type Banner = { variant: "error" | "warning" | "success" | "info"; title: string; message?: string };
type Slot = "doc" | "selfie";

function docLabel(value: string): string {
  return DOC_TYPES.find((d) => d.value === value)?.label ?? value;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function KycVerificationScreen() {
  const navigation = useNavigation<Nav>();
  const kyc = useKycStatus();
  const { submit, submitting, error: submitError, clearError } = useSubmitKyc();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [docType, setDocType] = useState<KycDocType>("passport");
  const [docFile, setDocFile] = useState<PickedFile | null>(null);
  const [selfieFile, setSelfieFile] = useState<PickedFile | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  // Re-read status on focus so an async approval/rejection reflects without a relaunch.
  useFocusEffect(
    useCallback(() => {
      void kyc.refetch();
    }, [kyc.refetch]),
  );

  useEffect(() => {
    if (!submitError) return;
    setBanner({ variant: "error", title: "Couldn't submit", message: getErrorMessage(submitError) });
  }, [submitError]);

  const pickImage = useCallback(async (slot: Slot) => {
    setBanner(null);
    clearError();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        setBanner({
          variant: "warning",
          title: "Permission needed",
          message: "Allow photo access to upload your verification documents.",
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      const rejection = validateKycAsset({ mimeType: asset.mimeType, fileSize: asset.fileSize });
      if (rejection) {
        setBanner({ variant: "error", title: rejection.title, message: rejection.message });
        return;
      }

      const file: PickedFile = { uri: asset.uri, mimeType: asset.mimeType ?? null, ext: kycExtFromMime(asset.mimeType) };
      if (slot === "doc") setDocFile(file);
      else setSelfieFile(file);
    } catch (err) {
      setBanner({ variant: "error", title: "Couldn't open photos", message: getErrorMessage(err) });
    }
  }, [clearError]);

  const removeFile = useCallback((slot: Slot) => {
    if (slot === "doc") setDocFile(null);
    else setSelfieFile(null);
  }, []);

  const resetWizard = useCallback(() => {
    setStep(1);
    setDocFile(null);
    setSelfieFile(null);
    setReplacing(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    setBanner(null);
    clearError();
    if (!docFile || !selfieFile) {
      setBanner({ variant: "warning", title: "Documents required", message: "Please upload both your ID document and a selfie." });
      return;
    }
    const status = await submit({ docType, doc: docFile, selfie: selfieFile });
    if (status) {
      resetWizard();
      setBanner({ variant: "success", title: "Submitted", message: "Documents submitted for review." });
      void kyc.refetch();
    }
  }, [docFile, selfieFile, docType, submit, resetWizard, clearError, kyc.refetch]);

  const startReplace = useCallback(() => {
    setBanner(null);
    resetWizard();
    setReplacing(true);
  }, [resetWizard]);

  const cancelReplace = useCallback(() => {
    resetWizard();
    setReplacing(false);
  }, [resetWizard]);

  // Visibility (web parity §3.5). showActionNeeded covers rejected + any unknown
  // non-verified/non-pending status (e.g. admin "resubmission requested").
  const showForm = (!kyc.isVerified && !kyc.isPending) || (kyc.isPending && replacing);
  const showIntro = kyc.isNotStarted && !replacing;
  const showActionNeeded = kyc.isRejected;
  const reviewNotes =
    kyc.submission?.review_notes ??
    "Your verification wasn't approved. Please review and resubmit your documents.";

  return (
    <Screen contentContainerStyle={styles.screenContent}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>Identity Verification</Text>
      </View>

      {banner ? (
        <View style={styles.bannerSlot}>
          <FormBanner
            variant={banner.variant}
            title={banner.title}
            message={banner.message}
            onDismiss={() => setBanner(null)}
          />
        </View>
      ) : null}

      {kyc.loading && kyc.status === "" && !kyc.submission ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centeredBody}>Loading verification status…</Text>
        </View>
      ) : kyc.error && kyc.status === "" ? (
        <Card style={styles.panel}>
          <Ionicons name="cloud-offline-outline" size={34} color={colors.mutedText} />
          <Text style={styles.panelTitle}>Couldn't load status</Text>
          <Text style={styles.panelBody}>{getErrorMessage(kyc.error)}</Text>
          <AppButton label="Try again" onPress={() => void kyc.refetch()} style={styles.panelButton} />
        </Card>
      ) : kyc.isVerified ? (
        <VerifiedCard />
      ) : kyc.isPending && !replacing ? (
        <PendingCard submission={kyc.submission} onReplace={startReplace} />
      ) : showForm ? (
        <>
          {showActionNeeded ? (
            <View style={styles.bannerSlot}>
              <FormBanner variant="warning" title="Action needed" message={reviewNotes} />
            </View>
          ) : null}

          {showIntro ? <IntroCard /> : null}

          {replacing ? (
            <View style={styles.replaceRow}>
              <Text style={styles.replaceLabel}>Replacing documents</Text>
              <Pressable onPress={cancelReplace} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={styles.cancelLink}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}

          <StepIndicator step={step} />

          {step === 1 ? (
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Document type</Text>
              <View style={styles.docTypeList}>
                {DOC_TYPES.map((d) => {
                  const active = d.value === docType;
                  return (
                    <Pressable
                      key={d.value}
                      style={[styles.docTypeRow, active && styles.docTypeRowActive]}
                      onPress={() => setDocType(d.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={d.label}
                    >
                      <Ionicons name={d.icon} size={18} color={active ? colors.primary : colors.mutedText} />
                      <Text style={[styles.docTypeLabel, active && styles.docTypeLabelActive]}>{d.label}</Text>
                      <Ionicons
                        name={active ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={active ? colors.primary : colors.subtleText}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.cardTitle, styles.uploadHeading]}>Upload {docLabel(docType)}</Text>
              <UploadSlot
                file={docFile}
                label="Take or upload a clear photo of your document"
                onPick={() => void pickImage("doc")}
                onRemove={() => removeFile("doc")}
              />
            </Card>
          ) : null}

          {step === 2 ? (
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Selfie with ID</Text>
              <Text style={styles.cardSubtitle}>
                Take a photo of yourself holding your ID document next to your face, with both clearly visible.
              </Text>
              <UploadSlot
                file={selfieFile}
                label="Upload a selfie holding your ID"
                onPick={() => void pickImage("selfie")}
                onRemove={() => removeFile("selfie")}
              />
            </Card>
          ) : null}

          {step === 3 ? (
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Review & submit</Text>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Document</Text>
                <Text style={styles.reviewValue}>{docLabel(docType)}</Text>
              </View>
              <View style={styles.reviewThumbs}>
                <ReviewThumb file={docFile} caption="Document" />
                <ReviewThumb file={selfieFile} caption="Selfie" />
              </View>
              <View style={styles.privacyNote}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.mutedText} />
                <Text style={styles.privacyText}>
                  Your documents are stored privately and used only to verify your identity.
                </Text>
              </View>
            </Card>
          ) : null}

          <WizardNav
            step={step}
            submitting={submitting}
            canAdvance={step === 1 ? !!docFile : step === 2 ? !!selfieFile : !!docFile && !!selfieFile}
            onBack={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
            onNext={() => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}
            onSubmit={() => void handleSubmit()}
          />
        </>
      ) : null}
    </Screen>
  );
}

// ───────────────────────────── Sub-components ─────────────────────────────

function VerifiedCard() {
  return (
    <View style={styles.statusCard}>
      <View style={[styles.statusIconWrap, { backgroundColor: colors.safe }]}>
        <Ionicons name="checkmark" size={34} color={colors.white} />
      </View>
      <Text style={styles.statusHeadline}>Identity Verified</Text>
      <Text style={styles.statusDescription}>
        Your identity has been verified. You have full access to all features.
      </Text>
    </View>
  );
}

function PendingCard({
  submission,
  onReplace,
}: Readonly<{ submission: ReturnType<typeof useKycStatus>["submission"]; onReplace: () => void }>) {
  return (
    <>
      <View style={styles.statusCard}>
        <View style={[styles.statusIconWrap, { backgroundColor: colors.warning }]}>
          <Ionicons name="time-outline" size={32} color={colors.white} />
        </View>
        <Text style={styles.statusHeadline}>Under Review</Text>
        <Text style={styles.statusDescription}>
          We're reviewing your documents. This usually takes 1–2 business days — you'll be notified once it's complete.
        </Text>
      </View>

      {submission ? (
        <Card style={styles.card}>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Document</Text>
            <Text style={styles.reviewValue}>{docLabel(submission.doc_type)}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Submitted</Text>
            <Text style={styles.reviewValue}>{formatDate(submission.submitted_at)}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Reviewed</Text>
            <Text style={styles.reviewValue}>{formatDate(submission.reviewed_at)}</Text>
          </View>
        </Card>
      ) : null}

      <AppButton label="Replace documents" variant="secondary" onPress={onReplace} style={styles.replaceButton} />
    </>
  );
}

function IntroCard() {
  const points = [
    "Have your passport, driver's license, or national ID ready.",
    "You'll upload a photo of the document and a selfie holding it.",
    "Use JPG, PNG, or WebP images under 10MB.",
  ];
  return (
    <Card style={[styles.card, styles.introCard]}>
      <Text style={styles.cardTitle}>Before you start</Text>
      {points.map((p) => (
        <View key={p} style={styles.introRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.safe} />
          <Text style={styles.introText}>{p}</Text>
        </View>
      ))}
    </Card>
  );
}

function StepIndicator({ step }: Readonly<{ step: 1 | 2 | 3 }>) {
  const labels = ["ID Document", "Selfie", "Review"];
  return (
    <View style={styles.stepper}>
      {labels.map((label, i) => {
        const index = (i + 1) as 1 | 2 | 3;
        const done = index < step;
        const active = index === step;
        return (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
              {done ? (
                <Ionicons name="checkmark" size={13} color={colors.white} />
              ) : (
                <Text style={[styles.stepNum, active && styles.stepNumActive]}>{index}</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, (active || done) && styles.stepLabelActive]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function UploadSlot({
  file,
  label,
  onPick,
  onRemove,
}: Readonly<{ file: PickedFile | null; label: string; onPick: () => void; onRemove: () => void }>) {
  if (file) {
    return (
      <View style={styles.previewWrap}>
        <Image source={{ uri: file.uri }} style={styles.previewImage} accessibilityIgnoresInvertColors />
        <Pressable style={styles.previewRemove} onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remove" hitSlop={6}>
          <Ionicons name="close" size={15} color={colors.white} />
        </Pressable>
        <Pressable style={styles.previewChange} onPress={onPick} accessibilityRole="button" accessibilityLabel="Change photo">
          <Ionicons name="camera-outline" size={14} color={colors.white} />
          <Text style={styles.previewChangeText}>Change</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <Pressable style={styles.dropzone} onPress={onPick} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.dropzoneIcon}>
        <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
      </View>
      <Text style={styles.dropzoneLabel}>{label}</Text>
      <Text style={styles.dropzoneHint}>JPG, PNG or WebP · up to 10MB</Text>
    </Pressable>
  );
}

function ReviewThumb({ file, caption }: Readonly<{ file: PickedFile | null; caption: string }>) {
  return (
    <View style={styles.reviewThumbWrap}>
      {file ? (
        <Image source={{ uri: file.uri }} style={styles.reviewThumb} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.reviewThumb, styles.reviewThumbEmpty]}>
          <Ionicons name="image-outline" size={20} color={colors.subtleText} />
        </View>
      )}
      <Text style={styles.reviewThumbCaption}>{caption}</Text>
    </View>
  );
}

function WizardNav({
  step,
  submitting,
  canAdvance,
  onBack,
  onNext,
  onSubmit,
}: Readonly<{
  step: 1 | 2 | 3;
  submitting: boolean;
  canAdvance: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}>) {
  return (
    <View style={styles.wizardNav}>
      {step > 1 ? (
        <AppButton label="Back" variant="secondary" onPress={onBack} style={styles.navButton} />
      ) : null}
      {step < 3 ? (
        <AppButton
          label="Continue"
          onPress={onNext}
          disabled={!canAdvance}
          gradientColors={[colors.ctaAccent, colors.ctaAccent]}
          style={styles.navButtonGrow}
        />
      ) : (
        <AppButton
          label={submitting ? "Submitting…" : "Submit for review"}
          onPress={onSubmit}
          disabled={submitting || !canAdvance}
          gradientColors={[colors.ctaAccent, colors.ctaAccent]}
          leftIcon={submitting ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
          style={styles.navButtonGrow}
        />
      )}
    </View>
  );
}

// ───────────────────────────── Styles ─────────────────────────────

const styles = StyleSheet.create({
  screenContent: { paddingBottom: 32 },
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

  bannerSlot: { marginBottom: 14 },

  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 64, gap: 12 },
  centeredBody: { color: colors.mutedText, fontSize: 13, fontWeight: "500" },

  panel: { borderRadius: 16, alignItems: "center", paddingVertical: 28, paddingHorizontal: 18, gap: 8 },
  panelTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 6 },
  panelBody: { color: colors.mutedText, fontSize: 13, textAlign: "center", maxWidth: 280, lineHeight: 18 },
  panelButton: { marginTop: 8, alignSelf: "stretch" },

  // Status cards (verified / pending)
  statusCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    marginBottom: 14,
  },
  statusIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  statusHeadline: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800", textAlign: "center", marginBottom: 10 },
  statusDescription: { color: colors.mutedText, fontSize: 15, lineHeight: 22, fontWeight: "500", textAlign: "center", maxWidth: 320 },

  // Generic card
  card: { borderRadius: 16, marginBottom: 14, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 10 },
  cardSubtitle: { color: colors.mutedText, fontSize: 13, lineHeight: 19, marginBottom: 12, marginTop: -4 },
  uploadHeading: { marginTop: 18 },

  introCard: { gap: 10 },
  introRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  introText: { flex: 1, color: colors.mutedText, fontSize: 14, lineHeight: 20 },

  replaceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  replaceLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  cancelLink: { color: colors.ctaAccent, fontSize: 14, fontWeight: "700" },
  replaceButton: { marginTop: 2 },

  // Stepper
  stepper: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, paddingHorizontal: 4 },
  stepItem: { flex: 1, alignItems: "center", gap: 6 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepDotDone: { backgroundColor: colors.safe },
  stepNum: { color: colors.mutedText, fontSize: 13, fontWeight: "800" },
  stepNumActive: { color: colors.white },
  stepLabel: { color: colors.subtleText, fontSize: 11, fontWeight: "700" },
  stepLabelActive: { color: colors.text },

  // Doc type selector
  docTypeList: { gap: 8 },
  docTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  docTypeRowActive: { borderColor: colors.primary, backgroundColor: colors.surfaceTintPrimary },
  docTypeLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  docTypeLabelActive: { fontWeight: "800" },

  // Dropzone / preview
  dropzone: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 26,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 6,
  },
  dropzoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  dropzoneLabel: { color: colors.text, fontSize: 14, fontWeight: "700", textAlign: "center" },
  dropzoneHint: { color: colors.subtleText, fontSize: 12, fontWeight: "500" },

  previewWrap: { borderRadius: 14, overflow: "hidden", position: "relative" },
  previewImage: { width: "100%", height: 200, backgroundColor: colors.surfaceMuted },
  previewRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(15,15,25,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewChange: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(15,15,25,0.6)",
  },
  previewChangeText: { color: colors.white, fontSize: 12, fontWeight: "700" },

  // Review
  reviewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  reviewLabel: { color: colors.mutedText, fontSize: 14 },
  reviewValue: { color: colors.text, fontSize: 14, fontWeight: "700" },
  reviewThumbs: { flexDirection: "row", gap: 12, marginTop: 4 },
  reviewThumbWrap: { flex: 1, gap: 6 },
  reviewThumb: { width: "100%", height: 120, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  reviewThumbEmpty: { alignItems: "center", justifyContent: "center" },
  reviewThumbCaption: { color: colors.subtleText, fontSize: 12, fontWeight: "600", textAlign: "center" },
  privacyNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14 },
  privacyText: { flex: 1, color: colors.mutedText, fontSize: 12, lineHeight: 17 },

  // Wizard nav
  wizardNav: { flexDirection: "row", gap: 10, marginTop: 4 },
  navButton: { minWidth: 110 },
  navButtonGrow: { flex: 1 },
});
