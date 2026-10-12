import { useMemo } from "react";

import type { BuddySearchMatch, PackageMatch, Parcel, Trip } from "@/services/api";
import type { UseSearchMatchesResult } from "@/hooks/api/useSearchMatches";
import {
  AUTO_BUDDY_PER_PAGE,
  AUTO_PER_PAGE,
  MANUAL_PER_PAGE,
} from "@/features/search/lib/searchConfig";

interface SearchPagingInput {
  isAutoMatch: boolean;
  results: UseSearchMatchesResult["results"];
  carrierTrips: PackageMatch[];
  carrierTripsByParcelId: Map<string, PackageMatch[]>;
  receiverRequests: PackageMatch[];
  receiverRequestsByTripId: Map<string, PackageMatch[]>;
  dedupedBuddyMatches: BuddySearchMatch[];
  sortedMyParcels: Parcel[];
  sortedMyTrips: Trip[];
  autoPkgPage: number;
  autoRcvPage: number;
  autoBuddyPage: number;
}

/** How many distinct listings appear across per-listing match groups. */
export function countUniqueMatches(groups: ReadonlyMap<string, readonly { id: string }[]>): number {
  const ids = new Set<string>();
  for (const list of groups.values()) for (const m of list) ids.add(m.id);
  return ids.size;
}

/**
 * Tab counts, page totals and the client-side pages of the auto-match lists.
 * Moved verbatim out of SearchScreen.tsx.
 */
export function useSearchPaging({
  isAutoMatch,
  results,
  carrierTrips,
  carrierTripsByParcelId,
  receiverRequests,
  receiverRequestsByTripId,
  dedupedBuddyMatches,
  sortedMyParcels,
  sortedMyTrips,
  autoPkgPage,
  autoRcvPage,
  autoBuddyPage,
}: SearchPagingInput) {
  // Auto-match: the number of DIFFERENT listings that match, not the sum of the
  // per-listing groups - a trip that fits two of your parcels appears under
  // both, and summing the groups counted it twice.
  const packageTabCount = useMemo(() => {
    if (!isAutoMatch) return results?.carrier_total ?? carrierTrips.length;
    return countUniqueMatches(carrierTripsByParcelId);
  }, [isAutoMatch, results?.carrier_total, carrierTrips, carrierTripsByParcelId]);

  const receiverTabCount = useMemo(() => {
    if (!isAutoMatch) return results?.receive_total ?? receiverRequests.length;
    return countUniqueMatches(receiverRequestsByTripId);
  }, [isAutoMatch, results?.receive_total, receiverRequests, receiverRequestsByTripId]);

  const buddyTabCount = isAutoMatch
    ? dedupedBuddyMatches.length
    : results?.buddy_total ?? dedupedBuddyMatches.length;

  // Total pages per list (manual mode only). One-based, min 1.
  const carrierPages = Math.max(1, Math.ceil(packageTabCount / MANUAL_PER_PAGE));
  const receiverPages = Math.max(1, Math.ceil(receiverTabCount / MANUAL_PER_PAGE));
  const buddyPages = Math.max(1, Math.ceil(buddyTabCount / MANUAL_PER_PAGE));

  // Auto-match lists come back in bulk, so slice them client-side — a handful
  // of cards at a time instead of one endless scroll (mirrors web). Clamp the
  // page in case the underlying list shrank since it was last set.
  const autoPkgPages = Math.max(1, Math.ceil(sortedMyParcels.length / AUTO_PER_PAGE));
  const safeAutoPkgPage = Math.min(autoPkgPage, autoPkgPages);
  const pagedMyParcels = useMemo(
    () =>
      sortedMyParcels.slice(
        (safeAutoPkgPage - 1) * AUTO_PER_PAGE,
        safeAutoPkgPage * AUTO_PER_PAGE,
      ),
    [sortedMyParcels, safeAutoPkgPage],
  );

  const autoRcvPages = Math.max(1, Math.ceil(sortedMyTrips.length / AUTO_PER_PAGE));
  const safeAutoRcvPage = Math.min(autoRcvPage, autoRcvPages);
  const pagedMyTrips = useMemo(
    () =>
      sortedMyTrips.slice(
        (safeAutoRcvPage - 1) * AUTO_PER_PAGE,
        safeAutoRcvPage * AUTO_PER_PAGE,
      ),
    [sortedMyTrips, safeAutoRcvPage],
  );

  const autoBuddyPages = Math.max(1, Math.ceil(dedupedBuddyMatches.length / AUTO_BUDDY_PER_PAGE));
  const safeAutoBuddyPage = Math.min(autoBuddyPage, autoBuddyPages);
  const pagedBuddyMatches = useMemo(
    () =>
      dedupedBuddyMatches.slice(
        (safeAutoBuddyPage - 1) * AUTO_BUDDY_PER_PAGE,
        safeAutoBuddyPage * AUTO_BUDDY_PER_PAGE,
      ),
    [dedupedBuddyMatches, safeAutoBuddyPage],
  );

  return {
    packageTabCount,
    receiverTabCount,
    buddyTabCount,
    carrierPages,
    receiverPages,
    buddyPages,
    autoPkgPages,
    safeAutoPkgPage,
    pagedMyParcels,
    autoRcvPages,
    safeAutoRcvPage,
    pagedMyTrips,
    autoBuddyPages,
    safeAutoBuddyPage,
    pagedBuddyMatches,
  };
}
