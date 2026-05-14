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
import { colors } from "@/theme/colors";

export function PaymentFailureScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  return (
    <Screen>
      <View style={styles.centerWrap}>
        <View style={styles.errorIcon}>
          <Ionicons name="close-circle" size={72} color={colors.danger} />
        </View>
        <Text style={styles.title}>Payment Failed</Text>
        <Text style={styles.subtitle}>
          We couldn't process your payment. Please check your payment method and try again.
        </Text>

        <Card style={styles.reasonCard}>
          <View style={styles.reasonRow}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.reasonText}>Insufficient funds or card declined</Text>
          </View>
        </Card>

        <View style={styles.actions}>
          <AppButton label="Try Again" onPress={goBack} />
          <AppButton
            label="Change Payment Method"
            variant="secondary"
            onPress={() => navigation.navigate("WalletTab")}
          />
          <Pressable style={styles.helpLink} onPress={() => navigation.navigate("Home")}>
            <Text style={styles.helpText}>Need help? Contact Support</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerWrap: { alignItems: "center", paddingHorizontal: 20, paddingTop: 80 },
  errorIcon: { marginBottom: 20 },
  title: { color: colors.text, fontSize: 24, fontWeight: "800", marginBottom: 8 },
  subtitle: { color: colors.mutedText, fontSize: 15, textAlign: "center", lineHeight: 22, maxWidth: 300, marginBottom: 24 },
  reasonCard: { width: "100%", paddingVertical: 14, paddingHorizontal: 14, marginBottom: 32 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  reasonText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  actions: { width: "100%", gap: 12 },
  helpLink: { alignItems: "center", paddingVertical: 12 },
  helpText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
});
