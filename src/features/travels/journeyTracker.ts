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
  otp_verification: "Delivery Code",
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
  // Non-payment while the carrier held the parcel. Unhappy, but the cross lands
  // on Payment Secured rather than on the handoff, because the parcel DID arrive.
  "unpaid_return",
]);

// Statuses that mean the carrier has the parcel and the money is settled.
const PAID_STATUSES = new Set(["payment_secured", "in_transit", "delivered", "awaiting_handoff", "confirmed"]);

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

/**
 * THE journey's travel date, as a short label.
 *
 * Precedence, and every step is load-bearing:
 *   1. `agreed_travel_date` — the carrier PINNED this exact day in chat, so it
 *      beats anything the listing said.
 *   2. the trip's own dates. `agreed_travel_date` is NULL until that confirmation
 *      happens, which is the normal state for most of a deal's life — and without
 *      this fallback the travel milestones had no date at all, leaving set-up
 *      timestamps as the only dates on screen. A carrier flying on the 16th saw
 *      nothing but the 12th they were matched on.
 *   3. nothing. Never a non-travel timestamp standing in for a travel date.
 *
 * A trip listed as a RANGE with no pinned day genuinely has no single date, so the
 * window is shown rather than inventing certainty by picking one end of it.
 *
 * ⚠️ Every value here is DATE-ONLY (`YYYY-MM-DD`), and `shortDate` parses those at
 * LOCAL midnight on purpose: `new Date("2026-08-16")` is parsed as UTC and renders
 * as Aug 15 for every viewer west of Greenwich.
 */
function travelDateLabel(booking: Booking | null | undefined): string | undefined {
  const agreed = shortDate(booking?.agreed_travel_date);
  if (agreed) return agreed;

  const trip = booking?.trip;
  const from = (trip?.travel_date ?? trip?.travel_date_from ?? null)?.slice(0, 10) ?? null;
  const to = trip?.travel_date_to?.slice(0, 10) ?? null;
  const start = shortDate(from);
  if (!start) return undefined;
  if (!to || to === from) return start;

  // ⚠️ `formatRange` and NOT a hand-spliced "Aug 16–18". Splicing the end day onto
  // the end of the start label assumes a month-first locale; in a day-first one
  // (en-IN, which this project's own users are on) it produced "16 Aug–18", which
  // reads as a different month. `formatRange` collapses the shared parts the way the
  // locale actually wants — "16–18 Aug" / "Aug 16 – 18".
  //
  // Guarded because it is missing on some React Native engines; the fallback spells
  // both dates out in full, which is longer but never wrong.
  const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const d1 = new Date(`${from}T00:00:00`);
  const d2 = new Date(`${to}T00:00:00`);
  if (typeof fmt.formatRange === "function") {
    try {
      return fmt.formatRange(d1, d2);
    } catch {
      // fall through to the explicit form
    }
  }
  const end = shortDate(to);
  return end ? `${start} – ${end}` : start;
}

/** Smallest milestone index strictly greater than `after` (clamped to the last stage). */
function nextMilestone(after: number): number {
  return MILESTONE_INDICES.find((m) => m > after) ?? STAGE_ORDER.length - 1;
}

// Statuses whose cross belongs on a specific stage rather than "wherever
// progress stopped". `expired_unpaid` is the case that forced this: it means a
// legacy escrow-first deal lapsed before the parcel ever moved, so the generic
// rule puts the cross on Parcel Received - under a label reading "Payment
// expired". Naming the stage the label is about keeps the two honest.
const FAILURE_STAGE: Record<string, number> = {
  expired_unpaid: STAGE_ORDER.indexOf("payment_secured"),
  unpaid_return: STAGE_ORDER.indexOf("payment_secured"),
};

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

  // Handoff-first: possession comes BEFORE money, so "Parcel Received" is
  // reached by handoff_accepted_at and "Payment Secured" strictly after it.
  // A booking that died at unpaid_return got the parcel but never the payment,
  // so it must stop at index 3 - the cross then lands on Payment Secured, which
  // is exactly what went wrong.
  const receivedReached =
    !!handoffAt ||
    (!!status && PAID_STATUSES.has(status)) ||
    phase === "pre_handoff" ||
    phase === "post_possession" ||
    status === "handoff_rejected";
  const paidReached =
    status !== "unpaid_return" &&
    ((!!status && (PAID_STATUSES.has(status) || status === "cancelled_post_possession")) ||
      phase === "post_possession");
  const traveledReached =
    (!!status && ["in_transit", "delivered"].includes(status)) ||
    !!booking?.journey_started_at ||
    status === "cancelled_post_possession" ||
    phase === "post_possession";
  const deliveredReached = status === "delivered";

  if (deliveredReached) return 9; // through payment_released; Review is the open frontier
  if (traveledReached) return 6; // through Traveling
  if (paidReached) return 4; // through Payment Secured
  if (receivedReached) return 3; // through Parcel Received (money still outstanding)
  return 2; // set-up cluster (Matched..Parcel Approved)
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
    const failedIndex =
      status && FAILURE_STAGE[status] != null && FAILURE_STAGE[status] > progress
        ? FAILURE_STAGE[status]
        : nextMilestone(progress);
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
  // Handoff-first: the carrier receives the parcel, THEN the sender pays. So
  // "received" and "paid" are now genuinely separate steps rather than two
  // labels on the same escrow event.
  const received = !!booking?.handoff_accepted_at;
  const paid = !!status && ["payment_secured", "in_transit", "delivered"].includes(status);
  const traveling = !!status && ["in_transit", "delivered"].includes(status);
  const delivered = status === "delivered";
  const released = delivered && !!timelineAt(booking, "payment_released");
  // Review completes once THIS viewer has left their rating. `viewer_has_rated`
  // is per-viewer (booking-handler resolves it from ratings.author_id), so the
  // step reflects your own action, not the counterpart's.
  const rated = booking?.viewer_has_rated === true;

  const travelDaysOut = daysUntil(booking?.agreed_travel_date, now);
  const travelSoon = travelDaysOut != null && travelDaysOut <= 1;

  // Flight Verified is a real signal: the carrier's travel document is approved.
  // The handoff is gated on approval, so `received` implies it; pre-feature
  // deals were backfilled to 'approved'.
  const docApproved = booking?.carrier_request?.travel_doc_status === "approved";
  const setupDone = docApproved || received || paid;

  // Stages 8 and 10 used to be inferred from the travel date alone, which lit
  // "Traveling" the moment the carrier took the parcel — often days early — and
  // "Ready for Delivery" on a date with no evidence the carrier had landed.
  // Both are now carrier actions with their own timestamps; the date is only a
  // fallback so legacy bookings (which have neither column) still progress.
  const readyToTravel = !!booking?.ready_to_travel_at || travelSoon || traveling;
  const landed = !!booking?.ready_for_delivery_at || delivered;

  const reached: boolean[] = [
    matched, // matched
    setupDone, // flight_verified
    setupDone, // parcel_approved
    received || paid, // parcel_received — the carrier physically has it
    paid, // payment_secured — the sender then pays within 48h
    readyToTravel, // travel_tomorrow
    traveling, // traveling
    landed, // ready_for_delivery
    delivered, // otp_verification
    released || delivered, // payment_released
    rated, // review — done once this viewer has submitted their rating
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
  const travelLabel = travelDateLabel(booking);
  switch (key) {
    case "matched":
      return shortDate(booking?.created_at);
    case "flight_verified":
      return travelLabel ? `Flight ${travelLabel}` : undefined;
    case "parcel_received":
      return shortDate(booking?.handoff_accepted_at);
    case "payment_secured":
      return shortDate(timelineAt(booking, "payment_held"));
    case "travel_tomorrow":
      return shortDate(booking?.ready_to_travel_at) ?? travelLabel;
    case "traveling":
      // NOT `handoff_accepted_at`. Taking the parcel is a different event on a
      // different day, and standing it in here stamped the handoff date onto a
      // milestone about the flight — which is how a carrier travelling on the
      // 16th read "Traveling · Aug 12", the day the deal was set up.
      return shortDate(booking?.journey_started_at) ?? travelLabel;
    case "ready_for_delivery":
      return shortDate(booking?.ready_for_delivery_at);
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
    case "unpaid_return":
      return "Unpaid — parcel returned";
    case "handoff_rejected":
      return "Declined at handoff";
    default:
      return "Booking ended";
  }
}

/** Progress fraction 0..1 for a compact bar/summary. */
export function journeyProgress(result: JourneyResult): number {
  if (result.reachedIndex < 0) return 0;
  return (result.reachedIndex + 1) / STAGE_ORDER.length;
}
