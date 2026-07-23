import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import {
  ApiClientError,
  searchApi,
  type SearchFilters,
  type SearchResults,
} from "@/services/api";

/** Web parity: web polls search every 30s (`refetchInterval`) so freshly posted
 *  trips/parcels surface without a manual refresh. */
const POLL_INTERVAL_MS = 30_000;

export interface UseSearchMatchesOptions {
  /**
   * Filters to fetch on mount. Web's CustomerSearch passes
   * `{ per_page: 50, match_my_routes: true }` so the screen renders auto-
   * matched results before the user touches the filter form. Pass `null` to
   * skip the initial fetch (lazy mode).
   */
  initialFilters?: SearchFilters | null;
}

export interface UseSearchMatchesResult {
  results: SearchResults | null;
  loading: boolean;
  error: ApiClientError | Error | null;
  /** True if `search()` has been called at least once with explicit filters. */
  hasAppliedFilters: boolean;
  /** Run a fresh search with the given filters. Resolves on success. */
  search: (filters: SearchFilters) => Promise<void>;
  /** Re-run the most recent successful query. Useful for pull-to-refresh. */
  refetch: () => Promise<void>;
  /** Drop applied filters and reload the free auto-match results. */
  resetToAutoMatch: () => Promise<void>;
}

/**
 * Search hook that mirrors web's `useSearchMatches` semantics:
 *   - Auto-fetches on mount with `initialFilters` (default: auto-match mode).
 *   - `search(filters)` replaces the in-flight query with the user's explicit
 *     filters and re-fetches.
 *   - Previous results stay visible while a new request is in flight, so the
 *     UI doesn't flash empty between fetches.
 *   - Request-sequence guard prevents a slow earlier response from clobbering
 *     a fresher later one.
 */
export function useSearchMatches({
  initialFilters,
}: UseSearchMatchesOptions = {}): UseSearchMatchesResult {
  const defaultInitial: SearchFilters | null =
    initialFilters === undefined ? { per_page: 50, match_my_routes: true } : initialFilters;

  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState<boolean>(defaultInitial !== null);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false);

  const mountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const lastFiltersRef = useRef<SearchFilters | null>(defaultInitial);
  // Captured once so "Clear" can always restore the free auto-match query.
  const autoMatchFiltersRef = useRef<SearchFilters | null>(defaultInitial);
  // True while a user-initiated (non-silent) request is in flight, so the
  // background poll can stand down and never discard the foreground result.
  const foregroundBusyRef = useRef(false);

  const runSearch = useCallback(
    async (filters: SearchFilters, opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      const myToken = ++requestSeqRef.current;
      lastFiltersRef.current = filters;
      // A silent background poll must not flash the loading UI or clobber good
      // results with a transient error — it only ever swaps in fresher data.
      if (!silent) {
        foregroundBusyRef.current = true;
        setLoading(true);
        setError(null);
      }
      try {
        const res = await searchApi.search(filters);
        if (!mountedRef.current || myToken !== requestSeqRef.current) return;
        setResults(res.data ?? null);
        if (silent) setError(null); // a good refresh clears any stale error
      } catch (err) {
        if (!mountedRef.current || myToken !== requestSeqRef.current) return;
        if (!silent) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (mountedRef.current && myToken === requestSeqRef.current && !silent) {
          setLoading(false);
        }
        if (!silent) foregroundBusyRef.current = false;
      }
    },
    [],
  );

  /** Silent re-run of the current query (poll / focus). Skips while a foreground
   *  request is in flight, and never toggles loading or consumes quota. */
  const silentRefetch = useCallback(async () => {
    if (foregroundBusyRef.current) return;
    if (lastFiltersRef.current) await runSearch(lastFiltersRef.current, { silent: true });
  }, [runSearch]);

  // Auto-fetch on mount when initialFilters is set.
  // We intentionally omit defaultInitial / runSearch from deps — the initial
  // fetch should fire exactly once on mount, not whenever the parent re-renders
  // with a new object identity.
  useEffect(() => {
    mountedRef.current = true;
    if (defaultInitial !== null) {
      void runSearch(defaultInitial);
    }
    return () => {
      mountedRef.current = false;
    };

  }, []);

  // Web parity (`refetchOnWindowFocus` + `refetchInterval: 30s`): refetch when
  // the screen regains focus, then poll every 30s WHILE focused. The interval is
  // torn down on blur, so there's no background polling. All silent — see
  // `silentRefetch`. The mount fetch (above) runs first and raises the busy
  // flag, so the initial focus poll no-ops rather than double-fetching.
  useFocusEffect(
    useCallback(() => {
      void silentRefetch();
      const id = setInterval(() => void silentRefetch(), POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [silentRefetch]),
  );

  const search = useCallback(
    async (filters: SearchFilters) => {
      setHasAppliedFilters(true);
      await runSearch(filters);
    },
    [runSearch],
  );

  const refetch = useCallback(async () => {
    if (lastFiltersRef.current) {
      await runSearch(lastFiltersRef.current);
    }
  }, [runSearch]);

  const resetToAutoMatch = useCallback(async () => {
    setHasAppliedFilters(false);
    if (autoMatchFiltersRef.current) {
      await runSearch(autoMatchFiltersRef.current);
    }
  }, [runSearch]);

  return { results, loading, error, hasAppliedFilters, search, refetch, resetToAutoMatch };
}
