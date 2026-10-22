import { useCallback, useEffect, useRef, useState } from "react";

import { ApiClientError, kycApi, type KycStatusBlock, type KycSubmission } from "@/services/api";
import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";

export interface UseKycStatusResult {
  /** Raw server status string (may use either naming scheme — see flags below). */
  status: string;
  submission: KycSubmission | null;
  /** The server's verification block (provider, state, attempts…). null on older servers. */
  block: KycStatusBlock | null;
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
  /** A tapped "Check status": asks Didit now and returns the fresh block. */
  checkNow: () => Promise<KycStatusBlock | null>;
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
  const [block, setBlock] = useState<KycStatusBlock | null>(null);
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
        setBlock(res.data?.kyc ?? null);
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

  // Not coalesced with `refetch`: a background poll already in flight would hand
  // back an answer that never asked Didit, and the tap would look ignored again.
  const checkNow = useCallback(async () => {
    const res = await kycApi.getStatus(true);
    const next = res.data?.kyc ?? null;
    if (mountedRef.current) {
      setStatus(res.data?.status ?? "");
      setSubmission(res.data?.submission ?? null);
      setBlock(next);
      setError(null);
    }
    return next;
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

  // KYC approval / rejection is an admin action with no client-side trigger.
  useRealtimeBus("profile", refetch);

  return {
    status,
    submission,
    block,
    isVerified,
    isPending,
    isRejected,
    isNotStarted,
    loading,
    error,
    refetch,
    checkNow,
  };
}
