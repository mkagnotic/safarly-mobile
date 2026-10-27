import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";

import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { Screen } from "@/components/ui/Screen";
import { authApi, getErrorMessage } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { MainTabParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "ChangeEmailTab">;

/**
 * Change email, self-service (27 Oct 2026; it was "please contact support" with no
 * way to do it). The server runs a VERIFIED change: a confirmation link is emailed
 * and the address changes only once it is opened. Web parity.
 */
export function ChangeEmailScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const email = user?.email ?? "—";
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    if (busy) return;
    setError(null);
    const target = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) { setError("Enter a valid email address."); return; }
    if (!password) { setError("Enter your current password."); return; }
    setBusy(true);
    try {
      const res = await authApi.changeEmail(target, password);
      setSent((res as { data?: { message?: string } })?.data?.message ?? `We've sent a confirmation link to ${target}.`);
      setNewEmail("");
      setPassword("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [busy, newEmail, password]);

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

      <Text style={styles.label}>Current email</Text>
      <View style={styles.emailCard}>
        <View style={styles.emailIcon}>
          <Ionicons name="mail-outline" size={18} color={colors.primary} />
        </View>
        {/* No numberOfLines: showing the current address IS this screen's job, and at
            320dp a normal address ("mahesh.k+user1@agnotic.com") was ellipsised away.
            Web renders it with no truncation at all, so this also closes a parity gap. */}
        <Text style={styles.emailText}>{email}</Text>
        <Ionicons name="lock-closed" size={15} color={colors.mutedText} />
      </View>

      {sent ? (
        <View style={styles.note} accessibilityRole="alert" testID="change-email-sent">
          <Ionicons name="checkmark-circle-outline" size={16} color={colors.safe} />
          <Text style={styles.noteText}>{sent}</Text>
        </View>
      ) : (
        <View style={styles.form}>
          <AppInput
            label="New email"
            value={newEmail}
            onChangeText={(v) => { setNewEmail(v); setError(null); }}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            editable={!busy}
          />
          <AppInput
            label="Current password"
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null); }}
            secureTextEntry
            autoComplete="password"
            editable={!busy}
            error={error ?? undefined}
          />
          <AppButton label="Send confirmation link" onPress={() => void submit()} loading={busy} />
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color={colors.mutedText} />
            <Text style={styles.noteText}>
              We'll email a link to your new address; your email changes once you open it. Signed up
              with Google or Apple? Set a password with "Forgot password" first.
            </Text>
          </View>
        </View>
      )}
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

  form: { gap: 12, marginTop: 18 },
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
