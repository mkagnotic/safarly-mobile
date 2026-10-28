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
  groupBuddyMatchesByUser,
  groupPackageMatchesByPerson,
  type PersonGroup,
} from "@/features/search/lib/matchDedupe";

/** The card each group shows - what the old one-card-per-person dedupe returned. */
const primaries = <T,>(groups: PersonGroup<T>[]): T[] => groups.map((g) => g.primary);

/** Card id -> that person's other listings in the same list ("+N more"). */
const othersByPrimaryId = <T extends { id: string }>(groups: PersonGroup<T>[]) =>
  new Map(groups.map((g) => [g.primary.id, g.others]));

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
  // (mirrors web). Auto-match dedupes per-listing inside the maps above. The
  // person's other listings are kept for the card's "+N more" (client, 22 Oct
  // 2026); the lists below stay one entry per card, so counts and paging don't move.
  const carrierTripGroups = useMemo(
    () => groupPackageMatchesByPerson(carrierTrips, highlightId),
    [carrierTrips, highlightId],
  );
  const receiverRequestGroups = useMemo(
    () => groupPackageMatchesByPerson(receiverRequests, highlightId),
    [receiverRequests, highlightId],
  );
  const buddyGroups = useMemo(
    () => groupBuddyMatchesByUser(buddyMatches, highlightId),
    [buddyMatches, highlightId],
  );
  const displayCarrierTrips = useMemo(() => primaries(carrierTripGroups), [carrierTripGroups]);
  const displayReceiverRequests = useMemo(() => primaries(receiverRequestGroups), [receiverRequestGroups]);
  const dedupedBuddyMatches = useMemo(() => primaries(buddyGroups), [buddyGroups]);
  const carrierTripOthers = useMemo(() => othersByPrimaryId(carrierTripGroups), [carrierTripGroups]);
  const receiverRequestOthers = useMemo(() => othersByPrimaryId(receiverRequestGroups), [receiverRequestGroups]);
  const buddyOthers = useMemo(() => othersByPrimaryId(buddyGroups), [buddyGroups]);

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
  const carrierTripGroupsByParcelId = useMemo(() => {
    const map = new Map<string, PersonGroup<PackageMatch>[]>();
    if (loading) return map;
    for (const parcel of sortedMyParcels) {
      map.set(
        parcel.id,
        groupPackageMatchesByPerson(
          carrierTrips
            // ⚠️ The WHOLE row, as web passes it (28 Oct 2026). A copy of just the
            // cities + `any_*` + travel_date dropped the countries, and "Any city"
            // only bounds itself by country: an Any trip then sat under every
            // parcel of the right dates, whatever its country.
            .filter((m) => carrierTripMatchesParcel(m, parcel))
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

  const receiverRequestGroupsByTripId = useMemo(() => {
    const map = new Map<string, PersonGroup<PackageMatch>[]>();
    if (loading) return map;
    for (const trip of sortedMyTrips) {
      map.set(
        trip.id,
        groupPackageMatchesByPerson(
          receiverRequests
            .filter(
              // The whole row (countries + delivery window), as web passes it.
              (m) => m.delivery_by != null && parcelMatchesTrip({ ...m, delivery_by: m.delivery_by }, trip),
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

  // One entry per card under each listing (the tab counts and focus read these).
  const carrierTripsByParcelId = useMemo(
    () => new Map([...carrierTripGroupsByParcelId].map(([id, groups]) => [id, primaries(groups)])),
    [carrierTripGroupsByParcelId],
  );
  const receiverRequestsByTripId = useMemo(
    () => new Map([...receiverRequestGroupsByTripId].map(([id, groups]) => [id, primaries(groups)])),
    [receiverRequestGroupsByTripId],
  );

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
    carrierTripGroupsByParcelId,
    receiverRequestGroupsByTripId,
    carrierTripOthers,
    receiverRequestOthers,
    buddyOthers,
  };
}
