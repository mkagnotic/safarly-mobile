import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import { FlatList, Platform, RefreshControl, StyleSheet, Text, View, type ListRenderItemInfo } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { MainTabParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type OfferItem = {
  id: string;
  avatar: string;
  name: string;
  parcel: string;
  weight: string;
  amount: string;
};

const OFFER_ITEMS: OfferItem[] = [
  { id: "offer-1", avatar: "P", name: "Priya S.", parcel: "iPhone 15 Pro Max", weight: "0.5 kg", amount: "$45" },
  { id: "offer-2", avatar: "M", name: "Mike C.", parcel: "Prescription medicines", weight: "0.3 kg", amount: "$35" },
  { id: "offer-3", avatar: "T", name: "Tom B.", parcel: "Clothing bundle", weight: "2.0 kg", amount: "$55" },
];

function OfferCard({ item, onMessage }: Readonly<{ item: OfferItem; onMessage: (item: OfferItem) => void }>) {
  return (
    <View style={styles.offerCard}>
      <View style={styles.offerTopRow}>
        <View style={styles.offerIdentityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>{item.avatar}</Text>
          </View>
          <View style={styles.offerTextColumn}>
            <Text style={styles.offerName}>{item.name}</Text>
            <Text style={styles.offerMeta}>
              {item.parcel} • {item.weight}
            </Text>
          </View>
        </View>
        <Text style={styles.offerAmount}>{item.amount}</Text>
      </View>

      <View style={styles.offerActionsRow}>
        <Pressable style={[styles.actionButton, styles.acceptButton]} accessibilityRole="button">
          <Text style={[styles.actionButtonLabel, styles.acceptButtonLabel]}>Accept</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.messageButton]} onPress={() => onMessage(item)} accessibilityRole="button" accessibilityLabel={`Message ${item.name}`}>
          <Text style={[styles.actionButtonLabel, styles.messageButtonLabel]}>Message</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.declineButton]} accessibilityRole="button">
          <Text style={[styles.actionButtonLabel, styles.declineButtonLabel]}>Decline</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ParcelOffersScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList, "OffersTab">>();
  const airplaneStyle = Platform.OS === "ios" ? styles.routePlaneIos : styles.routePlane;
  const { refreshing, onRefresh } = usePullToRefresh();
  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Home");
  }, [navigation]);

  const handleMessagePress = useCallback(
    (item: OfferItem) => {
      navigation.navigate("OfferChatTab", { name: item.name, parcel: item.parcel, source: "offers" });
    },
    [navigation]
  );

  const renderOffer = useCallback(
    ({ item }: ListRenderItemInfo<OfferItem>) => <OfferCard item={item} onMessage={handleMessagePress} />,
    [handleMessagePress]
  );

  const keyExtractor = useCallback((item: OfferItem) => item.id, []);

  return (
    <Screen scroll={false} edges={["top", "left", "right"]}>
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={handleBack} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.pageTitle}>Parcel Offers ({OFFER_ITEMS.length})</Text>
        </View>

        <View style={styles.routePill}>
          <Ionicons name="airplane-outline" size={16} color={colors.onBrandMuted} style={airplaneStyle} />
          <Text style={styles.routeText}>Seattle {"→"} Hyderabad • Mar 30</Text>
        </View>

        <FlatList
          data={OFFER_ITEMS}
          keyExtractor={keyExtractor}
          renderItem={renderOffer}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          initialNumToRender={4}
          removeClippedSubviews
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
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
    marginTop: 16,
    marginBottom: 18,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
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
  pageTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  routePill: {
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 18,
    gap: 8,
  },
  routePlane: {
    transform: [{ rotate: "-35deg" }],
  },
  routePlaneIos: {
    transform: [{ rotate: "-42deg" }],
  },
  routeText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  listContent: {
    paddingBottom: 8,
  },
  offerCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  offerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  offerIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1EEE8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarLabel: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 18,
  },
  offerTextColumn: {
    flexShrink: 1,
    minWidth: 0,
  },
  offerName: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  offerMeta: {
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
  },
  offerAmount: {
    color: colors.primaryForeground,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
  },
  offerActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  actionButtonLabel: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
  },
  acceptButton: {
    backgroundColor: "#1ECF62",
  },
  acceptButtonLabel: {
    color: colors.white,
  },
  messageButton: {
    backgroundColor: "#F5F4F1",
  },
  messageButtonLabel: {
    color: colors.text,
  },
  declineButton: {
    backgroundColor: "#FFF3F0",
  },
  declineButtonLabel: {
    color: colors.danger,
  },
});
