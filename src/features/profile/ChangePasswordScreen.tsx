import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "ChangePasswordTab">;

type PasswordFieldProps = {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  showLock?: boolean;
};

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = true,
  showLock = true,
}: Readonly<PasswordFieldProps>) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedText}
          secureTextEntry={secureTextEntry}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {showLock ? <Ionicons name="lock-closed-outline" size={18} color={colors.mutedText} /> : null}
      </View>
    </View>
  );
}

export function ChangePasswordScreen() {
  const navigation = useNavigation<Nav>();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const canSubmit = useMemo(
    () => Boolean(currentPassword.trim()) && newPassword.length >= 8 && confirmPassword === newPassword,
    [confirmPassword, currentPassword, newPassword]
  );

  const onUpdatePassword = useCallback(() => {
    if (!canSubmit) return;
    navigation.navigate("ForgotPasswordTab");
  }, [canSubmit, navigation]);

  return (
    <Screen contentContainerStyle={styles.contentContainer} refreshEnabled={false}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => navigation.navigate("SettingsTab")} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>Change Password</Text>
      </View>

      <PasswordField label="CURRENT PASSWORD" value={currentPassword} onChangeText={setCurrentPassword} />

      <Pressable onPress={() => navigation.navigate("ForgotPasswordTab")} accessibilityRole="button">
        <Text style={styles.forgotText}>Forgot current password?</Text>
      </Pressable>

      <PasswordField
        label="NEW PASSWORD"
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="Min 8 characters"
      />

      <PasswordField
        label="CONFIRM NEW PASSWORD"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        showLock={false}
      />

      <Pressable style={[styles.updateButton, !canSubmit && styles.updateButtonDisabled]} onPress={onUpdatePassword} accessibilityRole="button">
        <Text style={styles.updateButtonText}>Update Password</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingTop: 16,
    paddingBottom: 24,
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
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputWrap: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.input,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500",
    paddingVertical: 0,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: -4,
    marginBottom: 18,
  },
  updateButton: {
    marginTop: 2,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  updateButtonDisabled: {
    opacity: 0.55,
  },
  updateButtonText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
});
