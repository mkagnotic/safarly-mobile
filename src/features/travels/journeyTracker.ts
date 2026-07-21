// Parcel Journey Tracker — maps a booking's real lifecycle onto the 11 user-facing
// stages shown in the "Receive"/Archive cards. Progress is a single monotonic index
// (the furthest stage reached) so the timeline never shows a later step done while an
// earlier one is not — the standard e-commerce tracker convention.
//
// Terminal / unhappy states are first-class: a cancelled or expired booking shows the
// steps it completed (green), a red ✗ at the milestone where it broke, and the rest
// greyed as "skipped". A disputed booking shows an amber "under review" frontier.
//
// 8 of the 11 stages map to persisted backend truth (booking status, timestamp
// columns, timeline events). 3 are derived from that same real data (the two reminder
// steps + "Parcel Received"). See booking-handler for the underlying signals.
//
// ⚠️ Ported verbatim from web (`src/customer/components/journeyTracker.ts`). The two
// platforms MUST agree on what a journey looks like, so keep any change in lockstep —
// this file is deliberately pure TypeScript with no React or platform imports so it
// can stay a straight copy.

import type { Booking, Parcel } from "@/services/api";

export type StageState = "done" | "current" | "upcoming" | "failed" | "skipped" | "disputed";

/** Overall journey outcome, drives the header + banner styling. */
export type JourneyOutcome = "active" | "completed" | "cancelled" | "disputed";

export type StageKey =
  | "matched"
  | "flight_verified"
  | "parcel_approved"
  | "parcel_received"
  | "payment_secured"
  | "travel_tomorrow"
  | "traveling"
  | "ready_for_delivery"
  | "otp_verification"
  | "payment_released"
  | "review";

export interface JourneyStageView {
  key: StageKey;
  label: string;
  state: StageState;
  /** Short right-aligned detail: a date/time it happened, or a hint for what's next. */
  detail?: string;
}

export const STAGE_LABELS: Record<StageKey, string> = {
  matched: "Carrier Matching",
  flight_verified: "Flight Verified",
  parcel_approved: "Parcel Approved",
  parcel_received: "Parcel Received",
  payment_secured: "Payment Secured",
  travel_tomorrow: "Travel Tomorrow",
  traveling: "Traveling",
  ready_for_delivery: "Ready for Delivery",
  otp_verification: "OTP Verification",
  payment_released: "Payment Released",
  review: "Review",
};

// Ordered list of the 11 stages. Index in this array IS the progress position.
export const STAGE_ORDER: StageKey[] = [
  "matched",
  "flight_verified",
  "parcel_approved",
  "parcel_received",
  "payment_secured",
  "travel_tomorrow",
  "traveling",
  "ready_for_delivery",
  "otp_verification",
  "payment_released",
  "review",
];

// "Milestone" indices are the concrete steps (not the two reminder steps at 5 & 7).
// A broken journey fails AT the next milestone past where it got, and any reminder
// step in between is marked skipped rather than failed.
const MILESTONE_INDICES = [0, 1, 2, 3, 4, 6, 8, 9, 10];

// Booking statuses that end the journey unhappily.
const CANCELLED_STATUSES = new Set([
  "cancelled",
  "expired_unpaid",
  "handoff_rejected",
  "cancelled_post_possession",
]);

/** Whole days from today to an ISO date string (negative = in the past). */
function daysUntil(dateISO: string | null | undefined, now: Date): number | null {
  if (!dateISO) return null;
  const [y, m, d] = dateISO.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d).getTime();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - start) / 86_400_000);
}

function timelineAt(booking: Booking | null | undefined, event: string): string | undefined {
  return booking?.timeline?.find((t) => t.event === event)?.created_at;
}

function shortDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const dt = new Date(value.length <= 10 ? `${value.slice(0, 10)}T00:00:00` : value);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Smallest milestone index strictly greater than `after` (clamped to the last stage). */
function nextMilestone(after: number): number {
  return MILESTONE_INDICES.find((m) => m > after) ?? STAGE_ORDER.length - 1;
}

export interface JourneyResult {
  stages: JourneyStageView[];
  /** Highest DONE stage index (-1 when nothing has started). */
  reachedIndex: number;
  outcome: JourneyOutcome;
  /** Human label for a cancelled/disputed outcome (e.g. "Cancelled mid-trip"). */
  outcomeLabel?: string;
  /** Stage index shown as ✗ for a cancelled outcome. */
  failedIndex?: number;
  // --- Back-compat aliases (older callers/tests) ---
  failed: boolean;
  failedLabel?: string;
}

/**
 * How far the happy path progressed, robust to terminal states. Uses timestamp
 * columns + cancellation phase so a cancelled/expired booking still reports the
 * milestones it genuinely completed before breaking.
 */
function progressReached(
  parcel: Parcel | null | undefined,
  booking: Booking | null | undefined,
): number {
  const status = booking?.status ?? null;
  const phase = booking?.cancellation_phase ?? null;
  const handoffAt = booking?.handoff_accepted_at ?? null;

  const parcelMatched =
    !!parcel && ["matched", "in_transit", "delivered", "completed", "disputed"].includes(parcel.status);
  const matched = !!booking || parcelMatched;
  if (!matched) return -1;

  const paidReached =
    !!status &&
    (["awaiting_handoff", "in_transit", "delivered", "confirmed"].includes(status) ||
      !!handoffAt ||
      phase === "pre_handoff" ||
      phase === "post_possession" ||
      status === "handoff_rejected"); // payment happened, then refused + refunded
  const traveledReached =
    (!!status && ["in_transit", "delivered"].includes(status)) ||
    !!handoffAt ||
    status === "cancelled_post_possession" ||
    phase === "post_possession";
  const deliveredReached = status === "delivered";

  if (deliveredReached) return 9; // through payment_released; Review is the open frontier
  if (traveledReached) return 6; // through Traveling
  if (paidReached) return 4; // through Payment Secured
  return 3; // set-up cluster (Matched..Parcel Received)
}

/**
 * Compute the tracker view for a parcel + its booking.
 * @param now injectable clock for deterministic tests (defaults to real time)
 */
export function computeJourney(
  parcel: Parcel | null | undefined,
  booking: Booking | null | undefined,
  now: Date = new Date(),
): JourneyResult {
  const status = booking?.status ?? null;
  const isCancelled = !!status && CANCELLED_STATUSES.has(status);
  const isDisputed = status === "disputed";
  const progress = progressReached(parcel, booking);

  // ---- Cancelled / expired / declined: green up to `progress`, ✗ at the break ----
  if (isCancelled) {
    const failedIndex = nextMilestone(progress);
    const label = failedLabelFor(status);
    const stages = STAGE_ORDER.map<JourneyStageView>((key, i) => {
      let state: StageState;
      if (i <= progress) state = "done";
      else if (i === failedIndex) state = "failed";
      else state = "skipped";
      return {
        key,
        label: STAGE_LABELS[key],
        state,
        detail: i === failedIndex ? label : doneDetail(key, booking),
      };
    });
    return {
      stages,
      reachedIndex: progress,
      outcome: "cancelled",
      outcomeLabel: label,
      failedIndex,
      failed: true,
      failedLabel: label,
    };
  }

  // ---- Disputed: green up to `progress`, amber "under review" at the frontier ----
  if (isDisputed) {
    const frontier = nextMilestone(progress);
    const stages = STAGE_ORDER.map<JourneyStageView>((key, i) => {
      let state: StageState;
      if (i <= progress) state = "done";
      else if (i === frontier) state = "disputed";
      else state = "upcoming";
      return { key, label: STAGE_LABELS[key], state, detail: doneDetail(key, booking) };
    });
    return {
      stages,
      reachedIndex: progress,
      outcome: "disputed",
      outcomeLabel: "Under review",
      failed: false,
    };
  }

  // ---- Active / completed: monotonic-fill from per-stage predicates ----
  const hasBooking = !!booking;
  const parcelMatched =
    !!parcel && ["matched", "in_transit", "delivered", "completed"].includes(parcel.status);
  const matched = hasBooking || parcelMatched;
  const paid = !!status && ["awaiting_handoff", "in_transit", "delivered", "confirmed"].includes(status);
  const traveling = !!status && ["in_transit", "delivered"].includes(status);
  const delivered = status === "delivered";
  const released = delivered && !!timelineAt(booking, "payment_released");

  const travelDaysOut = daysUntil(booking?.agreed_travel_date, now);
  const travelSoon = travelDaysOut != null && travelDaysOut <= 1;
  const travelPassed = travelDaysOut != null && travelDaysOut <= 0;

  // Flight Verified is now a real signal: the carrier's travel document is approved.
  // Payment is gated on approval, so `paid` implies it; pre-feature deals were
  // backfilled to 'approved'. The set-up cluster (Flight Verified → Parcel Received)
  // resolves once the deal is verified.
  const docApproved = booking?.carrier_request?.travel_doc_status === "approved";
  const setupDone = docApproved || paid;

  const reached: boolean[] = [
    matched, // matched
    setupDone, // flight_verified
    setupDone, // parcel_approved
    setupDone, // parcel_received
    paid, // payment_secured
    travelSoon || traveling, // travel_tomorrow
    traveling, // traveling
    delivered || (traveling && travelPassed), // ready_for_delivery
    delivered, // otp_verification
    released || delivered, // payment_released
    false, // review — only ever "current" at the end
  ];
  let reachedIndex = -1;
  reached.forEach((ok, i) => {
    if (ok) reachedIndex = Math.max(reachedIndex, i);
  });

  const stages = STAGE_ORDER.map<JourneyStageView>((key, i) => {
    let state: StageState;
    if (i <= reachedIndex) state = "done";
    else if (i === reachedIndex + 1) state = "current";
    else state = "upcoming";
    return { key, label: STAGE_LABELS[key], state, detail: doneDetail(key, booking) };
  });

  return {
    stages,
    reachedIndex,
    outcome: delivered ? "completed" : "active",
    failed: false,
  };
}

/** Per-stage detail text (a date it happened, or a forward hint). */
function doneDetail(key: StageKey, booking: Booking | null | undefined): string | undefined {
  const travelLabel = shortDate(booking?.agreed_travel_date);
  switch (key) {
    case "matched":
      return shortDate(booking?.created_at);
    case "flight_verified":
      return travelLabel ? `Flight ${travelLabel}` : undefined;
    case "parcel_received":
    case "payment_secured":
      return shortDate(timelineAt(booking, "payment_held"));
    case "travel_tomorrow":
      return travelLabel;
    case "traveling":
      return shortDate(booking?.handoff_accepted_at);
    case "otp_verification":
      return shortDate(booking?.delivered_at);
    case "payment_released":
      return shortDate(timelineAt(booking, "payment_released") ?? booking?.delivered_at);
    default:
      return undefined;
  }
}

function failedLabelFor(status: string | null): string {
  switch (status) {
    case "cancelled":
      return "Booking cancelled";
    case "cancelled_post_possession":
      return "Cancelled mid-trip";
    case "expired_unpaid":
      return "Payment expired";
    case "handoff_rejected":
      return "Handoff declined";
    default:
      return "Booking ended";
  }
}

/** Progress fraction 0..1 for a compact bar/summary. */
export function journeyProgress(result: JourneyResult): number {
  if (result.reachedIndex < 0) return 0;
  return (result.reachedIndex + 1) / STAGE_ORDER.length;
}
