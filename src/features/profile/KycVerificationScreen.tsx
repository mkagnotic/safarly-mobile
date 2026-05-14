import { useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import type { TranslationKey } from "@/i18n/translations";
import { t } from "@/i18n/translations";
import { RootStackParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

type Nav = NativeStackNavigationProp<RootStackParamList, "KycVerification">;

/** Match reference UI; aligns with common Material success palette */
const SUCCESS_FILL = "#4CAF50";
const SUCCESS_SURFACE = "#E8F5E9";
const TITLE_COLOR = colors.text;
const BODY_MUTED = colors.mutedText;
const SECTION_LABEL = colors.mutedText;
const DOC_LABEL_COLOR = colors.subtleText;

const VERIFIED_DOCUMENTS: { id: string; labelKey: TranslationKey }[] = [
  { id: "1", labelKey: "kyc.docPassportFront" },
  { id: "2", labelKey: "kyc.docPassportBack" },
  { id: "3", labelKey: "kyc.docSelfieWithId" },
];

export function KycVerificationScreen() {
  const navigation = useNavigation<Nav>();
  const language = useAppStore((s) => s.language);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  return (
    <Screen contentContainerStyle={styles.screenContent}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>{t(language, "profile.kycVerification")}</Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusIconWrap}>
          <Ionicons name="checkmark" size={34} color={colors.white} />
        </View>
        <Text style={styles.statusHeadline}>{t(language, "kyc.verifiedTitle")}</Text>
        <Text style={styles.statusDescription}>{t(language, "kyc.verifiedBody")}</Text>
      </View>

      <View style={styles.documentsCard}>
        <Text style={styles.documentsSectionLabel}>{t(language, "kyc.verifiedDocumentsSection")}</Text>
        {VERIFIED_DOCUMENTS.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <View style={styles.docDivider} /> : null}
            <View style={styles.docRow}>
              <Ionicons name="checkmark-circle" size={20} color={SUCCESS_FILL} />
              <Text style={styles.docLabel}>{t(language, item.labelKey)}</Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingBottom: 28 },
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
  screenTitle: {
    color: TITLE_COLOR,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  statusCard: {
    backgroundColor: SUCCESS_SURFACE,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    marginBottom: 16,
  },
  statusIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: SUCCESS_FILL,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  statusHeadline: {
    color: TITLE_COLOR,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  statusDescription: {
    color: BODY_MUTED,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 320,
  },
  documentsCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 3,
  },
  documentsSectionLabel: {
    color: SECTION_LABEL,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  docDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#DFE6EF",
    marginVertical: 0,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
  },
  docLabel: {
    flex: 1,
    color: DOC_LABEL_COLOR,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
});
