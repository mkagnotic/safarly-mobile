import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { formatRoute } from "@/features/buddies/formatRoute";
import { MainTabParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "BuddyDetailsTab">;
type Route = RouteProp<MainTabParamList, "BuddyDetailsTab">;

export function BuddyDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const buddy = useAppStore((s) => s.buddies.find((item) => item.name === route.params.buddyName));
  const toggleBuddyConnection = useAppStore((s) => s.toggleBuddyConnection);
  const displayRoute = formatRoute(buddy?.route ?? "");
  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    // "Buddies" tab is now Inbox; buddy listings live under My Travels' Partners
    // tab (registered as the "Parcels" route key).
    navigation.navigate("Parcels");
  }, [navigation]);

  if (!buddy) {
    return (
      <Screen scroll={false}>
        <View style={styles.page}>
          <View style={styles.headerRow}>
            <Pressable onPress={handleBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.pageTitle}>Traveler Profile</Text>
          </View>
          <View style={styles.fallbackCard}>
            <Text style={styles.fallbackText}>Traveler not found.</Text>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <Pressable onPress={handleBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.pageTitle}>Traveler Profile</Text>
        </View>

        <View style={styles.profileTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{buddy.avatar}</Text>
          </View>
          <Text style={styles.name}>{buddy.name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={styles.ratingText}>{buddy.rating.toFixed(1)}</Text>
            <Text style={styles.tripsText}>• {buddy.trips} trips</Text>
          </View>
          {buddy.connected ? (
            <View style={styles.connectedInfoRow}>
              <Ionicons name="checkmark-circle" size={16} color="#14B35A" />
              <Text style={styles.connectedInfoText}>Connected</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bioBox}>
          <Text style={styles.bioText}>{buddy.bio}</Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Route</Text>
            <Text style={styles.metricValue}>{displayRoute}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Date</Text>
            <Text style={styles.metricValue}>{buddy.date}</Text>
          </View>
        </View>

        <Pressable
          style={[styles.connectButton, buddy.connected && styles.connectButtonConnected]}
          onPress={() => toggleBuddyConnection(buddy.name)}
          accessibilityRole="button"
          accessibilityLabel={buddy.connected ? `${buddy.name} connected` : `Connect with ${buddy.name}`}
        >
          <Text style={[styles.connectButtonText, buddy.connected && styles.connectButtonTextConnected]}>{buddy.connected ? "✓ Connected" : "Connect"}</Text>
        </Pressable>

        <Pressable
          style={styles.messageButton}
          onPress={() => navigation.navigate("OfferChatTab", { name: buddy.name, source: "buddies" })}
          accessibilityRole="button"
          accessibilityLabel={`Send message to ${buddy.name}`}
        >
          <Text style={styles.messageButtonText}>Send Message</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 20,
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
  pageTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  profileTop: {
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#F1EEE8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarText: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
  },
  name: {
    color: colors.text,
    fontSize: 34 / 2,
    lineHeight: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    color: colors.text,
    fontSize: 33 / 2,
    lineHeight: 21,
    fontWeight: "800",
  },
  tripsText: {
    color: colors.mutedText,
    fontSize: 33 / 2,
    lineHeight: 21,
    fontWeight: "500",
  },
  connectedInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  connectedInfoText: {
    color: colors.safe,
    fontSize: 17 / 2,
    lineHeight: 12,
    fontWeight: "700",
  },
  bioBox: {
    borderWidth: 1,
    borderColor: "#E9EDF2",
    backgroundColor: colors.card,
    borderRadius: 16,
    minHeight: 54,
    paddingHorizontal: 16,
    justifyContent: "center",
    marginBottom: 14,
  },
  bioText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "500",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E9EDF2",
    borderRadius: 14,
    backgroundColor: colors.card,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  metricLabel: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500",
    marginBottom: 2,
  },
  metricValue: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  connectButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  connectButtonConnected: {
    backgroundColor: "#DCEEE4",
  },
  connectButtonText: {
    color: colors.white,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  connectButtonTextConnected: {
    color: colors.safe,
  },
  messageButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#F1F0ED",
    alignItems: "center",
    justifyContent: "center",
  },
  messageButtonText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  fallbackCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    paddingVertical: 18,
    alignItems: "center",
  },
  fallbackText: {
    color: colors.mutedText,
    fontSize: 15,
    fontWeight: "600",
  },
});
