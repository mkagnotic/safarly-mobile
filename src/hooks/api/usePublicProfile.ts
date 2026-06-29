import { useCallback, useEffect, useRef, useState } from "react";

import { ApiClientError, usersApi, type UserProfile } from "@/services/api";

export interface UsePublicProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/**
 * Single-resource fetch for another user's public profile
 * (`GET /user-handler/{id}`). Mirrors web's `usePublicProfile`. Same
 * race-safe template as the detail hooks — a stale response can't clobber a
 * fresher one after `userId` changes.
 */
export function usePublicProfile(userId: string | undefined): UsePublicProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await usersApi.getPublicProfile(userId);
      if (!mountedRef.current) return;
      setProfile(res.data ?? null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  // Reset + refetch whenever the target user changes.
  useEffect(() => {
    mountedRef.current = true;
    setProfile(null);
    setError(null);
    setLoading(Boolean(userId));
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch, userId]);

  return { profile, loading, error, refetch };
}
