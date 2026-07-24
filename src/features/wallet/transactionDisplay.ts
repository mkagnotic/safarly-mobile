import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TxTypeMeta {
  label: string;
  /** Credit = money in (earnings/refunds); debit = money out (payments). */
  credit: boolean;
  icon: IoniconName;
}

/**
 * Transaction type → display label + direction, mirroring web's
 * `CustomerTransactions` typeMeta. Types come from the `transactions.type`
 * column: payment | refund | payout | wallet_topup | wallet_withdrawal.
 */
export function txTypeMeta(type: string): TxTypeMeta {
  switch (type) {
    case "payment":
      return { label: "Delivery payment", credit: false, icon: "arrow-up-outline" };
    case "refund":
      return { label: "Refund", credit: true, icon: "arrow-down-outline" };
    case "payout":
      return { label: "Delivery earning", credit: true, icon: "arrow-down-outline" };
    case "wallet_topup":
      return { label: "Wallet top-up", credit: false, icon: "arrow-up-outline" };
    case "wallet_withdrawal":
      return { label: "Withdrawal", credit: true, icon: "arrow-down-outline" };
    default:
      return { label: type.replace(/_/g, " "), credit: false, icon: "swap-horizontal-outline" };
  }
}

/** Status pill colours, mirroring web's `statusClass`. */
export function txStatusTone(status: string): { bg: string; fg: string } {
  switch (status) {
    case "completed":
      return { bg: "rgba(34,195,93,0.12)", fg: colors.safe };
    case "held":
      return { bg: "rgba(255,122,38,0.12)", fg: colors.primary };
    case "pending":
      return { bg: "rgba(245,159,10,0.14)", fg: colors.warning };
    case "failed":
      return { bg: "rgba(220,40,40,0.12)", fg: colors.danger };
    case "refunded":
    default:
      return { bg: colors.surfaceMuted, fg: colors.mutedText };
  }
}

/** Signed, currency-formatted amount: `+$12.00` for credits, `−$12.00` for debits. */
export function formatTxAmount(amount: number, credit: boolean): string {
  const abs = Math.abs(Number(amount) || 0).toFixed(2);
  return `${credit ? "+" : "−"}$${abs}`;
}

/** "Mon D, YYYY" — matches web's `formatDate`. */
export function formatTxDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
