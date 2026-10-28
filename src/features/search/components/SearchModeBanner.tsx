import { StyleSheet, Text, View } from "react-native";

import type { ResultsTab } from "@/features/search/searchPersistence";
import { colors } from "@/theme/colors";

interface SearchModeBannerProps {
  /** 28 Oct 2026: only in "Matches for my routes" with no filters (web isAutoMatch). */
  isAutoMatch: boolean;
  activeTab: ResultsTab;
  myParcelsCount: number;
  myTripsCount: number;
  myBuddyCount: number;
}

export function SearchModeBanner({
  isAutoMatch,
  activeTab,
  myParcelsCount,
  myTripsCount,
  myBuddyCount,
}: Readonly<SearchModeBannerProps>) {
  if (!isAutoMatch) return null;

  let body: string | null = null;
  if (activeTab === "package") {
    body =
      myParcelsCount > 0
        ? `Showing carrier trips matching your ${myParcelsCount} active parcel request${myParcelsCount === 1 ? "" : "s"} (same route and dates).`
        : "List a parcel request to see carriers on your route.";
  } else if (activeTab === "buddy") {
    body =
      myBuddyCount > 0
        ? `Showing buddies matching your ${myBuddyCount} route${myBuddyCount === 1 ? "" : "s"} (same route and dates).`
        : "Create a buddy listing or turn on Travel buddy for a trip to see travel companions.";
  } else {
    body =
      myTripsCount > 0
        ? `Showing receiver requests matching your ${myTripsCount} active trip${myTripsCount === 1 ? "" : "s"} (same route and dates).`
        : "List a trip to see receiver requests on your route.";
  }

  return (
    <View style={styles.modeBanner}>
      <Text style={styles.modeBannerText}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modeBanner: { paddingHorizontal: 4, paddingBottom: 10 },
  modeBannerText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
});
