import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiClientError,
  searchApi,
  type SearchFilters,
  type SearchResults,
} from "@/services/api";

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

  const runSearch = useCallback(async (filters: SearchFilters) => {
    const myToken = ++requestSeqRef.current;
    lastFiltersRef.current = filters;
    setLoading(true);
    setError(null);
    try {
      const res = await searchApi.search(filters);
      if (!mountedRef.current || myToken !== requestSeqRef.current) return;
      setResults(res.data ?? null);
    } catch (err) {
      if (!mountedRef.current || myToken !== requestSeqRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current && myToken === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

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

  return { results, loading, error, hasAppliedFilters, search, refetch };
}
