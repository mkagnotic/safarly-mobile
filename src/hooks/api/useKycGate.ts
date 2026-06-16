import { useCallback, useEffect, useRef, useState } from "react";

import { kycApi } from "@/services/api";

export interface UseKycGateResult {
  isApproved: boolean;
  isPending: boolean;
  isLoading: boolean;
  /** Raw status string from the server (for copy/debug). */
  status: string | null;
  refetch: () => Promise<void>;
}

const APPROVED = new Set(["approved", "verified", "active"]);
const PENDING = new Set(["pending", "in_review", "submitted", "processing"]);

/** Reads `/kyc-handler/status` and normalizes it into approved / pending flags. */
export function useKycGate(): UseKycGateResult {
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await kycApi.getStatus();
      if (mountedRef.current) setStatus(res.data?.status ?? null);
    } catch {
      // Fail safe to "not approved" — the server still enforces KYC_REQUIRED.
      if (mountedRef.current) setStatus(null);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  const normalized = (status ?? "").toLowerCase();
  return {
    isApproved: APPROVED.has(normalized),
    isPending: PENDING.has(normalized),
    isLoading,
    status,
    refetch,
  };
}
