/**
 * Can this carrier's country be paid by the provider they resolve to? Twin of
 * web src/lib/payoutEligibility.ts (27 Oct 2026: mobile had no such check and
 * sent an India-profile carrier into Stripe setup that cannot finish).
 *
 * Safarly's Stripe platform is a US account; measured in test mode only US can
 * be onboarded. Silent when there is no country yet, or for any provider other
 * than Stripe (Razorpay exists to serve the carriers Stripe cannot).
 */
const STRIPE_CAN_ONBOARD = new Set(["US"]);

export function payoutBlock(provider: string | null | undefined, country: string | null | undefined): { country: string } | null {
  if (provider !== "stripe") return null;
  const iso = (country ?? "").trim().toUpperCase();
  if (!iso) return null;
  return STRIPE_CAN_ONBOARD.has(iso) ? null : { country: iso };
}

const COUNTRY_NAMES: Record<string, string> = { IN: "India", US: "the United States", GB: "the United Kingdom", CA: "Canada", AU: "Australia" };
export const countryName = (iso: string): string => COUNTRY_NAMES[iso.toUpperCase()] ?? iso.toUpperCase();
