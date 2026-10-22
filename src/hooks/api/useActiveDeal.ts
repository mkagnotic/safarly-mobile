import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import {
  ApiClientError,
  messagesApi,
  type ActiveDeal,
  type DealProjection,
  type WorkflowView,
} from "@/services/api";
import { BUDDY_ENTRY_ID, isBuddyEntrySelected, type BuddyEntry } from "@/utils/buddyEntry";

export interface UseActiveDealResult {
  /** The deal currently being shown, or null. */
  activeDeal: ActiveDeal | null;
  /** Server-computed FSM view — the pin is a pure projection of this. */
  workflow: WorkflowView | null;
  /**
   * EVERY live deal in this thread. Two people can have several deliveries running at
   * once, each its own deal with its own documents, price and lifecycle; the chat shows
   * one at a time and lets the user switch.
   */
  deals: DealProjection[];
  /** Which deal the server actually served (the switcher highlights it). */
  selectedDealId: string | null;
  /** Show a different deal. Null returns to the thread's own default. "buddy" shows the buddy entry. */
  selectDeal: (dealId: string | null) => void;
  /** The pair's travel-buddy entry in a shared (parcel) chat, or null. */
  buddy: BuddyEntry | null;
  /** Is the chat showing the buddy entry instead of a parcel deal? (client-side choice) */
  buddySelected: boolean;
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches the conversation's server-owned workflow view (`/active-deal`), the
 * single source of truth for the pinned action bar. Mirrors web, which renders
 * `ChatWorkflowPin` purely from this response.
 *
 * Refreshes on every realtime topic that can move the FSM: a new offer or
 * system message (`messages`), the match handshake (`conversations`), a bid
 * accept/withdraw (`carrier-requests`), and payment/handoff/delivery
 * (`bookings` / `transactions`). That keeps the pin correct without polling.
 */
export function useActiveDeal(conversationId: string | null, buddyListingId?: string | null): UseActiveDealResult {
  const [activeDeal, setActiveDeal] = useState<ActiveDeal | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowView | null>(null);
  const [deals, setDeals] = useState<DealProjection[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [buddy, setBuddy] = useState<BuddyEntry | null>(null);
  const [wantedDealId, setWantedDealId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);
  // Read inside refetch without making it a dependency: re-creating refetch on every
  // switch would retrigger the realtime subscriptions below.
  const wantedRef = useRef<string | null>(null);
  wantedRef.current = wantedDealId;
  const buddyHintRef = useRef<string | null>(buddyListingId ?? null);
  buddyHintRef.current = buddyListingId ?? null;

  const refetch = useCallback(async () => {
    if (!conversationId) {
      setActiveDeal(null);
      setWorkflow(null);
      setLoading(false);
      return;
    }
    if (inFlightRef.current) return inFlightRef.current;

    const promise = (async () => {
      setError(null);
      try {
        // The buddy entry is chosen on the client - never sent to the server as a deal.
        const wanted = wantedRef.current === BUDDY_ENTRY_ID ? null : wantedRef.current;
        const res = await messagesApi.getActiveDeal(conversationId, wanted, buddyHintRef.current);
        if (!mountedRef.current) return;
        setActiveDeal(res.data?.active_deal ?? null);
        setWorkflow(res.data?.workflow ?? null);
        setDeals(res.data?.deals ?? []);
        setSelectedDealId(res.data?.selected_deal_id ?? null);
        setBuddy(res.data?.buddy ?? null);
      } catch (err) {
        if (!mountedRef.current) return;
        // A 404/403 means the conversation is gone or not ours — clear the pin
        // rather than surfacing a scary error over an otherwise-usable chat.
        if (err instanceof ApiClientError && (err.status === 404 || err.status === 403)) {
          setActiveDeal(null);
          setWorkflow(null);
          setDeals([]);
          setSelectedDealId(null);
          setBuddy(null);
        } else {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mountedRef.current) setLoading(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = promise;
    return promise;
  }, [conversationId]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // A different conversation is a different set of deals, so the selection resets.
  useEffect(() => { setWantedDealId(null); }, [conversationId]);

  const selectDeal = useCallback((dealId: string | null) => {
    const wasBuddy = wantedRef.current === BUDDY_ENTRY_ID;
    setWantedDealId(dealId);
    wantedRef.current = dealId;
    // Showing the buddy entry needs nothing new from the server; switching
    // between the buddy entry and the server's default deal doesn't either.
    if (dealId === BUDDY_ENTRY_ID || (wasBuddy && dealId === null)) return;
    void refetch();
  }, [refetch]);

  const buddySelected = isBuddyEntrySelected({
    buddy,
    wantedId: wantedDealId,
    serverSelectedDealId: selectedDealId,
    openedFromBuddyCard: !!buddyListingId,
  });

  useRealtimeBus("messages", refetch);
  useRealtimeBus("conversations", refetch);
  useRealtimeBus("carrier-requests", refetch);
  useRealtimeBus("bookings", refetch);
  useRealtimeBus("transactions", refetch);
  // An offer expiring on the cron writes no chat message, so the messages topic
  // alone would leave a dead offer still looking open in the pin.
  useRealtimeBus("offers", refetch);
  // The pin shows a dispute banner, and dispute state is admin-driven.
  useRealtimeBus("disputes", refetch);

  return { activeDeal, workflow, deals, selectedDealId, selectDeal, buddy, buddySelected, loading, error, refetch };
}
