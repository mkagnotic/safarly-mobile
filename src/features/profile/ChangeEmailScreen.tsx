import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "ChangeEmailTab">;

const TITLE_COLOR = colors.text;
const BODY_MUTED = colors.mutedText;
const LABEL_MUTED = colors.mutedText;

export function ChangeEmailScreen() {
  const navigation = useNavigation<Nav>();
  const [currentEmail, setCurrentEmail] = useState("alex@email.com");
  const [newEmail, setNewEmail] = useState("newemail@example.com");
  const [password, setPassword] = useState("••••••••");
  const [verificationSent, setVerificationSent] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setVerificationSent(false);
    }, [])
  );

  const canSubmit = useMemo(
    () => Boolean(currentEmail.trim()) && Boolean(newEmail.trim()) && Boolean(password.trim()),
    [currentEmail, newEmail, password]
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("SettingsTab");
  }, [navigation]);

  const onSendVerification = useCallback(() => {
    if (!canSubmit) return;
    setVerificationSent(true);
  }, [canSubmit]);

  const onDone = useCallback(() => {
    navigation.navigate("Profile");
  }, [navigation]);

  return (
    <Screen contentContainerStyle={styles.contentContainer} refreshEnabled={false}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={TITLE_COLOR} />
        </Pressable>
        <Text style={styles.screenTitle}>Change Email</Text>
      </View>

      {verificationSent ? (
        <View style={styles.successWrap}>
          <View style={styles.successIconWrap}>
            <Ionicons name="mail-outline" size={28} color="#22C55E" />
          </View>
          <Text style={styles.successTitle}>Verification Email Sent!</Text>
          <Text style={styles.successBody}>Please check your new email to complete the change.</Text>
          <Pressable style={styles.doneButton} onPress={onDone} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.subtitle}>A verification link will be sent to your new email address.</Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>CURRENT EMAIL</Text>
            <TextInput
              value={currentEmail}
              onChangeText={setCurrentEmail}
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.subtleText}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>NEW EMAIL</Text>
            <TextInput
              value={newEmail}
              onChangeText={setNewEmail}
              style={styles.input}
              placeholder="newemail@example.com"
              placeholderTextColor={colors.subtleText}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>PASSWORD (TO CONFIRM)</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.subtleText}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Pressable style={[styles.ctaButton, !canSubmit && styles.ctaButtonDisabled]} onPress={onSendVerification} accessibilityRole="button">
            <Text style={styles.ctaText}>Send Verification</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    marginBottom: 18,
    minHeight: 34,
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
  subtitle: {
    color: BODY_MUTED,
    fontSize: 28 / 2,
    lineHeight: 20,
    fontWeight: "500",
    marginBottom: 14,
    maxWidth: 320,
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: LABEL_MUTED,
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
    color: TITLE_COLOR,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500",
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  ctaButton: {
    marginTop: 2,
    minHeight: 52,
    borderRadius: 12,
    // Primary CTA = orange accent (profile-section CTA convention).
    backgroundColor: colors.ctaAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButtonDisabled: {
    opacity: 0.55,
  },
  ctaText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#DFF3E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: {
    color: TITLE_COLOR,
    fontSize: 34 / 2,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  successBody: {
    color: BODY_MUTED,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 290,
    marginBottom: 22,
  },
  doneButton: {
    minWidth: 84,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: colors.ctaAccent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  doneButtonText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },
});
