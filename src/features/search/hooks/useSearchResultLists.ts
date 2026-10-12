import { useMemo } from "react";

import { packageMatchOwnerIds, withoutBlocked } from "@/features/moderation/blockFilter";
import { useBlockedUsers } from "@/hooks/api/useBlockedUsers";
import { useParcels } from "@/hooks/api/useParcels";
import { useTrips } from "@/hooks/api/useTrips";
import type { PackageMatch, Parcel, Trip } from "@/services/api";
import {
  carrierTripMatchesParcel,
  parcelExceedsCapacity,
  parcelMatchesTrip,
} from "@/utils/routeMatch";
import type { UseSearchMatchesResult } from "@/hooks/api/useSearchMatches";
import {
  dedupeBuddyMatchesByUser,
  dedupePackageMatchesByPerson,
} from "@/features/search/lib/matchDedupe";

interface SearchResultListsInput {
  results: UseSearchMatchesResult["results"];
  loading: boolean;
  highlightId?: string;
}

/**
 * The lists the result tabs render: the user's own listings, and the matches
 * split by kind, blocked people removed, deduped per person and grouped under
 * the listing they fit. Moved verbatim out of SearchScreen.tsx.
 */
export function useSearchResultLists({ results, loading, highlightId }: SearchResultListsInput) {
  // In auto-match mode results are grouped under the user's own listings —
  // one card per parcel/trip with matches nested inside (mirrors web).
  const myTripsState = useTrips({ filter: "my_trips", perPage: 100 });
  const myParcelsState = useParcels({ filter: "my_parcels", perPage: 100 });

  // Blocked people (either direction) drop out of every result list here, so
  // the auto-match maps and tab counts below never see them. Server totals
  // still count them; the gap is at most the number of blocked people.
  const { hiddenUserIds } = useBlockedUsers();
  const visiblePackageMatches = useMemo(
    () => withoutBlocked(results?.package_matches ?? [], hiddenUserIds, packageMatchOwnerIds),
    [results, hiddenUserIds],
  );
  const carrierTrips = useMemo(
    () => visiblePackageMatches.filter((m) => m.type === "carrier_trip"),
    [visiblePackageMatches],
  );
  const receiverRequests = useMemo(
    () => visiblePackageMatches.filter((m) => m.type === "receive_request"),
    [visiblePackageMatches],
  );
  const buddyMatches = useMemo(
    () => withoutBlocked(results?.buddy_matches ?? [], hiddenUserIds, (b) => b.user?.id),
    [results, hiddenUserIds],
  );

  // Manual (filtered) lists render one card per listing, so the same person can
  // repeat when they have several listings — collapse to one card per person
  // (mirrors web). Auto-match dedupes per-listing inside the maps above.
  const displayCarrierTrips = useMemo(
    () => dedupePackageMatchesByPerson(carrierTrips, highlightId),
    [carrierTrips, highlightId],
  );
  const displayReceiverRequests = useMemo(
    () => dedupePackageMatchesByPerson(receiverRequests, highlightId),
    [receiverRequests, highlightId],
  );
  const dedupedBuddyMatches = useMemo(
    () => dedupeBuddyMatchesByUser(buddyMatches, highlightId),
    [buddyMatches, highlightId],
  );

  const sortedMyParcels: Parcel[] = useMemo(
    () =>
      myParcelsState.parcels
        // "matched" stays in: a listing with one deal can still take more
        // (multi-bidder + capacity) — web and the server include it too.
        .filter((p) => p.status === "open" || p.status === "looking_for_match" || p.status === "matched")
        .sort((a, b) => (a.delivery_by ?? "").localeCompare(b.delivery_by ?? "")),
    [myParcelsState.parcels],
  );
  const sortedMyTrips: Trip[] = useMemo(
    () =>
      myTripsState.trips
        .filter((t) => t.status === "active" || t.status === "looking_for_match" || t.status === "matched")
        .sort((a, b) => a.travel_date.localeCompare(b.travel_date)),
    [myTripsState.trips],
  );

  // Pre-compute per-listing matches at the parent so the tab counts and the
  // nested cards read from the same source (no auto-match drift).
  const carrierTripsByParcelId = useMemo(() => {
    const map = new Map<string, PackageMatch[]>();
    if (loading) return map;
    for (const parcel of sortedMyParcels) {
      map.set(
        parcel.id,
        dedupePackageMatchesByPerson(
          carrierTrips
            .filter((m) =>
              carrierTripMatchesParcel(
                {
                  from_city: m.from_city,
                  to_city: m.to_city,
                  any_from: m.any_from,
                  any_to: m.any_to,
                  travel_date: m.travel_date,
                },
                parcel,
              ),
            )
            // Flag (don't hide) trips whose capacity is under this parcel's weight.
            .map((m) => ({
              ...m,
              exceeds_capacity: parcelExceedsCapacity(parcel.weight_kg, m.luggage_capacity_kg),
            })),
          highlightId,
        ),
      );
    }
    return map;
  }, [loading, carrierTrips, sortedMyParcels, highlightId]);

  const receiverRequestsByTripId = useMemo(() => {
    const map = new Map<string, PackageMatch[]>();
    if (loading) return map;
    for (const trip of sortedMyTrips) {
      map.set(
        trip.id,
        dedupePackageMatchesByPerson(
          receiverRequests
            .filter(
              (m) =>
                m.delivery_by != null &&
                parcelMatchesTrip(
                  {
                    from_city: m.from_city,
                    to_city: m.to_city,
                    any_from: m.any_from,
                    any_to: m.any_to,
                    delivery_by: m.delivery_by,
                  },
                  trip,
                ),
            )
            // Flag (don't hide) receive requests heavier than this trip's capacity.
            .map((m) => ({
              ...m,
              exceeds_capacity: parcelExceedsCapacity(m.weight_kg, trip.luggage_capacity_kg),
            })),
          highlightId,
        ),
      );
    }
    return map;
  }, [loading, receiverRequests, sortedMyTrips, highlightId]);

  return {
    myTripsState,
    myParcelsState,
    carrierTrips,
    receiverRequests,
    buddyMatches,
    displayCarrierTrips,
    displayReceiverRequests,
    dedupedBuddyMatches,
    sortedMyParcels,
    sortedMyTrips,
    carrierTripsByParcelId,
    receiverRequestsByTripId,
  };
}
