import { useCallback } from "react";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "PaymentSuccessTab">,
  NativeStackNavigationProp<RootStackParamList>
>;
type PaymentSuccessRoute = RouteProp<MainTabParamList, "PaymentSuccessTab">;

export function PaymentSuccessScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<PaymentSuccessRoute>();
  const addNotification = useAppStore((s) => s.addNotification);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  const handleDone = useCallback(() => {
    addNotification({
      title: "Payment successful",
      desc: `Payment of ${params.amount} is held in escrow until delivery confirmation.`,
      time: "now",
      read: false,
    });
    navigation.navigate("Home");
  }, [addNotification, navigation, params.amount]);

  return (
    <Screen scroll={false} contentContainerStyle={styles.page}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Payment</Text>
      </View>

      <View style={styles.centerContent}>
        <View style={styles.successIconWrap}>
          <Ionicons name="checkmark" size={44} color="#22C55E" />
        </View>
        <Text style={styles.successTitle}>Payment Successful!</Text>
        <Text style={styles.subtitle}>Your parcel request has been posted.</Text>
        <Text style={styles.bodyText}>
          Payment of <Text style={styles.strong}>{params.amount}</Text> held in escrow until delivery is confirmed.
        </Text>
        <AppButton label="Done" onPress={handleDone} style={styles.doneButton} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 0,
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
  title: {
    color: colors.text,
    fontSize: 33 / 2,
    fontWeight: "800",
    lineHeight: 24,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 88,
  },
  successIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#DDF3E5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  successTitle: {
    color: colors.text,
    fontSize: 38 / 2,
    lineHeight: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 32 / 2,
    lineHeight: 22,
    fontWeight: "500",
    marginBottom: 4,
    textAlign: "center",
  },
  bodyText: {
    color: colors.mutedText,
    fontSize: 28 / 2,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 22,
  },
  strong: {
    color: colors.text,
    fontWeight: "800",
  },
  doneButton: {
    minWidth: 84,
    borderRadius: 14,
    paddingHorizontal: 26,
  },
});
