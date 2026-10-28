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
import { EmptyResults, ErrorBlock } from "@/features/search/components/SearchStates";
import type { Nav } from "@/features/search/lib/navigation";
import { sharedStyles } from "@/features/search/searchStyles";
import type { PersonGroup } from "@/features/search/lib/matchDedupe";

export function ReceiverTabResults({
  loading,
  hasAppliedFilters,
  isAutoMatch,
  myTrips,
  myTripsLoading,
  myTripsError,
  onRetryMyTrips,
  matches,
  groupsByTripId,
  othersById,
  navigation,
  highlightId,
  focusId,
  ringGroupId,
  onFocusCardLayout,
}: Readonly<{
  loading: boolean;
  /** Filters are applied: the flat empty state suggests widening them. */
  hasAppliedFilters: boolean;
  isAutoMatch: boolean;
  myTrips: Trip[];
  myTripsLoading: boolean;
  /** Loading YOUR trips failed: say so, rather than "No trips listed". */
  myTripsError: unknown;
  onRetryMyTrips: () => void;
  matches: PackageMatch[];
  /** Pre-filtered per-trip match lists, one group per person (same source as the tab count). */
  groupsByTripId: Map<string, PersonGroup<PackageMatch>[]>;
  /** Flat list: each card's other listings from the same person ("+N more"). */
  othersById: Map<string, PackageMatch[]>;
  navigation: Nav;
  highlightId?: string;
  /** What a match notification scrolls to: one of your listings' groups, or (flat
   *  list) the card. Its y is reported via `onFocusCardLayout`. */
  focusId?: string | null;
  /** Ring every match under this listing for a moment (multi-match summary). */
  ringGroupId?: string;
  onFocusCardLayout?: (y: number) => void;
}>) {
  if (isAutoMatch) {
    if (myTripsLoading && myTrips.length === 0)
      return (
        <View>
          <MyListingSkeleton />
          <MyListingSkeleton />
        </View>
      );
    if (myTripsError && myTrips.length === 0)
      return <ErrorBlock title="Couldn't load your trips" onRetry={onRetryMyTrips} />;
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
          const matched = groupsByTripId.get(trip.id) ?? [];
          return (
            <View
              key={trip.id}
              onLayout={
                trip.id === focusId && onFocusCardLayout
                  ? (e) => onFocusCardLayout(e.nativeEvent.layout.y)
                  : undefined
              }
            >
            <RouteListingCard
              fromCity={trip.from_city}
              toCity={trip.to_city}
              kind="trip"
              dateLabel={formatTravelDateRange(trip, { year: true })}
              secondary={
                trip.airline ? { label: "Airline", value: trip.airline } : undefined
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
                  <Text style={sharedStyles.nestedHeading}>Receiver requests</Text>
                  {matched.map(({ primary: m, others }, i) => (
                    <View
                      key={`${m.type}-${m.id}`}
                      style={i > 0 ? sharedStyles.nestedDivider : undefined}
                    >
                      <PackageMatchCard
                        match={m}
                        navigation={navigation}
                        nested
                        highlighted={m.id === highlightId || trip.id === ringGroupId}
                        others={others}
                        highlightId={highlightId}
                      />
                    </View>
                  ))}
                </View>
              )}
            </RouteListingCard>
            </View>
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
        body={
          hasAppliedFilters
            ? "Try widening your filters or date range."
            : "Nothing posted on this route yet. Check back soon."
        }
      />
    );
  return (
    <View>
      {matches.map((m) => (
        <View
          key={`${m.type}-${m.id}`}
          onLayout={
            m.id === focusId && onFocusCardLayout
              ? (e) => onFocusCardLayout(e.nativeEvent.layout.y)
              : undefined
          }
        >
          <PackageMatchCard
            match={m}
            navigation={navigation}
            highlighted={m.id === highlightId}
            others={othersById.get(m.id)}
            highlightId={highlightId}
          />
        </View>
      ))}
    </View>
  );
}
