import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { ApiClientError, usersApi, type UserProfile as ApiUserProfile } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";

export interface UseMyProfileResult {
  profile: ApiUserProfile | null;
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/**
 * Loads the current user's profile from `/user-handler/me` and mirrors it into
 * the local store so any screen that reads `userProfile` sees server truth.
 *
 * Behavioral guarantees:
 *   • One in-flight request at a time — concurrent `refetch` calls (e.g. pull-
 *     to-refresh during the initial load) coalesce into the existing promise.
 *   • Never sets state on an unmounted component.
 *   • Auto-fetches on mount and whenever the bound user's email changes (sign-
 *     in or account switch).
 */
export function useMyProfile(): UseMyProfileResult {
  const { user } = useAuth();
  const setUserProfileFromApi = useAppStore((s) => s.setUserProfileFromApi);

  const [profile, setProfile] = useState<ApiUserProfile | null>(null);
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
        const res = await usersApi.getMyProfile();
        if (!mountedRef.current) return;
        const next = res.data?.profile ?? null;
        setProfile(next);
        if (next) setUserProfileFromApi(next, user?.email ?? "");
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
  }, [user?.email, setUserProfileFromApi]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return { profile, loading, error, refetch };
}
