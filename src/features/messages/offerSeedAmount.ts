/**
 * The amount the offer composer opens with.
 *
 * A counter or a revision starts from the offer being answered. A FIRST offer
 * starts from the server's `pricing.suggested_amount` and nothing else - never the
 * listing's `asking_amount` / `fee_offered` directly. Which figure wins (the live
 * offer, the last agreement, or a listing re-priced AFTER that agreement) is decided
 * once, server-side, in `_shared/offerPricing.ts` `deriveSuggestion`, so web and
 * mobile cannot disagree. Re-deriving it here is how a client ends up reading a
 * cancel/relist as a re-price (E2E E4, 29 Oct 2026: the server had compared the
 * parcel's `updated_at`, which a cancel bumps; it now compares `price_updated_at`).
 */
export function offerSeedAmount(
  mode: "seed" | "counter" | "revise" | null | undefined,
  liveOfferAmount: number | null | undefined,
  pricing: { suggested_amount?: number | null } | null | undefined,
): number | null {
  if (mode === "counter" || mode === "revise") return liveOfferAmount ?? null;
  return pricing?.suggested_amount ?? null;
}
