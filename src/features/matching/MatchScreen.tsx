import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { AppButton } from "@/components/ui/AppButton";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type MatchType = "parcel" | "buddy";

export function MatchScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const route = useRoute();
  const params = route.params as { type?: MatchType; matchName?: string; route?: string } | undefined;
  const matchType = params?.type ?? "parcel";
  const matchName = params?.matchName ?? "Priya S.";
  const matchRoute = params?.route ?? "NYC \u2192 Mumbai";

  const [stage, setStage] = useState<"searching" | "found" | "no_match">("searching");
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Simulate match finding after 2.5 seconds
    const timer = setTimeout(() => {
      pulse.stop();
      setStage("found");
      Animated.spring(scaleAnim, { toValue: 1, stiffness: 200, damping: 15, useNativeDriver: true }).start();
    }, 2500);

    return () => { pulse.stop(); clearTimeout(timer); };
  }, []);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  if (stage === "searching") {
    return (
      <Screen scroll={false}>
        <View style={styles.centerWrap}>
          <Animated.View style={[styles.searchingRing, { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]}>
            <Ionicons
              name={matchType === "parcel" ? "cube-outline" : "people-outline"}
              size={48}
              color={colors.primary}
            />
          </Animated.View>
          <Text style={styles.searchingTitle}>
            {matchType === "parcel" ? "Finding carriers..." : "Finding travel companions..."}
          </Text>
          <Text style={styles.searchingSubtitle}>
            Looking for matches on the {matchRoute} route
          </Text>
          <Pressable onPress={goBack} style={styles.cancelLink}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (stage === "no_match") {
    return (
      <Screen>
        <View style={styles.centerWrap}>
          <View style={styles.noMatchIcon}>
            <Ionicons name="search-outline" size={48} color={colors.subtleText} />
          </View>
          <Text style={styles.noMatchTitle}>No matches yet</Text>
          <Text style={styles.noMatchSubtitle}>
            We'll notify you when someone {matchType === "parcel" ? "lists a trip" : "creates a buddy request"} on this route.
          </Text>
          <AppButton label="Back to Home" onPress={() => navigation.navigate("Home")} style={styles.cta} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Match Found!</Text>
      </View>

      <Animated.View style={[styles.matchCardWrap, { transform: [{ scale: scaleAnim }] }]}>
        <Card style={styles.matchCard}>
          <View style={styles.matchIcon}>
            <Ionicons name="checkmark-circle" size={56} color={colors.safe} />
          </View>
          <Text style={styles.matchTitle}>
            {matchType === "parcel" ? "Carrier Found!" : "Travel Buddy Found!"}
          </Text>
          <View style={styles.matchAvatar}>
            <Text style={styles.matchAvatarText}>{matchName.charAt(0)}</Text>
          </View>
          <Text style={styles.matchName}>{matchName}</Text>
          <Text style={styles.matchRouteText}>{matchRoute}</Text>

          <View style={styles.matchStats}>
            <View style={styles.matchStat}>
              <Ionicons name="star" size={16} color={colors.warning} />
              <Text style={styles.matchStatText}>4.8</Text>
            </View>
            <View style={styles.matchStat}>
              <Ionicons name="airplane-outline" size={16} color={colors.primary} />
              <Text style={styles.matchStatText}>15 trips</Text>
            </View>
            <View style={styles.matchStat}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.safe} />
              <Text style={styles.matchStatText}>Verified</Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      <View style={styles.actions}>
        <AppButton
          label="Start Chat"
          onPress={() => navigation.navigate("OfferChatTab", { name: matchName, source: "home" })}
        />
        <Pressable
          onPress={() => setStage("no_match")}
          style={styles.skipLink}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  searchingRing: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  searchingTitle: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  searchingSubtitle: { color: colors.mutedText, fontSize: 14, textAlign: "center", lineHeight: 20 },
  cancelLink: { marginTop: 24 },
  cancelText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  // No match
  noMatchIcon: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  noMatchTitle: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  noMatchSubtitle: { color: colors.mutedText, fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  cta: { marginTop: 24, width: "80%" },
  // Match found
  headerRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 20, gap: 12, paddingHorizontal: 20 },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  matchCardWrap: { paddingHorizontal: 20 },
  matchCard: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20, marginBottom: 24 },
  matchIcon: { marginBottom: 12 },
  matchTitle: { color: colors.text, fontSize: 20, fontWeight: "800", marginBottom: 16 },
  matchAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  matchAvatarText: { color: colors.text, fontWeight: "700", fontSize: 26 },
  matchName: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 4 },
  matchRouteText: { color: colors.mutedText, fontSize: 14, marginBottom: 16 },
  matchStats: { flexDirection: "row", gap: 20 },
  matchStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  matchStatText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  actions: { paddingHorizontal: 20, gap: 12 },
  skipLink: { alignItems: "center", paddingVertical: 8 },
  skipText: { color: colors.mutedText, fontSize: 14, fontWeight: "600" },
});
