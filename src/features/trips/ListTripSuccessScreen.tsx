import { useCallback } from "react";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
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
});
