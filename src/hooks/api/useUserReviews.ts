import { useCallback, useEffect, useRef, useState } from "react";

import { ApiClientError, ratingsApi, type Rating, type UserRatings } from "@/services/api";

export interface UseUserReviewsOptions {
  perPage?: number;
}

export interface UseUserReviewsResult {
  reviews: Rating[];
  averageRating: number;
  total: number;
  breakdown: Record<string | number, number>;
  loading: boolean;
  /** True only while a `loadMore` is in flight (not the initial load). */
  loadingMore: boolean;
  error: ApiClientError | Error | null;
  hasMore: boolean;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Mirrors web's `useUserRatings(userId, { page, per_page })` (TanStack
 * Query) — single-resource fetch from `/rating-handler/users/{id}` plus
 * client-side pagination. Web uses page-based pagination controls;
 * mobile uses a "Load more" button that appends pages.
 *
 * The aggregate (average + breakdown + total) only reflects page 1's
 * server response — same behavior as web. Subsequent pages append rows
 * but don't change the aggregate.
 */
export function useUserReviews(
  userId: string | undefined,
  { perPage = 10 }: UseUserReviewsOptions = {},
): UseUserReviewsResult {
  const [reviews, setReviews] = useState<Rating[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [total, setTotal] = useState(0);
  const [breakdown, setBreakdown] = useState<Record<string | number, number>>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(Boolean(userId));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) return;
    if (inFlightRef.current) return inFlightRef.current;
    const promise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await ratingsApi.getUserRatings(userId, { page: 1, per_page: perPage });
        if (!mountedRef.current) return;
        const data = res.data as UserRatings | null;
        setReviews(data?.ratings ?? []);
        setAverageRating(data?.average_rating ?? 0);
        // Prefer top-level meta.total (matches web's lookup order); fall back
        // to the aggregate's total field.
        setTotal(res.meta?.total ?? data?.total ?? 0);
        setBreakdown(data?.breakdown ?? {});
        setPage(1);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (mountedRef.current) setLoading(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = promise;
    return promise;
  }, [userId, perPage]);

  const loadMore = useCallback(async () => {
    if (!userId) return;
    if (loadingMore || loading) return;
    if (reviews.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await ratingsApi.getUserRatings(userId, { page: next, per_page: perPage });
      if (!mountedRef.current) return;
      const data = res.data as UserRatings | null;
      const newRows = data?.ratings ?? [];
      setReviews((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...newRows.filter((r) => !seen.has(r.id))];
      });
      setTotal(res.meta?.total ?? total);
      setPage(next);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [userId, loadingMore, loading, reviews.length, total, page, perPage]);

  // Reset on userId change — same race-fix template as the detail hooks.
  useEffect(() => {
    setReviews([]);
    setAverageRating(0);
    setTotal(0);
    setBreakdown({});
    setError(null);
    setLoading(Boolean(userId));
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return {
    reviews,
    averageRating,
    total,
    breakdown,
    loading,
    loadingMore,
    error,
    hasMore: reviews.length < total,
    refetch,
    loadMore,
  };
}
