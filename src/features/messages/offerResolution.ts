import type { OfferCardPayload, OfferStatus } from "@/services/api";

/**
 * Minimal message shape the resolver reads — `DisplayMessage` is structurally
 * assignable. Keeping to these fields leaves the module RN/Supabase-free and
 * pure-testable.
 */
export interface OfferResolutionMessage {
  id: string;
  sender_id?: string;
  from_user_id?: string;
  message_kind?: string;
  payload?: unknown;
}

/** Per-card render data: the actionable live offer carries `actions`. */
export interface OfferCardActions {
  acceptPending: boolean;
  rejectPending: boolean;
  onAccept: () => void;
  onCounter: () => void;
  onDecline: () => void;
}

export interface OfferRenderState {
  /** Effective status after applying supersession + accept/reject overrides. */
  status: OfferStatus;
  actions?: OfferCardActions;
}

export interface ResolvedOffers {
  /** messageId -> effective status to render that offer_card with. */
  statusById: Map<string, OfferStatus>;
  /** The single live (latest + still open) offer, or null. */
  live: {
    messageId: string;
    offerId: string;
    carrierRequestId?: string;
    amount: number;
    currency: string;
    mine: boolean;
  } | null;
}

/**
 * The latest `offer_card` per `carrier_request_id` is live; older cards are
 * superseded; a later `offer_accept`/`offer_reject` overrides a card's status.
 * `messages` must be ascending by `created_at`.
 */
export function resolveOffers(
  messages: OfferResolutionMessage[],
  currentUserId: string | null,
): ResolvedOffers {
  const override = new Map<string, "accepted" | "rejected">();
  const cards: { msg: OfferResolutionMessage; payload: OfferCardPayload; cr: string }[] = [];
  const latestByCr = new Map<string, string>();

  for (const m of messages) {
    const kind = m.message_kind ?? "text";
    if (kind === "offer_card") {
      const p = m.payload as OfferCardPayload | null;
      if (!p?.offer_id) continue;
      const cr = p.carrier_request_id ?? p.offer_id;
      cards.push({ msg: m, payload: p, cr });
      latestByCr.set(cr, m.id); // last write wins → latest card for this request
    } else if (kind === "offer_accept") {
      const p = m.payload as { accepted_offer_id?: string } | null;
      if (p?.accepted_offer_id) override.set(p.accepted_offer_id, "accepted");
    } else if (kind === "offer_reject") {
      const p = m.payload as { rejected_offer_id?: string } | null;
      if (p?.rejected_offer_id) override.set(p.rejected_offer_id, "rejected");
    }
  }

  const statusById = new Map<string, OfferStatus>();
  let live: ResolvedOffers["live"] = null;

  for (const { msg, payload, cr } of cards) {
    const isLatest = latestByCr.get(cr) === msg.id;
    const term = override.get(payload.offer_id);
    const status: OfferStatus = term ?? (isLatest ? payload.status ?? "open" : "superseded");
    statusById.set(msg.id, status);
    if (isLatest && status === "open") {
      live = {
        messageId: msg.id,
        offerId: payload.offer_id,
        carrierRequestId: payload.carrier_request_id,
        amount: payload.amount,
        currency: payload.currency,
        mine: msg.sender_id === currentUserId || msg.from_user_id === currentUserId,
      };
    }
  }

  return { statusById, live };
}
