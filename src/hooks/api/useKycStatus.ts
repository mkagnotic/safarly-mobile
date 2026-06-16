import { useCallback, useEffect, useRef, useState } from "react";

import { ApiClientError, kycApi, type KycSubmission } from "@/services/api";

export interface UseKycStatusResult {
  /** Raw server status string (may use either naming scheme — see flags below). */
  status: string;
  submission: KycSubmission | null;
  /** `verified` ≡ `approved`. */
  isVerified: boolean;
  /** `pending` ≡ `submitted` (under review). */
  isPending: boolean;
  isRejected: boolean;
  /** No submission yet — show the intro + first-time form. */
  isNotStarted: boolean;
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

const VERIFIED = new Set(["verified", "approved", "active"]);
const PENDING = new Set(["pending", "submitted", "in_review", "processing"]);
const NOT_STARTED = new Set(["", "not_started", "none"]);

/**
 * Reads `/kyc-handler/status` and normalizes the backend's dual status naming
 * into stable flags. Mirrors web's `useKycStatus`; coalesces concurrent
 * refetches and never writes into an unmounted component.
 */
export function useKycStatus(): UseKycStatusResult {
  const [status, setStatus] = useState<string>("");
  const [submission, setSubmission] = useState<KycSubmission | null>(null);
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
        const res = await kycApi.getStatus();
        if (!mountedRef.current) return;
        setStatus(res.data?.status ?? "");
        setSubmission(res.data?.submission ?? null);
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

  const normalized = status.toLowerCase();
  const isVerified = VERIFIED.has(normalized);
  const isPending = PENDING.has(normalized);
  // First-time only when there's genuinely no submission on record. Any unknown
  // non-verified/non-pending status (e.g. admin "resubmission requested") is
  // treated as action-needed by the screen, not as a blank intro (edge case 20).
  const isNotStarted = !submission && NOT_STARTED.has(normalized);
  const isRejected = !isVerified && !isPending && !isNotStarted;

  return {
    status,
    submission,
    isVerified,
    isPending,
    isRejected,
    isNotStarted,
    loading,
    error,
    refetch,
  };
}
