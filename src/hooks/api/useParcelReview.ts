import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import {
  ApiClientError,
  carriersApi,
  type ParcelReviewReason,
  type ParcelReviewState,
  type RNUploadFile,
} from "@/services/api";

/** Which parcel-review action is currently in flight. */
export type ParcelReviewPending = "upload" | "approve" | "reject" | "cancel" | null;

export interface UseParcelReviewResult {
  review: ParcelReviewState | null;
  loading: boolean;
  error: ApiClientError | Error | null;
  pending: ParcelReviewPending;
  refetch: () => Promise<void>;
  /** Sender: upload/re-upload parcel photos (image or PDF, min 2). */
  upload: (files: RNUploadFile[]) => Promise<void>;
  /** Carrier: approve the parcel. */
  approve: () => Promise<void>;
  /** Carrier: request changes with a reason (and optional note). */
  reject: (reason: ParcelReviewReason, note?: string) => Promise<void>;
  /** Sender: cancel the carrier's request after a reject. */
  cancel: () => Promise<void>;
}

/**
 * Parcel-photo review state + actions for a carrier_request — the mirror of
 * [[useTravelDoc]] with the roles swapped: the SENDER uploads photos and the
 * CARRIER approves or requests changes. Server-owned; this only fetches
 * `getParcelReview` and forwards the actions.
 *
 * Pass `null` for `requestId` to keep the hook idle (no fetch); the chat screen
 * only enables it while the deal is in the parcel-review stage. Refreshes on the
 * `carrier-requests` and `messages` topics — the same signals that move the pin.
 */
export function useParcelReview(requestId: string | null): UseParcelReviewResult {
  const [review, setReview] = useState<ParcelReviewState | null>(null);
  const [loading, setLoading] = useState(Boolean(requestId));
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [pending, setPending] = useState<ParcelReviewPending>(null);

  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    if (!requestId) {
      setReview(null);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await carriersApi.getParcelReview(requestId);
      if (!mountedRef.current) return;
      setReview(res.data ?? null);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof ApiClientError && (err.status === 404 || err.status === 403)) {
        setReview(null);
      } else {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  useRealtimeBus("carrier-requests", refetch);
  useRealtimeBus("messages", refetch);

  const upload = useCallback(
    async (files: RNUploadFile[]) => {
      if (!requestId) return;
      setPending("upload");
      try {
        await carriersApi.uploadParcelReview(requestId, files);
        await refetch();
      } finally {
        if (mountedRef.current) setPending(null);
      }
    },
    [requestId, refetch],
  );

  const approve = useCallback(async () => {
    if (!requestId) return;
    setPending("approve");
    try {
      await carriersApi.approveParcelReview(requestId);
      await refetch();
    } finally {
      if (mountedRef.current) setPending(null);
    }
  }, [requestId, refetch]);

  const reject = useCallback(
    async (reason: ParcelReviewReason, note?: string) => {
      if (!requestId) return;
      setPending("reject");
      try {
        await carriersApi.rejectParcelReview(requestId, reason, note);
        await refetch();
      } finally {
        if (mountedRef.current) setPending(null);
      }
    },
    [requestId, refetch],
  );

  const cancel = useCallback(async () => {
    if (!requestId || !review?.parcel_id) return;
    setPending("cancel");
    try {
      // The sender declines the carrier's bid — web uses the same rejectBid path.
      await carriersApi.rejectBid(review.parcel_id, requestId);
      await refetch();
    } finally {
      if (mountedRef.current) setPending(null);
    }
  }, [requestId, review?.parcel_id, refetch]);

  return { review, loading, error, pending, refetch, upload, approve, reject, cancel };
}
