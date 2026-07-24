import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";

import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/AuthContext";
import { MainTabParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "ChangeEmailTab">;

/**
 * Email is display-only — changing it is handled by support, exactly as web's
 * `AccountSecuritySettings` change-email view. (A real `PUT /auth-handler/
 * change-email` endpoint exists if this ever becomes self-service.)
 */
export function ChangeEmailScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const email = user?.email ?? "—";

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("SecurityTab");
  }, [navigation]);

  return (
    <Screen contentContainerStyle={styles.content} refreshEnabled={false}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>Email address</Text>
      </View>

      <Text style={styles.label}>CURRENT EMAIL</Text>
      <View style={styles.emailCard}>
        <View style={styles.emailIcon}>
          <Ionicons name="mail-outline" size={18} color={colors.primary} />
        </View>
        <Text style={styles.emailText} numberOfLines={1}>{email}</Text>
        <Ionicons name="lock-closed" size={15} color={colors.mutedText} />
      </View>

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={16} color={colors.mutedText} />
        <Text style={styles.noteText}>
          To update the email on your account, please contact support.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 24 },
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
  screenTitle: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },

  label: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  emailCard: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emailIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  emailText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },

  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 16,
  },
  noteText: { flex: 1, color: colors.mutedText, fontSize: 13, lineHeight: 19 },
});
