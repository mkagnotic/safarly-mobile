import { useCallback, useEffect, useRef, useState } from "react";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { paymentsApi } from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "ListTripSuccessTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

export function ListTripSuccessScreen() {
  const navigation = useNavigation<Nav>();
  const airplaneStyle = Platform.OS === "ios" ? styles.iconTiltIos : styles.iconTilt;
  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  const handleDone = useCallback(() => navigation.navigate("Home"), [navigation]);

  // Web parity (CustomerListTrip payout nudge): once a trip is listed, remind
  // the carrier to finish payout setup so they can actually get paid. Only
  // shown once we've confirmed they're NOT connected, to avoid a flash.
  const [payoutConnected, setPayoutConnected] = useState<boolean | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const res = await paymentsApi.stripeConnectStatus();
        if (mountedRef.current) setPayoutConnected(!!res.data?.connected);
      } catch {
        // Non-essential — leave the nudge hidden if the status can't be read.
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return (
    <Screen scroll={false} contentContainerStyle={styles.page}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>List Trip</Text>
      </View>

      <View style={styles.centerContent}>
        <View style={styles.successIconWrap}>
          <Ionicons name="airplane-outline" size={42} color="#22C55E" style={airplaneStyle} />
        </View>
        <Text style={styles.successTitle}>Trip Listed!</Text>
        <Text style={styles.subtitle}>You'll be notified when parcels match your route.</Text>

        {payoutConnected === false ? (
          <Pressable
            style={styles.payoutNudge}
            onPress={() => navigation.navigate("PayoutSetupTab")}
            accessibilityRole="button"
            accessibilityLabel="Set up payouts"
          >
            <Ionicons name="business-outline" size={20} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.payoutNudgeTitle}>Set up payouts to get paid</Text>
              <Text style={styles.payoutNudgeBody}>
                Connect your bank so earnings reach you when you carry a parcel.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.warning} />
          </Pressable>
        ) : null}

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
    paddingBottom: 120,
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
  iconTilt: {
    transform: [{ rotate: "-35deg" }],
  },
  iconTiltIos: {
    transform: [{ rotate: "-42deg" }],
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
    marginBottom: 22,
    textAlign: "center",
    maxWidth: 320,
  },
  doneButton: {
    minWidth: 84,
    borderRadius: 14,
    paddingHorizontal: 26,
  },
  payoutNudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245,159,10,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,159,10,0.24)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 22,
    maxWidth: 360,
  },
  payoutNudgeTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  payoutNudgeBody: { color: colors.mutedText, fontSize: 12, marginTop: 2, lineHeight: 16 },
});
