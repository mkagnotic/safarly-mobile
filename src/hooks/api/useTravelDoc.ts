import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { bumpRealtimeTopic } from "@/store/realtimeBus";
import {
  ApiClientError,
  carriersApi,
  type RNUploadFile,
  type TravelDocState,
} from "@/services/api";

/** Which travel-doc action is currently in flight (spins the matching button). */
export type TravelDocPending =
  | "upload"
  | "approve"
  | "reject"
  | "admin"
  | "withdraw"
  | null;

export interface UseTravelDocResult {
  doc: TravelDocState | null;
  loading: boolean;
  error: ApiClientError | Error | null;
  pending: TravelDocPending;
  refetch: () => Promise<void>;
  /** Carrier: upload/re-upload a boarding pass or ticket (image or PDF). */
  upload: (file: RNUploadFile) => Promise<void>;
  /** Sender: approve the uploaded document (unlocks payment). */
  approve: () => Promise<void>;
  /** Sender: request a re-upload with a reason. */
  reject: (reason: string) => Promise<void>;
  /** Carrier: escalate to admin after exhausting attempts. */
  requestAdminReview: () => Promise<void>;
  /** Carrier: cancel the match after a failed verification. */
  withdraw: () => Promise<void>;
}

/**
 * Travel-document verification state + actions for a carrier_request, the mobile
 * counterpart of web's `useTravelDoc` family (`hooks/api/useCarriers.ts`). The
 * whole flow is server-owned — this only fetches `getTravelDoc` and forwards the
 * carrier's upload/escalate and the sender's approve/reject.
 *
 * Pass `null` for `requestId` to keep the hook idle (no fetch); the chat screen
 * only enables it while the deal is in a travel-verification state, so we don't
 * hit the endpoint for every conversation.
 *
 * Refreshes on the `carrier-requests` and `messages` realtime topics — the same
 * signals that move the workflow pin — so the modal stays in sync without polling.
 */
export function useTravelDoc(requestId: string | null): UseTravelDocResult {
  const [doc, setDoc] = useState<TravelDocState | null>(null);
  const [loading, setLoading] = useState(Boolean(requestId));
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [pending, setPending] = useState<TravelDocPending>(null);

  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    if (!requestId) {
      setDoc(null);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await carriersApi.getTravelDoc(requestId);
      if (!mountedRef.current) return;
      setDoc(res.data ?? null);
    } catch (err) {
      if (!mountedRef.current) return;
      // 404/403 → no deal or not ours: clear rather than surface a scary error.
      if (err instanceof ApiClientError && (err.status === 404 || err.status === 403)) {
        setDoc(null);
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

  /**
   * After a local review action the PIN has to advance too, not just this card.
   * `useActiveDeal` (which drives the chat pin) listens on the "carrier-requests"
   * and "messages" topics, but nothing was bumping them locally — so the pin only
   * caught up when the SERVER's realtime event arrived. During that window the pin
   * still showed the old step with its button live, users read it as "nothing
   * happened" and pressed again, and the second press hit a 409 for an action that
   * had already succeeded. Bumping here refreshes the pin in the same tick as the
   * card, and `pending` stays set until it is done.
   *
   * Costs one redundant refetch of THIS hook, which also listens on those
   * topics. Cheap, and worth it to keep every consumer in step from one call.
   */
  const syncDealPin = useCallback(() => {
    for (const t of ["carrier-requests", "messages"] as const) bumpRealtimeTopic(t);
  }, []);

  const upload = useCallback(
    async (file: RNUploadFile) => {
      if (!requestId) return;
      setPending("upload");
      try {
        await carriersApi.uploadTravelDoc(requestId, file);
        await refetch();
        syncDealPin();
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
      await carriersApi.approveTravelDoc(requestId);
      // Mark it locally the moment the server confirms, BEFORE the refetch.
      // The card hides itself once status is "approved", so its visibility hangs
      // on this value: if the refetch is slow, fails, or is dropped, the card
      // otherwise stays on screen offering APPROVE for something already
      // approved. The refetch below just reconciles the rest of the payload.
      if (mountedRef.current) setDoc((prev) => (prev ? { ...prev, status: "approved" } : prev));
      await refetch();
      syncDealPin();
    } finally {
      if (mountedRef.current) setPending(null);
    }
  }, [requestId, refetch]);

  const reject = useCallback(
    async (reason: string) => {
      if (!requestId) return;
      setPending("reject");
      try {
        await carriersApi.rejectTravelDoc(requestId, reason);
        await refetch();
        syncDealPin();
      } finally {
        if (mountedRef.current) setPending(null);
      }
    },
    [requestId, refetch],
  );

  const requestAdminReview = useCallback(async () => {
    if (!requestId) return;
    setPending("admin");
    try {
      await carriersApi.requestTravelDocAdminReview(requestId);
      await refetch();
      syncDealPin();
    } finally {
      if (mountedRef.current) setPending(null);
    }
  }, [requestId, refetch]);

  const withdraw = useCallback(async () => {
    if (!requestId || !doc?.parcel_id) return;
    setPending("withdraw");
    try {
      await carriersApi.withdrawBid(doc.parcel_id, requestId);
      await refetch();
      syncDealPin();
    } finally {
      if (mountedRef.current) setPending(null);
    }
  }, [requestId, doc?.parcel_id, refetch]);

  return {
    doc,
    loading,
    error,
    pending,
    refetch,
    upload,
    approve,
    reject,
    requestAdminReview,
    withdraw,
  };
}
