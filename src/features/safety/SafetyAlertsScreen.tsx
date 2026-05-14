import { useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { AppButton } from "@/components/ui/AppButton";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import { colors, primaryTint } from "@/theme/colors";
import type { SafetyAlert } from "@/types/models";

function alertIcon(type: SafetyAlert["type"]): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "kyc_failure": return "document-text-outline";
    case "account_restricted": return "lock-closed-outline";
    case "suspicious_activity": return "warning";
    case "referral_blocked": return "people-outline";
  }
}

function alertBgColor(severity: SafetyAlert["severity"]) {
  switch (severity) {
    case "danger": return "rgba(220,40,40,0.08)";
    case "warning": return "rgba(245,159,10,0.08)";
    case "info": return primaryTint.fill08;
  }
}

function alertBorderColor(severity: SafetyAlert["severity"]) {
  switch (severity) {
    case "danger": return "rgba(220,40,40,0.25)";
    case "warning": return "rgba(245,159,10,0.25)";
    case "info": return primaryTint.stroke25;
  }
}

function alertIconColor(severity: SafetyAlert["severity"]) {
  switch (severity) {
    case "danger": return colors.danger;
    case "warning": return colors.warning;
    case "info": return colors.primary;
  }
}

export function SafetyAlertsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const safetyAlerts = useAppStore((s) => s.safetyAlerts);
  const dismissSafetyAlert = useAppStore((s) => s.dismissSafetyAlert);
  const active = safetyAlerts.filter((a) => !a.dismissed);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Safety & Security</Text>
      </View>

      {active.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="shield-checkmark-outline" size={56} color={colors.safe} />
          <Text style={styles.emptyTitle}>All Clear</Text>
          <Text style={styles.emptySubtitle}>No security alerts at this time. Your account is in good standing.</Text>
        </View>
      ) : (
        active.map((alert) => (
          <Card
            key={alert.id}
            style={[
              styles.alertCard,
              { backgroundColor: alertBgColor(alert.severity), borderColor: alertBorderColor(alert.severity) },
            ]}
          >
            <View style={styles.alertTop}>
              <View style={[styles.alertIconWrap, { backgroundColor: alertBgColor(alert.severity) }]}>
                <Ionicons name={alertIcon(alert.type)} size={22} color={alertIconColor(alert.severity)} />
              </View>
              <Pressable onPress={() => dismissSafetyAlert(alert.id)} style={styles.dismissBtn}>
                <Ionicons name="close" size={16} color={colors.mutedText} />
              </Pressable>
            </View>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertMessage}>{alert.message}</Text>
            <Text style={styles.alertDate}>{alert.date}</Text>
            {alert.actionLabel ? (
              <AppButton
                label={alert.actionLabel}
                variant={alert.severity === "danger" ? "primary" : "secondary"}
                onPress={() => {
                  if (alert.type === "kyc_failure") navigation.navigate("KycVerificationTab");
                  else if (alert.type === "suspicious_activity") navigation.navigate("ChangePasswordTab");
                }}
                style={styles.alertCta}
              />
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 20, gap: 12 },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  alertCard: { marginBottom: 14, paddingVertical: 16, paddingHorizontal: 16, borderWidth: 1 },
  alertTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  alertIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  dismissBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.05)", alignItems: "center", justifyContent: "center" },
  alertTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: 6 },
  alertMessage: { color: colors.mutedText, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  alertDate: { color: colors.subtleText, fontSize: 12, marginBottom: 12 },
  alertCta: {},
  emptyWrap: { alignItems: "center", paddingVertical: 64, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  emptySubtitle: { color: colors.subtleText, fontSize: 14, textAlign: "center", maxWidth: 260 },
});
