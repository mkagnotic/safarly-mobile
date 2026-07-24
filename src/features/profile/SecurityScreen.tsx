import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/AuthContext";
import { MainTabParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "SecurityTab">;

type Row = {
  id: "email" | "change-password";
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
};

/**
 * Security hub — mirrors web's `AccountSecuritySettings` main view: exactly two
 * controls, Email (managed via support) and Change Password. No 2FA / sessions /
 * delete-account, matching web.
 */
export function SecurityScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const email = user?.email ?? "—";

  const rows: Row[] = [
    {
      id: "email",
      icon: "mail-outline",
      title: "Email address",
      subtitle: email,
      onPress: () => navigation.navigate("ChangeEmailTab"),
    },
    {
      id: "change-password",
      icon: "lock-closed-outline",
      title: "Change password",
      subtitle: "Update the password you use to sign in",
      onPress: () => navigation.navigate("ChangePasswordTab"),
    },
  ];

  return (
    <Screen contentContainerStyle={styles.content} refreshEnabled={false}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backButton}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Profile"))}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>Security</Text>
      </View>

      <Text style={styles.intro}>Manage your account credentials.</Text>

      <View style={styles.card}>
        {rows.map((row, index) => (
          <Pressable
            key={row.id}
            style={[styles.row, index < rows.length - 1 && styles.rowDivider]}
            accessibilityRole="button"
            accessibilityLabel={row.title}
            onPress={row.onPress}
          >
            <View style={styles.rowIcon}>
              <Ionicons name={row.icon} size={18} color={colors.primary} />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>{row.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.mutedText} />
          </Pressable>
        ))}
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
    marginBottom: 14,
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
  intro: { color: colors.mutedText, fontSize: 14, lineHeight: 20, marginBottom: 16 },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTextWrap: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: "700" },
  rowSubtitle: { color: colors.mutedText, fontSize: 13, lineHeight: 19, fontWeight: "500", marginTop: 1 },
});
