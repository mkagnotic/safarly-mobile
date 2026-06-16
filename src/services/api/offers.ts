import type { Booking } from "./bookings";
import { api, newIdempotencyKey } from "./client";
import type { Message, OfferCardPayload } from "./messages";

/** In-chat offers — the negotiation that creates a booking. */

export interface SeedOfferInput {
  amount: number;
  currency?: string;
  note?: string;
  /** Pass when the auto-detected trip/parcel pair is ambiguous. */
  trip_id?: string;
  parcel_id?: string;
}

export interface SeedOfferResult {
  offer_id: string;
  carrier_request_id: string;
  trip_id: string;
  parcel_id: string;
}

export interface CounterOfferInput {
  carrier_request_id: string;
  amount: number;
  currency?: string;
  note?: string;
}

export interface CounterOfferResult {
  offer: OfferCardPayload;
  message: Message;
}

export interface AcceptOfferResult {
  offer: OfferCardPayload;
  booking: Booking;
  agreed_amount: number;
  payment_required: boolean;
}

export interface RejectOfferResult {
  offer_id: string;
  status: "rejected";
}

export const offersApi = {
  /** Seed the first offer — creates carrier_request + offer + an offer_card message. */
  seed: (conversationId: string, input: SeedOfferInput, idempotencyKey = newIdempotencyKey()) =>
    api.post<SeedOfferResult>(
      `/message-handler/conversations/${conversationId}/seed-offer`,
      input,
      { idempotencyKey },
    ),

  /** Counter the open offer — supersedes the prior open offer for that carrier_request. */
  counter: (
    conversationId: string,
    input: CounterOfferInput,
    idempotencyKey = newIdempotencyKey(),
  ) =>
    api.post<CounterOfferResult>(
      `/message-handler/conversations/${conversationId}/offers`,
      input,
      { idempotencyKey },
    ),

  /** Accept (counterparty-only) — creates the booking in `pending_payment`. */
  accept: (conversationId: string, offerId: string, idempotencyKey = newIdempotencyKey()) =>
    api.post<AcceptOfferResult>(
      `/message-handler/conversations/${conversationId}/offers/${offerId}/accept`,
      {},
      { idempotencyKey },
    ),

  /** Reject — negotiation stays open for a counter. */
  reject: (conversationId: string, offerId: string, note?: string) =>
    api.post<RejectOfferResult>(
      `/message-handler/conversations/${conversationId}/offers/${offerId}/reject`,
      { note },
    ),
};
