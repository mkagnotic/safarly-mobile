import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { useSingleFlight } from "@/hooks/useSingleFlight";
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
  /**
   * Another deal was tapped and its step hasn't loaded yet. The pin shows a loader:
   * the previous deal's step used to stay on screen, live, and the chip highlight
   * stayed on it, so the tap looked ignored (client, 27 Oct 2026). Web parity.
   */
  switchingDeal: boolean;
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
const EMPTY_DEALS: DealProjection[] = [];

export function useActiveDeal(conversationId: string | null, buddyListingId?: string | null): UseActiveDealResult {
  const [activeDeal, setActiveDeal] = useState<ActiveDeal | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowView | null>(null);
  const [deals, setDeals] = useState<DealProjection[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [buddy, setBuddy] = useState<BuddyEntry | null>(null);
  const [wantedDealId, setWantedDealId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  /**
   * The conversation the state above belongs to.
   *
   * ⚠️ The chat screen is reused across conversations. Without this, opening chat
   * B showed chat A's deals, step and offer until B's fetch returned — and if a
   * refresh for A was still in flight, B's first fetch was skipped outright (it
   * joined A's request), so A's deal could sit on B's screen (client QA, 23 Oct
   * 2026). Data for another conversation is never shown: B's fetch queues behind
   * A's, and A's answer is discarded on arrival.
   */
  const [dataConversationId, setDataConversationId] = useState<string | null>(null);
  /** The deal the data on screen was fetched FOR (null = the server's default). */
  const [servedForDealId, setServedForDealId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  // Never drops a refresh asked for mid-fetch — the "Waiting" over "MATCH
  // CONFIRMED" bug. See utils/singleFlight.ts.
  const flight = useSingleFlight();
  const currentConversationRef = useRef(conversationId);
  currentConversationRef.current = conversationId;
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
    const isCurrent = () => mountedRef.current && currentConversationRef.current === conversationId;

    return flight.run(async () => {
      setError(null);
      try {
        // The buddy entry is chosen on the client - never sent to the server as a deal.
        const wanted = wantedRef.current === BUDDY_ENTRY_ID ? null : wantedRef.current;
        const res = await messagesApi.getActiveDeal(conversationId, wanted, buddyHintRef.current);
        if (!isCurrent()) return;
        setDataConversationId(conversationId);
        setServedForDealId(wanted);
        setActiveDeal(res.data?.active_deal ?? null);
        setWorkflow(res.data?.workflow ?? null);
        setDeals(res.data?.deals ?? []);
        setSelectedDealId(res.data?.selected_deal_id ?? null);
        setBuddy(res.data?.buddy ?? null);
      } catch (err) {
        if (!isCurrent()) return;
        // Never a loader forever: a failed switch shows the error path, not a spinner.
        setServedForDealId(wantedRef.current === BUDDY_ENTRY_ID ? null : wantedRef.current);
        // A 404/403 means the conversation is gone or not ours — clear the pin
        // rather than surfacing a scary error over an otherwise-usable chat.
        if (err instanceof ApiClientError && (err.status === 404 || err.status === 403)) {
          setDataConversationId(conversationId);
          setActiveDeal(null);
          setWorkflow(null);
          setDeals([]);
          setSelectedDealId(null);
          setBuddy(null);
        } else {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    });
  }, [conversationId, flight]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // A different conversation is a different set of deals, so the selection resets.
  useEffect(() => {
    setWantedDealId(null);
    if (conversationId) setLoading(true);
  }, [conversationId]);

  const selectDeal = useCallback((dealId: string | null) => {
    const wasBuddy = wantedRef.current === BUDDY_ENTRY_ID;
    setWantedDealId(dealId);
    wantedRef.current = dealId;
    // Showing the buddy entry needs nothing new from the server; switching
    // between the buddy entry and the server's default deal doesn't either.
    if (dealId === BUDDY_ENTRY_ID || (wasBuddy && dealId === null)) return;
    void refetch();
  }, [refetch]);

  // Until this conversation's own answer lands, show nothing rather than the last one's.
  const fresh = dataConversationId === conversationId;
  const wantedParcel = wantedDealId === BUDDY_ENTRY_ID ? null : wantedDealId;
  const switchingDeal = fresh && wantedParcel !== null && servedForDealId !== wantedParcel;
  const shownBuddy = fresh ? buddy : null;
  const buddySelected = isBuddyEntrySelected({
    buddy: shownBuddy,
    wantedId: wantedDealId,
    serverSelectedDealId: fresh ? selectedDealId : null,
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

  return {
    activeDeal: fresh ? activeDeal : null,
    workflow: fresh ? workflow : null,
    deals: fresh ? deals : EMPTY_DEALS,
    // The chip the user tapped is highlighted at once, not when its answer lands.
    selectedDealId: switchingDeal ? wantedParcel : fresh ? selectedDealId : null,
    selectDeal,
    buddy: shownBuddy,
    buddySelected,
    switchingDeal,
    loading,
    error,
    refetch,
  };
}
