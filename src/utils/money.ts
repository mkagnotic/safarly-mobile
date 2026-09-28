/**
 * Money formatting — one place, on purpose.
 *
 * A port of web's `src/utils/index.ts` so a fee reads identically on the phone
 * and in the browser. Keep them in step.
 *
 * WHY IT EXISTS. Reported from production on 26 September 2026: a parcel from
 * Coimbatore to Newark, fee entered as ₹3600, shown as "$3600". ₹3600 is about
 * $43, so the screen overstated the offer roughly eighty-fold — to a carrier
 * deciding whether to fly it.
 *
 * The web had the same bug and the same cause: no shared formatter, so each
 * screen hand-rolled its own. Some remembered the currency, some printed a
 * dollar sign. Mobile had four hand-rolled variants (`currency === "INR" ? "₹"
 * : "$"` in two files, a CURRENCY_SYMBOL map in a third, a defaulted prop in a
 * fourth) and five screens that simply hardcoded "$". That spread is the bug;
 * one function is the fix.
 */

/**
 * Currency symbol for a currency code. The platform transacts in USD and INR;
 * any other code falls back to the code itself, so nothing ever renders as a
 * confidently wrong symbol.
 */
export function currencySymbol(currency?: string | null): string {
  const cur = String(currency || "USD").toUpperCase();
  if (cur === "INR") return "₹";
  if (cur === "USD") return "$";
  return `${cur} `;
}

/**
 * Canonical money formatter — `<symbol><amount>` with 2 decimals ("$45.00",
 * "₹1200.00"). A missing currency falls back to USD, which is what every
 * hardcoded call site already assumed, so nothing regresses where a currency is
 * genuinely absent.
 */
export function formatMoney(amount: number | string | null | undefined, currency?: string | null): string {
  return `${currencySymbol(currency)}${Number(amount ?? 0).toFixed(2)}`;
}

/**
 * The same, without forced decimals — for places that show a whole-number fee
 * inline ("· asking ₹3600") where "₹3600.00" reads like a price tag.
 */
export function formatMoneyShort(amount: number | string | null | undefined, currency?: string | null): string {
  const n = Number(amount ?? 0);
  return `${currencySymbol(currency)}${Number.isInteger(n) ? n : n.toFixed(2)}`;
}
