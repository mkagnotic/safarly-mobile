/**
 * The single source of truth for the delivery journey's step numbering.
 * Mirrors web's `src/customer/components/journeySteps.ts` — keep the two in step.
 *
 * These labels were previously literals scattered across the handoff card, the
 * bookings screen and the chat pin, and the two apps drifted apart: web counted
 * 5 steps while mobile counted 3, so the same card at the same moment showed
 * "Step 1 of 5" on web and "Step 1 of 3" on mobile. Anything user-facing that
 * names a step must come from here.
 *
 * Payment is a NUMBERED step. Under the handoff-first order the sender pays
 * after the carrier takes the parcel, on a 48h + 24h clock — it is the single
 * most consequential thing the sender does, and it previously had no position
 * in the sequence at all.
 *
 * Handoff is ONE step spanning three FSM states (AWAITING_HANDOFF →
 * HANDOFF_DISPATCH → HANDOFF_INSPECTION): three real-world moments, one step
 * as far as the user is concerned.
 */
export const JOURNEY_TOTAL_STEPS = 6;

export const JOURNEY_STEP = {
  handoff: { n: 1, name: "Handoff" },
  payment: { n: 2, name: "Payment" },
  travelReady: { n: 3, name: "Travel ready" },
  inTransit: { n: 4, name: "In transit" },
  readyForDelivery: { n: 5, name: "Ready for delivery" },
  delivery: { n: 6, name: "Delivery" },
} as const;

export type JourneyStepKey = keyof typeof JOURNEY_STEP;

/** Card eyebrow: "Step 1 of 6 · Handoff". */
export function journeyStepLabel(key: JourneyStepKey): string {
  const step = JOURNEY_STEP[key];
  return `Step ${step.n} of ${JOURNEY_TOTAL_STEPS} · ${step.name}`;
}

/** Inline prose reference: "step 6 (Delivery)". */
export function journeyStepRef(key: JourneyStepKey): string {
  const step = JOURNEY_STEP[key];
  return `step ${step.n} (${step.name})`;
}

/** Blurb prefix used by the chat pin: "Step 1 of 6 (Handoff): ". */
export function journeyStepPrefix(key: JourneyStepKey): string {
  const step = JOURNEY_STEP[key];
  return `Step ${step.n} of ${JOURNEY_TOTAL_STEPS} (${step.name}): `;
}

/** Short eyebrow for a card: "Step 4 · In transit". The total is owned by the
 *  JourneyProgress bar, so individual cards no longer each claim "of 6". */
export function journeyStepShort(key: JourneyStepKey): string {
  const step = JOURNEY_STEP[key];
  return `Step ${step.n} · ${step.name}`;
}

export const JOURNEY_STEP_ORDER: JourneyStepKey[] = [
  "handoff", "payment", "travelReady", "inTransit", "readyForDelivery", "delivery",
];

/**
 * Where this booking actually is. Derived from the booking alone so every card
 * and the progress bar agree.
 *
 * Several cards are deliberately available BEFORE their turn — the delivery-code
 * card is offered during IN_TRANSIT precisely so a forgotten "I've landed" tap
 * can never strand a delivery. That is why "which card is on screen" is not a
 * usable answer to "which step am I on", and why two cards were both announcing
 * themselves as the current step.
 */
export function currentJourneyStep(b: {
  status: string;
  journey_started_at?: string | null;
  ready_for_delivery_at?: string | null;
  delivered_at?: string | null;
  delivery_code_issued?: boolean | null;
}): JourneyStepKey {
  if (b.delivered_at || b.status === "delivered") return "delivery";
  if (b.status === "in_transit") {
    // A live delivery code IS step 6 — that is the whole distinction between
    // "landed, agreeing a meetup" and "code in hand, hand the parcel over".
    if (b.delivery_code_issued) return "delivery";
    return b.ready_for_delivery_at ? "readyForDelivery" : "inTransit";
  }
  if (b.status === "payment_secured") return "travelReady";
  if (b.status === "pending_payment" || b.status === "unpaid_return") return "payment";
  return "handoff";
}

/** Index of a step in the journey, for "is this card ahead of us?" checks. */
export function journeyStepIndex(key: JourneyStepKey): number {
  return JOURNEY_STEP_ORDER.indexOf(key);
}
