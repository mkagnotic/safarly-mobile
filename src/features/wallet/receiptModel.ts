/**
 * What a receipt says, as plain data.
 *
 * BYTE-IDENTICAL in both repos - web `src/features/payments/lib/receiptModel.ts`
 * and mobile `src/features/wallet/receiptModel.ts` - so a receipt reads the same
 * on the web, Android and iOS. Import-free on purpose (mobile's node:test loads
 * it directly); the money formatter is passed in.
 *
 * 29 Oct 2026 receipts audit: every receipt printed "Amount / Platform fee / Net
 * amount", so a sender's PAYMENT receipt ended on "Net amount $100.00" in bold -
 * the carrier's share - under a $110.00 charge; a refund or an earnings statement
 * printed "Platform fee —" and repeated the amount as "Net amount"; a payout with
 * a cancellation penalty taken out never said so; the date was "Oct 29, 2026" on
 * the phone and "Oct 29, 2026, 03:04 PM" on the web.
 */

export type ReceiptMoney = (amount: number, currency?: string | null) => string;

export interface ReceiptTx {
  type: string;
  status: string;
  amount: number | string;
  currency?: string | null;
  platform_fee?: number | string | null;
  net_amount?: number | string | null;
  /** The booking's agreed price (the carrier's fee), sent with booking-linked rows. */
  agreed_amount?: number | string | null;
  description?: string | null;
}

export interface ReceiptLine {
  label: string;
  value: string;
  /** The line the document is about - drawn bold, last. */
  strong?: boolean;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const known = (v: unknown): boolean => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The server notes a penalty taken out of a payout in its description (delivery.ts penaltyNote). */
const PENALTY_DEDUCTED = /cancellation penalty deducted/i;

/**
 * The totals box. Same words as checkout: "Carrier fee" + "Platform fee (10%)"
 * = the total. A payout says what the carrier gets, net of any penalty.
 */
export function receiptTotals(tx: ReceiptTx, money: ReceiptMoney): ReceiptLine[] {
  const ccy = tx.currency;
  const amount = num(tx.amount);
  switch (tx.type) {
    case "payment": {
      if (!known(tx.platform_fee)) return [{ label: "Total paid", value: money(amount, ccy), strong: true }];
      const fee = num(tx.platform_fee);
      const carrierFee = known(tx.net_amount) ? num(tx.net_amount) : Math.max(0, round2(amount - fee));
      return [
        { label: "Carrier fee", value: money(carrierFee, ccy) },
        { label: "Platform fee (10%)", value: money(fee, ccy) },
        { label: "Total paid", value: money(amount, ccy), strong: true },
      ];
    }
    case "refund":
      return [{ label: "Amount refunded", value: money(amount, ccy), strong: true }];
    case "payout": {
      const gross = known(tx.agreed_amount) ? num(tx.agreed_amount) : null;
      const deducted = gross != null && PENALTY_DEDUCTED.test(tx.description ?? "") ? round2(gross - amount) : 0;
      if (gross != null && deducted > 0) {
        return [
          { label: "Carrier fee", value: money(gross, ccy) },
          { label: "Cancellation penalty deducted", value: `−${money(deducted, ccy)}` },
          { label: "Your earnings", value: money(amount, ccy), strong: true },
        ];
      }
      return [{ label: "Your earnings", value: money(amount, ccy), strong: true }];
    }
    case "penalty": {
      // A negative penalty is a waiver credited back on the next payout.
      const credit = amount < 0;
      return [{
        label: credit ? "Penalty waived" : "Cancellation penalty",
        value: `${credit ? "+" : "−"}${money(Math.abs(amount), ccy)}`,
        strong: true,
      }];
    }
    default:
      return [{ label: "Amount", value: money(Math.abs(amount), ccy), strong: true }];
  }
}

const humanise = (code: string): string => {
  const s = String(code ?? "").replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
};

/** A transaction type in the Payments screen's words (admin lists and receipts too). */
export function txTypeWords(type: string): string {
  switch (type) {
    case "payment": return "Delivery payment";
    case "refund": return "Refund";
    case "payout": return "Delivery earnings";
    case "wallet_topup": return "Top-up";
    case "wallet_withdrawal": return "Paid out to bank";
    case "penalty": return "Cancellation penalty";
    default: return humanise(type);
  }
}

/** A transaction status in plain words - never the raw code ("held"). */
export function txStatusWords(status: string): string {
  switch (status) {
    case "held": return "Held until delivery";
    case "pending": return "Processing";
    case "completed": return "Completed";
    case "refunded": return "Refunded";
    case "failed": return "Failed";
    case "cancelled": return "Cancelled";
    default: return humanise(status);
  }
}

/** "Oct 29, 2026, 3:04 PM" in the viewer's own time zone - never an ISO string. */
export function receiptDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/** The two footer lines every receipt ends with. Company facts come from constants/company. */
export function receiptFooter(company: {
  platform: string; companyName: string; jurisdiction: string; supportEmail: string;
}): string[] {
  return [
    `This is a system-generated receipt from ${company.platform}. For questions, contact ${company.supportEmail}.`,
    `${company.platform} is operated by ${company.companyName}, ${company.jurisdiction}.`,
  ];
}
