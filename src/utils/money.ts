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
 * "₹1,200.00"). A missing currency falls back to USD, which is what every
 * hardcoded call site already assumed, so nothing regresses where a currency is
 * genuinely absent.
 */
/**
 * Digits with thousands separators: Indian grouping for rupees ("1,00,000.00"),
 * western for everything else ("100,000.00") - what Stripe's checkout shows.
 * Hand-rolled rather than Intl so every runtime (browser, Hermes, Deno) prints
 * the same string (client, 23 Oct 2026: "₹100000.00" was hard to read).
 */
export function groupedAmount(n: number, currency?: string | null): string {
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  let grouped: string;
  if (String(currency ?? "").toUpperCase() === "INR" && int.length > 3) {
    const head = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    grouped = `${head},${int.slice(-3)}`;
  } else {
    grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  return `${n < 0 ? "-" : ""}${grouped}.${dec}`;
}

export function formatMoney(amount: number | string | null | undefined, currency?: string | null): string {
  const n = Number(amount ?? 0);
  const v = Number.isFinite(n) ? n : 0;
  return `${v < 0 ? "-" : ""}${currencySymbol(currency)}${groupedAmount(Math.abs(v), currency)}`;
}

/**
 * The same, without forced decimals — for places that show a whole-number fee
 * inline ("· asking ₹3600") where "₹3600.00" reads like a price tag.
 */
export function formatMoneyShort(amount: number | string | null | undefined, currency?: string | null): string {
  const n = Number(amount ?? 0);
  if (!Number.isInteger(n)) return formatMoney(n, currency);
  return `${currencySymbol(currency)}${groupedAmount(n, currency).slice(0, -3)}`;
}

/**
 * Per-currency totals, one figure each: "$20.00 · ₹900.00". Rupees and dollars
 * must never be added into one number under one symbol. Without a breakdown
 * (older backend) the flat figure is shown in `fallbackCurrency`.
 */
export function formatMoneyByCurrency(
  byCurrency: Record<string, number> | null | undefined,
  fallbackAmount?: number | null,
  fallbackCurrency?: string | null,
): string {
  const entries = Object.entries(byCurrency ?? {})
    .map(([c, v]) => [c.toUpperCase(), Number(v) || 0] as const)
    .filter(([, v]) => v !== 0)
    .sort(([a], [b]) => (a === "USD" ? -1 : b === "USD" ? 1 : a.localeCompare(b)));
  if (entries.length) return entries.map(([c, v]) => formatMoney(v, c)).join(" · ");
  return formatMoney(fallbackAmount ?? 0, fallbackCurrency);
}
