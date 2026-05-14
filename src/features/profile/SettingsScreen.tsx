import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "SettingsTab">;

type SettingRowItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
};

type SettingSection = {
  id: string;
  title: string;
  rows: readonly SettingRowItem[];
};

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const appVersion = "1.0.0";

  const sections = useMemo<readonly SettingSection[]>(
    () => [
      {
        id: "security",
        title: "SECURITY",
        rows: [
          { id: "change-password", icon: "lock-closed-outline", title: "Change Password" },
          { id: "change-email", icon: "mail-outline", title: "Change Email" },
        ],
      },
      {
        id: "preferences",
        title: "PREFERENCES",
        rows: [
          {
            id: "language",
            icon: "settings-outline",
            title: "Language, Timezone & Format",
            subtitle: "Customize your experience",
          },
        ],
      },
      {
        id: "general",
        title: "GENERAL",
        rows: [
          {
            id: "push-notifications",
            icon: "notifications-outline",
            title: "Push Notifications",
            subtitle: "Manage notification preferences",
          },
          {
            id: "payment-methods",
            icon: "card-outline",
            title: "Payment Methods",
            subtitle: "Manage cards and bank accounts",
          },
          {
            id: "help-support",
            icon: "help-circle-outline",
            title: "Help & Support",
            subtitle: "FAQ, contact us, report issue",
          },
          {
            id: "about",
            icon: "information-circle-outline",
            title: "About Safarly",
            subtitle: `Version ${appVersion}`,
          },
        ],
      },
    ],
    [appVersion]
  );

  return (
    <Screen contentContainerStyle={styles.contentContainer} refreshEnabled={false}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.navigate("Profile")}
          accessibilityRole="button"
          accessibilityLabel="Go back to profile"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>Settings</Text>
      </View>

      {sections.map((section) => (
        <View key={section.id} style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.card}>
            {section.rows.map((row, index) => (
              <Pressable
                key={row.id}
                style={[styles.row, index < section.rows.length - 1 && styles.rowDivider]}
                accessibilityRole="button"
                onPress={() => {
                  if (row.id === "change-password") {
                    navigation.navigate("ChangePasswordTab");
                    return;
                  }
                  if (row.id === "change-email") {
                    navigation.navigate("ChangeEmailTab");
                    return;
                  }
                  if (row.id === "language") {
                    navigation.navigate("PreferencesTab");
                  }
                }}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name={row.icon} size={18} color={colors.mutedText} />
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowTitle}>{row.title}</Text>
                    {row.subtitle ? <Text style={styles.rowSubtitle}>{row.subtitle}</Text> : null}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.mutedText} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingTop: 16,
    paddingBottom: 20,
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
  sectionBlock: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DFE6EF",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  rowTextWrap: {
    flexShrink: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },
  rowSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    marginTop: 1,
  },
});
