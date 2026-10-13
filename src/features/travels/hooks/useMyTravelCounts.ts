import { useCallback, useEffect, useRef, useState } from "react";

import { fetchMyTravelCounts, type MyTravelCounts } from "@/features/travels/lib/travelCounts";

/**
 * The four My Travels tab counts, from `GET /user-handler/me/travel-counts`.
 *
 * `listSignature` is any string that changes when one of the screen's lists
 * changes (a delete, an accepted request, a realtime refresh, a pull to
 * refresh). The counts are refetched each time it does, so the labels follow
 * the lists without every action having to know about them.
 *
 * Until the first answer arrives the counts are `null` and the tabs show just
 * their names - a number that is absent, not a number that is wrong.
 */
export function useMyTravelCounts(listSignature: string) {
  const [counts, setCounts] = useState<MyTravelCounts | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    try {
      const next = await fetchMyTravelCounts();
      if (mountedRef.current) setCounts(next);
    } catch {
      // Counts are decoration: keep the last good ones rather than blanking
      // the tabs on a transient failure.
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // First load at once; later list changes are debounced, because the lists
  // settle one after another and each settle would otherwise be a request.
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      void refetch();
      return;
    }
    const t = setTimeout(() => void refetch(), 600);
    return () => clearTimeout(t);
  }, [refetch, listSignature]);

  return { counts, refetch };
}
