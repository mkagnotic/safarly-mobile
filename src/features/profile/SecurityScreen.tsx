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
 * Security hub — Email, Change password, and the account-deletion entry point.
 *
 * Deletion lives here rather than under Preferences because this is where a user
 * looks for "things that change my account", and because both stores require it
 * to be reachable without contacting support (App Store Guideline 5.1.1(v),
 * Google Play's data deletion policy). It is deliberately set apart from the
 * credential rows and styled as destructive so it cannot be tapped by accident.
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
              {/* Two lines: at 320dp one line ellipsised the user's own address
                  ("mahesh.k+user1@agnotic.com") and "Update the password you use to
                  sign in". Web truncates neither. */}
              <Text style={styles.rowSubtitle} numberOfLines={2}>{row.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.mutedText} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.dangerLabel}>Danger zone</Text>
      <View style={styles.card}>
        <Pressable
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          onPress={() => navigation.navigate("DeleteAccountTab")}
        >
          <View style={styles.dangerIcon}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.dangerTitle}>Delete account</Text>
            <Text style={styles.rowSubtitle} numberOfLines={2}>
              Permanently remove your account and personal data
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.mutedText} />
        </Pressable>
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
  dangerLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.mutedText,
    marginTop: 18,
    marginBottom: 8,
  },
  dangerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(220, 40, 40, 0.10)",
  },
  dangerTitle: { fontSize: 15, fontWeight: "700", color: colors.danger },
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
