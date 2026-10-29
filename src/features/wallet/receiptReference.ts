/**
 * Which processor reference a receipt prints, and under which label.
 *
 * The receipt used to print `stripe_payment_intent_id || stripe_refund_id ||
 * reference`, so a REFUND receipt showed the original payment intent, and a
 * Razorpay payment (no Stripe ids at all) fell through to the internal
 * reference. The provider-neutral ids are filled for both processors.
 */
export interface ReceiptReferenceInput {
  type: string;
  reference?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_refund_id?: string | null;
  provider_payment_id?: string | null;
  provider_refund_id?: string | null;
}

export function receiptReference(tx: ReceiptReferenceInput): { label: string; value: string } {
  if (tx.type === "refund") {
    return {
      label: "Refund reference",
      value: tx.provider_refund_id || tx.stripe_refund_id || tx.reference || "—",
    };
  }
  return {
    label: "Payment reference",
    value: tx.provider_payment_id || tx.stripe_payment_intent_id || tx.reference || "—",
  };
}
