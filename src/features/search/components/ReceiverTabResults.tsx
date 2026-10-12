import { Text, View } from "react-native";

import { RouteListingCard } from "@/features/search/RouteListingCard";
import type { PackageMatch, Trip } from "@/services/api";
import { formatTravelDateRange } from "@/utils/travelDate";
import { PackageMatchCard } from "@/features/search/components/PackageMatchCard";
import {
  MatchCardSkeleton,
  MatchListSkeleton,
  MyListingSkeleton,
} from "@/features/search/components/SearchSkeletons";
import { EmptyResults } from "@/features/search/components/SearchStates";
import type { Nav } from "@/features/search/lib/navigation";
import { sharedStyles } from "@/features/search/searchStyles";

export function ReceiverTabResults({
  loading,
  isAutoMatch,
  myTrips,
  myTripsLoading,
  matches,
  matchesByTripId,
  navigation,
  highlightId,
}: Readonly<{
  loading: boolean;
  isAutoMatch: boolean;
  myTrips: Trip[];
  myTripsLoading: boolean;
  matches: PackageMatch[];
  /** Pre-filtered per-trip match lists (same source as the tab count). */
  matchesByTripId: Map<string, PackageMatch[]>;
  navigation: Nav;
  highlightId?: string;
}>) {
  if (isAutoMatch) {
    if (myTripsLoading && myTrips.length === 0)
      return (
        <View>
          <MyListingSkeleton />
          <MyListingSkeleton />
        </View>
      );
    if (myTrips.length === 0)
      return (
        <EmptyResults
          icon="mail-outline"
          title="No trips listed"
          body="List a trip to see receiver requests on your route."
        />
      );
    return (
      <View>
        {myTrips.map((trip) => {
          const matched = matchesByTripId.get(trip.id) ?? [];
          return (
            <RouteListingCard
              key={trip.id}
              fromCity={trip.from_city}
              toCity={trip.to_city}
              kind="trip"
              dateLabel={formatTravelDateRange(trip, { year: true })}
              secondary={
                trip.airline ? { label: "AIRLINE", value: trip.airline } : undefined
              }
            >
              {loading ? (
                <MatchCardSkeleton />
              ) : matched.length === 0 ? (
                <Text style={sharedStyles.nestedEmpty}>
                  No receiver requests yet for this route or date.
                </Text>
              ) : (
                <View>
                  <Text style={sharedStyles.nestedHeading}>RECEIVER REQUESTS</Text>
                  {matched.map((m, i) => (
                    <View
                      key={`${m.type}-${m.id}`}
                      style={i > 0 ? sharedStyles.nestedDivider : undefined}
                    >
                      <PackageMatchCard
                        match={m}
                        navigation={navigation}
                        nested
                        highlighted={m.id === highlightId}
                      />
                    </View>
                  ))}
                </View>
              )}
            </RouteListingCard>
          );
        })}
      </View>
    );
  }

  if (loading && matches.length === 0) return <MatchListSkeleton />;
  if (matches.length === 0)
    return (
      <EmptyResults
        icon="mail-outline"
        title="No receiver requests"
        body="Try widening your filters or date range."
      />
    );
  return (
    <View>
      {matches.map((m) => (
        <PackageMatchCard
          key={`${m.type}-${m.id}`}
          match={m}
          navigation={navigation}
          highlighted={m.id === highlightId}
        />
      ))}
    </View>
  );
}
