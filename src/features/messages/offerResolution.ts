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
  /** The currency to show the card in - its deal's, see `offerDisplayCurrency` (AN14). */
  currency?: string;
  actions?: OfferCardActions;
}

export interface ResolvedOffers {
  /** messageId -> effective status to render that offer_card with. */
  statusById: Map<string, OfferStatus>;
  /** messageId -> the currency to show that offer_card in (its deal's; AN14). */
  currencyById: Map<string, string>;
  /** Offers the thread shows as ACCEPTED (an `offer_accept` message landed). */
  acceptedOfferIds: string[];
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
  dealCurrencies: ReadonlyMap<string, string> = new Map(),
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
  const currencyById = new Map<string, string>();
  let live: ResolvedOffers["live"] = null;

  for (const { msg, payload, cr } of cards) {
    const isLatest = latestByCr.get(cr) === msg.id;
    const term = override.get(payload.offer_id);
    const status: OfferStatus = term ?? (isLatest ? payload.status ?? "open" : "superseded");
    statusById.set(msg.id, status);
    const currency = offerDisplayCurrency(payload, dealCurrencies);
    currencyById.set(msg.id, currency);
    if (isLatest && status === "open") {
      live = {
        messageId: msg.id,
        offerId: payload.offer_id,
        carrierRequestId: payload.carrier_request_id,
        amount: payload.amount,
        currency,
        mine: msg.sender_id === currentUserId || msg.from_user_id === currentUserId,
      };
    }
  }

  const acceptedOfferIds = [...override].filter(([, v]) => v === "accepted").map(([id]) => id);
  return { statusById, currencyById, acceptedOfferIds, live };
}

/**
 * Has the price just been agreed while the screen still shows the pricing step?
 * (client, 13 Nov 2026: after an offer was accepted, "Make an offer" came back in
 * the chat for a few seconds.)
 *
 * Accepting settles the offer at once - the offer bar goes - but the step comes
 * from the server and still reads PRICE_OFFER until the refresh lands, so the
 * pinned step fell back to its "Make an offer" action. In that gap nothing is
 * shown. It is only that gap: the server's own snapshot must still hold THIS offer
 * as open (read just before the accept), or already say accepted. A deal that went
 * back to pricing later (a cancel, a re-match) has an accepted offer in its
 * history but a snapshot that no longer calls it open - there the step shows.
 * Same rule as web (useOfferTimeline `newestAccepted`, 29 Oct 2026).
 */
export function priceJustAgreed(input: {
  workflowState: string | null | undefined;
  serverOffer: { offer_id?: string | null; status?: string | null } | null | undefined;
  acceptedOfferIds: ReadonlyArray<string>;
}): boolean {
  const { workflowState, serverOffer, acceptedOfferIds } = input;
  if (workflowState !== "PRICE_OFFER" || !serverOffer?.offer_id) return false;
  if (serverOffer.status === "accepted") return true;
  return serverOffer.status === "open" && acceptedOfferIds.includes(serverOffer.offer_id);
}

/**
 * What the offer composer does for the deal's live offer.
 *
 * - none open: "seed" — a first offer;
 * - theirs: "counter";
 * - MINE: "revise" — a new amount that replaces it (the server supersedes the
 *   proposer's own open offer). "Waiting…" with no way out read as stuck
 *   (client, iPhone 8, 23 Oct 2026).
 */
export function offerComposerMode(
  live: Pick<NonNullable<ResolvedOffers["live"]>, "mine" | "carrierRequestId"> | null | undefined,
): "seed" | "counter" | "revise" {
  if (live?.mine) return "revise";
  return live?.carrierRequestId ? "counter" : "seed";
}

/**
 * The one short line under an offer's amount: which currency, and why it can't be
 * switched there (bug bash 28 Oct 2026: "edit by currency - nothing happens").
 * Offers take the parcel's currency; answering an open offer means it is locked.
 * Same words on web (`lib/offerCurrency.ts`).
 */
export function offerCurrencyCode(currency?: string | null): "USD" | "INR" {
  return String(currency ?? "").toUpperCase() === "INR" ? "INR" : "USD";
}

export function offerCurrencyNote(mode: "seed" | "accept" | "counter" | "revise", currency?: string | null): string {
  const code = offerCurrencyCode(currency);
  return mode === "counter" || mode === "revise"
    ? `In ${code}. Currency is locked once offers have been made.`
    : `In ${code}, the parcel's currency.`;
}

/**
 * The line beside YOUR open offer. A carrier whose payouts are not set up was told
 * "Waiting for <the sender> to set up payouts" - the wrong person (28 Oct 2026).
 */
export function ownOfferWaitKind(waitingOnPayouts: boolean, viewerIsCarrier: boolean): "setup" | "payouts" | "plain" {
  if (!waitingOnPayouts) return "plain";
  return viewerIsCarrier ? "setup" : "payouts";
}

/** Just what `offerDisplayCurrency` reads off a deal (`ActiveDeal` fits). */
export interface DealCurrencySource {
  carrier_request_id?: string | null;
  pricing?: { currency?: string | null } | null;
  offer?: { currency?: string | null } | null;
}

/**
 * carrier_request_id -> the deal's currency, for every deal the thread knows.
 *
 * ⚠️ AN14 (29 Oct 2026): offers made before 22 Oct 2026 were all stored as USD,
 * rupee deals included, so a ₹ deal's card read "$1,400.00". The server already
 * answers in the parcel's currency (`activeDeal.pricing.currency`, and
 * `offer.currency` beside it); the card's own frozen label must not win over it.
 * Same rule on web (`lib/offerCurrency.ts`).
 */
export function dealCurrencyMap(
  deals: ReadonlyArray<DealCurrencySource | null | undefined>,
): Map<string, "USD" | "INR"> {
  const map = new Map<string, "USD" | "INR">();
  for (const d of deals) {
    const crId = d?.carrier_request_id;
    const cur = d?.pricing?.currency || d?.offer?.currency;
    if (crId && cur && !map.has(crId)) map.set(crId, offerCurrencyCode(cur));
  }
  return map;
}

/**
 * The currency an offer is SHOWN in: its deal's (locked once offers exist), and the
 * offer's own stored label only when the thread knows nothing about that deal.
 */
export function offerDisplayCurrency(
  offer: { carrier_request_id?: string | null; currency?: string | null },
  dealCurrencies: ReadonlyMap<string, string>,
): string {
  const fromDeal = offer.carrier_request_id ? dealCurrencies.get(offer.carrier_request_id) : undefined;
  return fromDeal || offer.currency || "USD";
}
