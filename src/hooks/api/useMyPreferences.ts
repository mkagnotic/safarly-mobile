import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiClientError,
  usersApi,
  type UserPreferences,
} from "@/services/api";

export interface UseMyPreferencesResult {
  preferences: UserPreferences | null;
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
  /**
   * Optimistic mutate: applies the patch locally first, then PUTs. On server
   * failure, rolls back and re-throws so the caller can surface the error.
   * Keeps the UI snappy for toggle interactions.
   */
  update: (patch: Partial<UserPreferences>) => Promise<void>;
}

/**
 * Loads `/user-handler/me/preferences` and exposes an optimistic update
 * function. The auto-save UX on PreferencesScreen depends on the optimistic
 * path — we don't want a 250ms server round-trip latency on every toggle.
 */
export function useMyPreferences(): UseMyPreferencesResult {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refetch = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;

    const promise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await usersApi.getMyPreferences();
        if (!mountedRef.current) return;
        setPreferences(res.data ?? null);
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
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  const update = useCallback(
    async (patch: Partial<UserPreferences>) => {
      if (!preferences) {
        // Without a baseline we can't optimistically update — just send the
        // patch and let the next refetch pull the canonical state.
        const res = await usersApi.updateMyPreferences(patch);
        if (mountedRef.current) setPreferences(res.data ?? null);
        return;
      }
      const previous = preferences;
      const optimistic = { ...preferences, ...patch };
      setPreferences(optimistic);
      try {
        const res = await usersApi.updateMyPreferences(patch);
        // Server may normalize values (e.g. lowercase currency) — trust its echo.
        if (mountedRef.current && res.data) setPreferences(res.data);
      } catch (err) {
        if (mountedRef.current) setPreferences(previous); // rollback
        throw err;
      }
    },
    [preferences],
  );

  return { preferences, loading, error, refetch, update };
}
