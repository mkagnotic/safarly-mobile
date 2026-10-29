import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { kycApi } from "@/services/api";
import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { isKycApprovedStatus, isKycPendingStatus } from "@/features/profile/kycGateStatus";

export interface UseKycGateResult {
  isApproved: boolean;
  isPending: boolean;
  isLoading: boolean;
  /** Raw status string from the server (for copy/debug). */
  status: string | null;
  /** The status could not be read - NOT the same as "not verified". */
  isError: boolean;
  /**
   * Re-reads the status from the server and resolves to whether it is approved
   * NOW — so a caller can act on the fresh answer instead of the state from the
   * last render (e.g. Pay right after coming back from verification).
   */
  refetch: () => Promise<boolean>;
  /** Whether the LAST read failed, known right after `await refetch()` (state lags a render). */
  lastReadFailed: () => boolean;
}

/**
 * Reads `/kyc-handler/status` and normalizes it into approved / pending flags.
 *
 * ⚠️ Re-reads whenever the screen comes back into view and when the app returns
 * to the foreground. It used to read ONCE on mount, and tab screens stay mounted:
 * a user who opened Pay, tapped Verify, got verified and came back still saw
 * "Identity verification required" — and Pay was blocked in the app before the
 * request ever reached the server, which would have accepted it.
 */
export function useKycGate(): UseKycGateResult {
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const mountedRef = useRef(true);
  const failedRef = useRef(false);

  const refetch = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await kycApi.getStatus();
      const next = res.data?.status ?? null;
      failedRef.current = false;
      if (mountedRef.current) { setStatus(next); setIsError(false); }
      return isKycApprovedStatus(next);
    } catch {
      // Fail safe to "not approved" — the server still enforces KYC_REQUIRED.
      failedRef.current = true;
      if (mountedRef.current) { setStatus(null); setIsError(true); }
      return false;
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Every time the screen gains focus — including the first time it opens.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  // Back from the system browser (verification) or from the background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  // A webhook approval while the screen is open (Pay, payouts): the realtime
  // "profile" bump re-reads it, as useKycStatus and web already do.
  useRealtimeBus("profile", refetch);

  return {
    isApproved: isKycApprovedStatus(status),
    isPending: isKycPendingStatus(status),
    isLoading,
    isError,
    status,
    refetch,
    lastReadFailed: () => failedRef.current,
  };
}
