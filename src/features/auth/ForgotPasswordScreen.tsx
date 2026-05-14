import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "ForgotPasswordTab">;

const TITLE_COLOR = colors.text;
const BODY_MUTED = colors.mutedText;
const LABEL_MUTED = colors.mutedText;

export function ForgotPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState("alex@email.com");
  const [resetSent, setResetSent] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setResetSent(false);
    }, [])
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("SettingsTab");
  }, [navigation]);

  const handleReset = useCallback(() => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setResetSent(true);
  }, [email]);

  const handleDone = useCallback(() => {
    navigation.navigate("Profile");
  }, [navigation]);

  return (
    <Screen contentContainerStyle={styles.screenContent} refreshEnabled={false}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={TITLE_COLOR} />
        </Pressable>
        <Text style={styles.screenTitle}>Forgot Password</Text>
      </View>

      {resetSent ? (
        <View style={styles.successWrap}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark" size={28} color="#22C55E" />
          </View>
          <Text style={styles.successTitle}>Reset Link Sent!</Text>
          <Text style={styles.successBody}>Check your email for instructions to reset your password.</Text>
          <Pressable style={styles.doneButton} onPress={handleDone} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.subtitle}>Enter your email and we'll send you a reset link.</Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.subtleText}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Pressable style={styles.ctaButton} onPress={handleReset} accessibilityRole="button" accessibilityLabel="Send reset link">
            <Text style={styles.ctaText}>Send Reset Link</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
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
  subtitle: {
    color: BODY_MUTED,
    fontSize: 28 / 2,
    lineHeight: 20,
    fontWeight: "500",
    marginBottom: 18,
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
  },
  ctaButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  doneButtonText: {
    color: colors.white,
    fontSize: 30 / 2,
    lineHeight: 19,
    fontWeight: "800",
  },
});
