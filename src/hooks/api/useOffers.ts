import { useCallback, useState } from "react";

import {
  offersApi,
  type AcceptOfferResult,
  type CounterOfferInput,
  type CounterOfferResult,
  type RejectOfferResult,
  type SeedOfferInput,
  type SeedOfferResult,
} from "@/services/api";
import { bumpRealtimeTopic } from "@/store/realtimeBus";

/** The in-flight offer action, so the screen disables only the active button. */
export type OfferActionKey = "seed" | "counter" | `accept:${string}` | `reject:${string}`;

export interface UseOffersResult {
  /** The action currently running, or `null`. */
  pending: OfferActionKey | null;
  seedOffer: (input: SeedOfferInput) => Promise<SeedOfferResult>;
  postOffer: (input: CounterOfferInput) => Promise<CounterOfferResult>;
  acceptOffer: (offerId: string) => Promise<AcceptOfferResult>;
  rejectOffer: (offerId: string, note?: string) => Promise<RejectOfferResult>;
}

/**
 * In-chat offer mutations.
 *
 * Every one of them moves the pinned workflow step, so every one of them wakes
 * the local readers instead of leaving the screen to wait on the realtime
 * round-trip — which is what made an accepted offer sit there still offering
 * "Accept" until the user pulled to refresh. Web does the same by awaiting
 * `invalidateConversation` in each offer mutation (`hooks/api/useMessages.ts`).
 */
const bumpOfferTopics = (listings: boolean) => {
  for (const t of ["messages", "offers", "conversations", "carrier-requests"] as const) {
    bumpRealtimeTopic(t);
  }
  // Accepting is the only offer action that creates a booking.
  if (listings) for (const t of ["bookings", "parcels", "trips"] as const) bumpRealtimeTopic(t);
};

export function useOffers(conversationId: string | null): UseOffersResult {
  const [pending, setPending] = useState<OfferActionKey | null>(null);

  const run = useCallback(
    async <T>(key: OfferActionKey, task: () => Promise<T>): Promise<T> => {
      setPending(key);
      try {
        return await task();
      } finally {
        setPending(null);
      }
    },
    [],
  );

  const requireConversation = useCallback(() => {
    if (!conversationId) throw new Error("No conversation to offer in");
    return conversationId;
  }, [conversationId]);

  const seedOffer = useCallback(
    (input: SeedOfferInput) =>
      run("seed", async () => {
        const id = requireConversation();
        const result = (await offersApi.seed(id, input)).data;
        bumpOfferTopics(false);
        return result;
      }),
    [run, requireConversation],
  );

  const postOffer = useCallback(
    (input: CounterOfferInput) =>
      run("counter", async () => {
        const id = requireConversation();
        const result = (await offersApi.counter(id, input)).data;
        bumpOfferTopics(false);
        return result;
      }),
    [run, requireConversation],
  );

  const acceptOffer = useCallback(
    (offerId: string) =>
      run(`accept:${offerId}`, async () => {
        const id = requireConversation();
        const result = (await offersApi.accept(id, offerId)).data;
        bumpOfferTopics(true);
        return result;
      }),
    [run, requireConversation],
  );

  const rejectOffer = useCallback(
    (offerId: string, note?: string) =>
      run(`reject:${offerId}`, async () => {
        const id = requireConversation();
        const result = (await offersApi.reject(id, offerId, note)).data;
        bumpOfferTopics(false);
        return result;
      }),
    [run, requireConversation],
  );

  return { pending, seedOffer, postOffer, acceptOffer, rejectOffer };
}
