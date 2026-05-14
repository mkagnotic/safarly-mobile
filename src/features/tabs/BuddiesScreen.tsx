import { memo, useCallback, useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View, type GestureResponderEvent, type ListRenderItemInfo } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useShallow } from "zustand/react/shallow";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { formatRoute } from "@/features/buddies/formatRoute";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { MainTabParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";
import type { TravelBuddy } from "@/types/models";

type Nav = BottomTabNavigationProp<MainTabParamList, "Buddies">;

export function BuddiesScreen() {
  const navigation = useNavigation<Nav>();
  const { showLiveData, buddies, toggleBuddyConnection } = useAppStore(
    useShallow((s) => ({ showLiveData: s.showLiveData, buddies: s.buddies, toggleBuddyConnection: s.toggleBuddyConnection }))
  );
  const visibleBuddies = showLiveData ? buddies : [];
  const listEmpty = visibleBuddies.length === 0;
  const { refreshing, onRefresh } = usePullToRefresh();
  const openBuddyChat = useCallback(
    (buddyName: string) => {
      navigation.navigate("OfferChatTab", { name: buddyName, source: "buddies" });
    },
    [navigation]
  );
  const openBuddyDetails = useCallback(
    (buddyName: string) => {
      navigation.navigate("BuddyDetailsTab", { buddyName });
    },
    [navigation]
  );
  const handleConnectBuddy = useCallback(
    (buddyName: string) => {
      toggleBuddyConnection(buddyName);
    },
    [toggleBuddyConnection]
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Travel Buddies</Text>
        <Text style={styles.subtitle}>Connect with travelers on similar routes for safer, more social trips.</Text>
      </View>
    ),
    []
  );

  const listEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="people-outline" size={28} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>No travel buddies yet</Text>
        <Text style={styles.emptySubtitle}>
          As more travelers join the platform, you'll find people on similar routes to connect with.
        </Text>
      </View>
    ),
    []
  );

  const renderBuddy = useCallback(
    ({ item }: ListRenderItemInfo<TravelBuddy>) => (
      <BuddyCard buddy={item} onOpen={openBuddyDetails} onMessage={openBuddyChat} onConnect={handleConnectBuddy} />
    ),
    [openBuddyDetails, openBuddyChat, handleConnectBuddy]
  );

  const keyExtractor = useCallback((item: TravelBuddy) => `${item.name}-${item.route}`, []);

  const contentContainerStyle = useMemo(
    () => [styles.listContent, listEmpty && styles.listContentEmpty],
    [listEmpty]
  );

  return (
    <Screen scroll={false}>
      <View style={styles.page}>
        <FlatList
          style={styles.list}
          data={visibleBuddies}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          windowSize={7}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          contentContainerStyle={contentContainerStyle}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmptyComponent}
          renderItem={renderBuddy}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      </View>
    </Screen>
  );
}

const BuddyCard = memo(function BuddyCard({
  buddy,
  onOpen,
  onMessage,
  onConnect,
}: Readonly<{
  buddy: TravelBuddy;
  onOpen: (buddyName: string) => void;
  onMessage: (buddyName: string) => void;
  onConnect: (buddyName: string) => void;
}>) {
  const handleConnect = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      onConnect(buddy.name);
    },
    [buddy.name, onConnect]
  );
  const handleMessage = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      onMessage(buddy.name);
    },
    [buddy.name, onMessage]
  );

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={() => onOpen(buddy.name)}
        accessibilityRole="button"
        accessibilityLabel={`Open profile for ${buddy.name}`}
        style={styles.cardTapArea}
      >
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{buddy.avatar}</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{buddy.name}</Text>
              <Ionicons name={buddy.connected ? "checkmark-circle" : "shield-outline"} size={16} color={buddy.connected ? "#22C55E" : colors.mutedText} />
            </View>

            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={styles.ratingText}>{buddy.rating.toFixed(1)}</Text>
              <Text style={styles.tripsText}>· {buddy.trips} trips</Text>
            </View>

            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={colors.mutedText} />
              <Text style={styles.metaText}>{formatRoute(buddy.route)}</Text>
            </View>

            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.mutedText} />
              <Text style={styles.metaText}>{buddy.date}</Text>
            </View>
          </View>
        </View>
      </Pressable>
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.connectBtn, buddy.connected && styles.connectedBtn]}
          onPress={handleConnect}
          accessibilityRole="button"
          accessibilityLabel={buddy.connected ? `${buddy.name} connected` : `Connect with ${buddy.name}`}
        >
          <Text style={[styles.connectBtnText, buddy.connected && styles.connectedBtnText]}>{buddy.connected ? "✓ Connected" : "Connect"}</Text>
        </Pressable>
        <Pressable
          style={styles.messageBtn}
          onPress={handleMessage}
          accessibilityRole="button"
          accessibilityLabel={`Message ${buddy.name}`}
        >
          <Ionicons name="chatbubble-outline" size={16} color={colors.mutedText} />
        </Pressable>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  headerWrap: {
    marginTop: 16,
    marginBottom: 14,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    maxWidth: 320,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingBottom: 88,
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 290,
  },
  card: {
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  cardTapArea: {
    borderRadius: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F4F1EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  avatarText: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "700",
  },
  cardBody: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  name: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 4,
  },
  ratingText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  tripsText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  metaText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginLeft: 56,
  },
  connectBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  connectedBtn: {
    backgroundColor: "#DCEEE4",
  },
  connectBtnText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  connectedBtnText: {
    color: colors.safe,
  },
  messageBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F6F5F2",
    alignItems: "center",
    justifyContent: "center",
  },
});
