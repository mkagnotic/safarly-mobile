import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo } from "react";
import { FlatList, Platform, RefreshControl, StyleSheet, Text, View, type ListRenderItemInfo } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";
import type { Trip } from "@/types/models";

type TripsNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Trips">,
  NativeStackNavigationProp<RootStackParamList>
>;

export function TripsScreen() {
  const navigation = useNavigation<TripsNav>();
  const emptyPlaneStyle = Platform.OS === "ios" ? styles.emptyPlaneIos : styles.emptyPlane;
  const routePlaneStyle = Platform.OS === "ios" ? styles.routePlaneIos : styles.routePlane;
  const { showLiveData, trips } = useAppStore(
    useShallow((s) => ({ showLiveData: s.showLiveData, trips: s.trips }))
  );
  const visibleTrips = showLiveData ? trips : [];
  const hasTrips = visibleTrips.length > 0;
  const { refreshing, onRefresh } = usePullToRefresh();

  const listHeader = useMemo(
    () => (
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Trips</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => navigation.navigate("ListTripTab", { source: "trips" })}
          accessibilityRole="button"
          accessibilityLabel="Add trip"
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.addButtonLabel}>Add Trip</Text>
        </Pressable>
      </View>
    ),
    []
  );

  const listEmpty = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="airplane-outline" size={28} color={colors.primary} style={emptyPlaneStyle} />
        </View>
        <Text style={styles.emptyTitle}>No trips listed</Text>
        <Text style={styles.emptySubtitle}>
          List your upcoming trip and earn money by carrying parcels along your route.
        </Text>
        <Pressable
          style={styles.emptyPrimaryButton}
          onPress={() => navigation.navigate("ListTripTab", { source: "trips" })}
          accessibilityRole="button"
          accessibilityLabel="List a trip"
        >
          <Text style={styles.emptyPrimaryButtonLabel}>List a Trip</Text>
        </Pressable>
      </View>
    ),
    [navigation]
  );

  const listFooter = useMemo(
    () => (
      <Card style={[styles.findCard, !hasTrips && styles.findCardForEmpty]}>
        <View style={styles.findIconCircle}>
          <Ionicons name="navigate-outline" size={22} color={colors.primary} />
        </View>
        <Text style={styles.findTitle}>Find Parcels to Carry</Text>
        <Text style={styles.findSubtitle}>Browse delivery requests matching your routes</Text>
        <Pressable
          style={styles.findButton}
          onPress={() => navigation.navigate("Parcels")}
          accessibilityRole="button"
          accessibilityLabel="Browse parcels"
        >
          <Text style={styles.findButtonLabel}>Browse Parcels</Text>
        </Pressable>
      </Card>
    ),
    [hasTrips, navigation]
  );

  const renderTrip = useCallback(({ item }: ListRenderItemInfo<Trip>) => {
    return (
      <Card style={styles.tripCard}>
        <View style={styles.tripRouteRow}>
          <Text style={styles.tripCity}>{item.from}</Text>
          <View style={styles.tripConnector}>
            <View style={styles.routeLine} />
            <Ionicons name="airplane-outline" size={13} color={colors.primary} style={routePlaneStyle} />
            <View style={styles.routeLine} />
          </View>
          <Text style={styles.tripCity}>{item.to}</Text>
        </View>

        <Text style={styles.tripMeta}>
          {item.date} • {item.capacity} available
        </Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{item.offers}</Text>
            <Text style={styles.metricLabel}>OFFERS</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardHighlight]}>
            <Text style={[styles.metricValue, styles.metricValueHighlight]}>{item.earnings}</Text>
            <Text style={styles.metricLabel}>POTENTIAL</Text>
          </View>
        </View>

        <Pressable
          style={styles.manageButton}
          onPress={() => navigation.navigate("TripDetailsTab", { tripId: item.id })}
          accessibilityRole="button"
          accessibilityLabel="Manage trip"
        >
          <Text style={styles.manageButtonLabel}>Manage Trip</Text>
        </Pressable>
      </Card>
    );
  }, []);

  const keyExtractor = useCallback((item: Trip) => item.id, []);

  const contentContainerStyle = useMemo(
    () => [styles.listContent, hasTrips ? styles.listContentWithTrips : styles.listContentEmpty],
    [hasTrips]
  );

  return (
    <Screen scroll={false} edges={["top", "left", "right"]}>
      <View style={styles.page}>
        <FlatList
          data={visibleTrips}
          keyExtractor={keyExtractor}
          style={styles.list}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          persistentScrollbar={false}
          overScrollMode="never"
          windowSize={7}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          ListHeaderComponent={listHeader}
          renderItem={renderTrip}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
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
    paddingBottom: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  listContentWithTrips: {
    paddingBottom: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  headerRow: {
    marginTop: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  addButton: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addButtonLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  tripCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  tripRouteRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tripCity: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    flexShrink: 1,
  },
  tripConnector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    gap: 7,
  },
  routeLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  routePlane: {
    transform: [{ rotate: "-32deg" }],
  },
  routePlaneIos: {
    transform: [{ rotate: "-42deg" }],
  },
  tripMeta: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    marginTop: 3,
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  metricCardHighlight: {
    backgroundColor: colors.accent,
  },
  metricValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 24,
    marginBottom: 4,
  },
  metricValueHighlight: {
    color: colors.primaryForeground,
  },
  metricLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
  manageButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  manageButtonLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingTop: 30,
    paddingBottom: 18,
  },
  emptyIconBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyPlane: {
    transform: [{ rotate: "-35deg" }],
  },
  emptyPlaneIos: {
    transform: [{ rotate: "-42deg" }],
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 18,
    fontWeight: "500",
  },
  emptyPrimaryButton: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  emptyPrimaryButtonLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  findCard: {
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 0,
  },
  findCardForEmpty: {
    marginTop: 22,
  },
  findIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  findTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },
  findSubtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 14,
    fontWeight: "500",
  },
  findButton: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  findButtonLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
});
