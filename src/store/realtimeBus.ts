import { create } from "zustand";

/**
 * Topics every screen-level hook can subscribe to. Match web's
 * `useRealtimeSync.ts` taxonomy — each topic corresponds to a Supabase
 * `postgres_changes` filter on a single table (or a group of related ones).
 */
export type RealtimeTopic =
  | "messages"
  | "conversations"
  | "notifications"
  | "parcels"
  | "trips"
  | "buddies"
  | "carrier-requests"
  | "bookings"
  | "transactions";

interface RealtimeBusState {
  /**
   * Per-topic revision counter. `useRealtimeBus(topic, refetch)` watches its
   * topic and re-fires `refetch` whenever the counter increments.
   *
   * Counters > timestamps because two events within the same millisecond
   * still produce two distinct values.
   */
  ticks: Record<RealtimeTopic, number>;
  /** Increment one topic. Called by `useRealtimeSync` when realtime fires. */
  bump: (topic: RealtimeTopic) => void;
}

const INITIAL_TICKS: Record<RealtimeTopic, number> = {
  messages: 0,
  conversations: 0,
  notifications: 0,
  parcels: 0,
  trips: 0,
  buddies: 0,
  "carrier-requests": 0,
  bookings: 0,
  transactions: 0,
};

/**
 * Tiny zustand-backed pub/sub. The realtime sync hook publishes by calling
 * `bump(topic)`; consumer hooks subscribe via the `useRealtimeBus` helper.
 *
 * Why not a global EventEmitter or context? zustand gives us per-topic
 * selector subscriptions for free — a hook that watches `ticks.messages`
 * doesn't re-render when `ticks.parcels` increments.
 */
export const useRealtimeBusStore = create<RealtimeBusState>((set) => ({
  ticks: INITIAL_TICKS,
  bump: (topic) =>
    set((state) => ({
      ticks: { ...state.ticks, [topic]: state.ticks[topic] + 1 },
    })),
}));

/** Imperative bump for non-hook contexts (e.g. inside `useRealtimeSync`). */
export function bumpRealtimeTopic(topic: RealtimeTopic) {
  useRealtimeBusStore.getState().bump(topic);
}
