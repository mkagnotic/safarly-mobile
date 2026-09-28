import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { Screen } from "@/components/ui/Screen";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

/**
 * Shown once, straight after an account is deleted. The session is already
 * gone, so this lives in the signed-out stack; "Done" clears the flag and the
 * navigator falls back to the normal welcome screen. Worded to match web's
 * account-deleted page.
 */
export function AccountDeletedScreen() {
  const setAccountDeleted = useAppStore((s) => s.setAccountDeleted);

  return (
    <Screen contentContainerStyle={styles.content} refreshEnabled={false} scroll={false}>
      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="checkmark" size={34} color={colors.safe} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Your account has been deleted
        </Text>
        <Text style={styles.message}>
          Your Safarly account and personal data have been removed, and you've been signed out on
          every device. Thanks for travelling with us.
        </Text>
      </View>
      <AppButton label="Done" onPress={() => setAccountDeleted(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 24, justifyContent: "space-between" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 195, 93, 0.12)",
    marginBottom: 6,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center" },
  message: { fontSize: 15, lineHeight: 22, color: colors.mutedText, textAlign: "center", maxWidth: 320 },
});
