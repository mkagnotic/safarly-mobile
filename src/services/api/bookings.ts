import { api, newIdempotencyKey } from "./client";
import type { RNUploadFile } from "./messages";

/**
 * Server response shapes — booking-handler returns Postgres-join-typed keys
 * (`parcel_requests`, `user_profiles`, `booking_timeline`). Mobile screens
 * read the canonical names below (`parcel`, `sender`, `carrier`, `timeline`).
 * Normalize once here so consumers can rely on the typed `Booking` shape.
 */
interface RawBooking {
  parcel?: Booking["parcel"];
  parcel_requests?: Booking["parcel"];
  sender?: Booking["sender"];
  carrier?: Booking["carrier"];
  /** On list: server returns sender as `user_profiles` (no carrier joined). */
  user_profiles?: Booking["sender"];
  timeline?: Booking["timeline"];
  booking_timeline?: Booking["timeline"];
  [key: string]: unknown;
}

function normalizeBooking(raw: RawBooking): Booking {
  const parcel = raw.parcel ?? raw.parcel_requests ?? undefined;
  const sender = raw.sender ?? raw.user_profiles ?? undefined;
  const carrier = raw.carrier ?? undefined;
  const timeline = raw.timeline ?? raw.booking_timeline ?? undefined;
  return {
    ...raw,
    parcel,
    sender,
    carrier,
    timeline,
  } as unknown as Booking;
}

/** How the parcel physically reaches the carrier before they travel. */
export type HandoffMode = "shipped" | "in_person";

/** Carrier's local receiving address, used when mode = "shipped". */
export interface HandoffAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  contact_name?: string;
  contact_phone?: string;
}

export interface HandoffPlanInput {
  mode: HandoffMode;
  /** Required when mode = "shipped" - a courier needs a destination. */
  address?: HandoffAddress;
  /** Meetup place/time for in_person, or delivery notes for shipped. */
  instructions?: string;
  /** YYYY-MM-DD the carrier needs it by (bounded by the travel date). */
  expected_by?: string;
}

/** What has to happen to the parcel after a carrier gives it back. */
export type ReturnResolution =
  /** Post it to the merchant's return address (online orders only). */
  | "return_to_seller"
  /** Post it to an address the sender nominates now (personal items). */
  | "return_to_sender"
  | "sender_collects"
  | "sender_has_parcel";

/** Snapshot taken at cancel time so the record survives parcel edits/deletes. */
export interface ReturnPlan {
  needed: boolean;
  holder: "carrier" | "sender";
  suggested: ReturnResolution;
  is_online_order: boolean;
  return_eligible: boolean;
  /** The sender's declared return address - finally read, not just stored. */
  return_address: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
  return_reference: string | null;
}

/** Why a carrier's journey slipped. Mirrors bookings.delay_reason. */
export type JourneyDelayReason =
  | "flight_delayed"
  | "missed_flight"
  | "trip_postponed"
  | "cancelled"
  | "emergency";

export interface Booking {
  id: string;
  parcel_id: string;
  carrier_request_id: string;
  sender_id: string;
  carrier_id: string;
  status: string;
  /** ISO deadline for paying a `pending_payment` booking. Under handoff-first
   *  this is stamped when the carrier accepts the parcel, not at booking creation. */
  payment_expires_at?: string | null;
  /** The price both sides agreed, frozen at acceptance. This is what checkout
   *  charges - never quote `parcel.fee_offered`, which the sender can still edit. */
  agreed_amount?: number | null;
  pickup_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  delivery_proof_url: string | null;
  // ── Part 4 fulfillment fields ──
  cancellation_phase?: string | null;
  penalty_amount?: number | null;
  penalty_waived?: boolean | null;
  handoff_accepted_at?: string | null;
  handoff_rejected_at?: string | null;
  handoff_rejection_reason?: string | null;
  handoff_rejection_proof_url?: string | null;
  /** Handoff plan - how the parcel reaches the carrier in the origin city before
   *  they travel. Splits the handoff phase into three sub-steps: agree the plan
   *  (mode/address) -> send it (dispatched_at) -> inspect and accept/decline. */
  handoff_mode?: HandoffMode | null;
  handoff_address?: HandoffAddress | null;
  handoff_instructions?: string | null;
  handoff_expected_by?: string | null;
  handoff_plan_set_at?: string | null;
  handoff_dispatched_at?: string | null;
  handoff_tracking_reference?: string | null;
  handoff_courier?: string | null;
  /** The 24h grace that follows the 48h payment window. Non-null means the
   *  parcel goes back to the sender when it runs out. */
  payment_grace_started_at?: string | null;
  /** Journey milestones (Stages 8/9/10). Each is a carrier action and a real
   *  signal - the tracker no longer guesses these from the travel date. */
  ready_to_travel_at?: string | null;
  journey_started_at?: string | null;
  ready_for_delivery_at?: string | null;
  /** A live delivery code exists = step 6. Server-derived; the raw OTP
   *  columns are never sent to either client. */
  delivery_code_issued?: boolean | null;
  /** Reported delay. A delay reschedules; it never starts a return by itself. */
  delay_reason?: JourneyDelayReason | null;
  delay_note?: string | null;
  delay_reported_at?: string | null;
  /** When a hand-back became outstanding - anchors the 72h instruction window. */
  return_opened_at?: string | null;
  /** Why the parcel is going back, and therefore who pays the postage.
   *  Spec: "the party causing the cancellation pays for return shipping". */
  return_cause?: 'carrier_declined' | 'carrier_cancelled' | 'sender_unpaid' | 'sender_cancelled' | 'no_fault' | null;
  return_shipping_payer?: 'sender' | 'carrier' | null;
  /** Parcel hand-back after a decline / mid-trip cancel. The deal is only
   *  finished once `return_completed_at` is stamped. */
  return_plan?: ReturnPlan | null;
  return_resolution?: ReturnResolution | null;
  return_resolution_note?: string | null;
  return_resolution_set_at?: string | null;
  return_tracking_reference?: string | null;
  return_completed_at?: string | null;
  /** When the SENDER confirmed the parcel arrived back. Null while outstanding. */
  return_received_at?: string | null;
  /** Address the sender nominated for the parcel to be posted back to. */
  return_destination_address?: HandoffAddress | null;
  /**
   * Travel date the pair agreed on. Returned by `booking-handler`'s list select
   * and used by the journey tracker for the "Travel Tomorrow" / "Traveling"
   * stages. `normalizeBooking` spreads the raw row, so this already arrived at
   * runtime before it was declared here.
   */
  agreed_travel_date?: string | null;
  /**
   * Whether the CURRENT viewer has already rated this booking. Resolved
   * per-viewer by `booking-handler` from `ratings.author_id` on both the list
   * and detail endpoints. Drives the tracker's "Review" stage and the
   * Rate/Rated state on archive cards.
   */
  viewer_has_rated?: boolean;
  created_at: string;
  updated_at: string;
  parcel?: {
    id?: string;
    from_city: string;
    /** ISO-2 code. Feeds the handoff form's Country box so a carrier doesn't
     *  retype what the listing already knows. */
    from_country?: string | null;
    to_city: string;
    to_country?: string | null;
    category: string;
    fee_offered: number;
    weight?: number;
    weight_kg?: number;
    description?: string | null;
    delivery_by?: string;
    /** Retail purchase being forwarded — handoff is normally a courier delivery
     *  to the carrier's local address rather than an in-person meetup. */
    is_online_order?: boolean;
    /** Can be sent back to the seller if the carrier declines it at handoff. */
    return_eligible?: boolean;
    return_city?: string | null;
    return_state?: string | null;
    return_country?: string | null;
  };
  sender?: { id?: string; name: string; avatar_url: string | null; rating?: number };
  carrier?: { id?: string; name: string; avatar_url: string | null; rating?: number };
  /** Deal-level travel-document verification — drives the tracker's "Flight Verified". */
  carrier_request?: {
    travel_doc_status?: "none" | "pending" | "approved" | "rejected";
    parcel_review_status?: "none" | "pending" | "approved" | "rejected";
  } | null;
  timeline?: { event: string; description: string | null; created_at: string }[];
  /** The carrier's listed journey dates. Both GET /bookings and GET /bookings/:id
   *  send it. Used as the tracker's travel date whenever `agreed_travel_date` has
   *  not been pinned yet - which is the normal state for most of a deal's life. */
  trip?: { travel_date: string | null; travel_date_from: string | null; travel_date_to: string | null } | null;
}

export interface BookingDetailResponse {
  booking: Booking;
  payment: { id: string; amount: number; status: string; type: string } | null;
  timeline: { event: string; description: string | null; created_at: string }[];
}

export const bookingsApi = {
  list: async (params?: { role?: string; status?: string; page?: number; per_page?: number }) => {
    const res = await api.get<Booking[]>("/booking-handler/", params);
    if (Array.isArray(res.data)) {
      res.data = res.data.map((b) => normalizeBooking(b as unknown as RawBooking));
    }
    return res;
  },

  getById: async (id: string) => {
    const res = await api.get<BookingDetailResponse>(`/booking-handler/${id}`);
    if (res.data?.booking) {
      res.data.booking = normalizeBooking(res.data.booking as unknown as RawBooking);
    }
    return res;
  },

  markPickup: (id: string) => api.put<{ status: string }>(`/booking-handler/${id}/pickup`),

  /** Carrier tells the sender HOW the parcel should reach them before travel:
   *  couriered to their local address, or handed over in person. Advisory - it
   *  never gates `acceptHandoff`, it just gives the sender somewhere to send it. */
  setHandoffPlan: (id: string, body: HandoffPlanInput) =>
    api.post<{
      handoff_mode: HandoffMode;
      handoff_address: HandoffAddress | null;
      handoff_instructions: string | null;
      handoff_expected_by: string | null;
      handoff_plan_set_at: string;
    }>(`/booking-handler/${id}/handoff/plan`, body),

  /** Sender confirms the parcel is on its way to the carrier. */
  markHandoffDispatched: (
    id: string,
    body: { tracking_reference?: string; courier?: string; note?: string },
  ) =>
    api.post<{
      handoff_dispatched_at: string;
      handoff_tracking_reference: string | null;
      handoff_courier: string | null;
    }>(`/booking-handler/${id}/handoff/dispatched`, body),

  /** Carrier takes possession at inspection. Handoff-first: this OPENS the
   *  sender's 48h payment window (awaiting_handoff -> pending_payment). Legacy
   *  escrow-first deals, already paid, go straight to in_transit instead. */
  acceptHandoff: (id: string, idempotencyKey = newIdempotencyKey()) =>
    api.post<{ status: string; handoff_accepted_at: string; payment_expires_at: string | null }>(
      `/booking-handler/${id}/handoff/accept`,
      {},
      { idempotencyKey },
    ),

  /** Stage 8 - carrier ticks the pre-flight checklist ~24h before departure. */
  confirmReadyToTravel: (id: string) =>
    api.post<{ ready_to_travel_at: string }>(`/booking-handler/${id}/travel/ready`, {
      parcel_packed: true,
      documents_ready: true,
      traveling_confirmed: true,
    }),

  /** Stage 9 - the journey actually begins (booking -> in_transit). */
  startJourney: (id: string) =>
    api.post<{ status: string; journey_started_at: string }>(`/booking-handler/${id}/travel/start`, {}),

  /** Stage 10 - carrier landed; the receiver's cue to coordinate pickup. */
  markLanded: (id: string) =>
    api.post<{ ready_for_delivery_at: string }>(`/booking-handler/${id}/travel/landed`, {}),

  /** Report a delay. Reschedules rather than starting a return - a delayed
   *  flight is explicitly not the same thing as a cancelled delivery. */
  reportDelay: (
    id: string,
    body: { reason: JourneyDelayReason; note?: string; new_travel_date?: string },
  ) =>
    api.post<{ delay_reason: string; delay_reported_at: string; agreed_travel_date: string | null }>(
      `/booking-handler/${id}/travel/delay`,
      body,
    ),

  /** Sender decides where the parcel goes after the carrier gave it back. */
  setReturnResolution: (
    id: string,
    body: { resolution: ReturnResolution; note?: string; address?: HandoffAddress },
  ) =>
    api.post<{
      return_resolution: ReturnResolution;
      return_resolution_note: string | null;
      return_resolution_set_at: string;
      return_completed_at: string | null;
    }>(`/booking-handler/${id}/return/resolution`, body),

  /** Carrier confirms the parcel is on its way back - ends the deal. */
  completeReturn: (id: string, body: { tracking_reference?: string; note?: string }) =>
    api.post<{ return_completed_at: string; return_tracking_reference: string | null }>(
      `/booking-handler/${id}/return/complete`,
      body,
    ),

  /** Sender confirms the returned parcel actually arrived. THIS closes the hand-back:
   *  the carrier's completeReturn only says they posted it, so before this existed a
   *  parcel lost in the post looked exactly like one that got home. Sender-only,
   *  enforced server-side. */
  confirmReturnReceived: (id: string, body?: { note?: string }) =>
    api.post<{ return_received_at: string }>(
      `/booking-handler/${id}/return/received`,
      body ?? {},
    ),

  /** Carrier rejects at inspection: refunds the sender, reopens the parcel, no penalty.
   *  `parcel_with_carrier` decides whether a hand-back is outstanding. */
  rejectHandoff: (
    id: string,
    body: { reason: string; photo_path?: string; parcel_with_carrier?: boolean },
    idempotencyKey = newIdempotencyKey(),
  ) =>
    api.post<{
      status: string;
      handoff_rejected_at: string;
      refunded: boolean;
      refund_amount: number;
    }>(`/booking-handler/${id}/handoff/reject`, body, { idempotencyKey }),

  /** Upload reject evidence (carrier-only, ≤10MB image); pass the returned `path` as `photo_path`. */
  uploadHandoffEvidence: async (id: string, file: RNUploadFile) => {
    // Byte-accurate multipart via api.uploadRNFile — a plain FormData `{uri}` blob
    // arrives empty at the Deno edge fn under Expo/Hermes and 422s (same fix as
    // chat attachments / travel-doc / parcel-review). See client.ts.
    const res = await api.uploadRNFile<{ path: string; url: string }>(
      `/booking-handler/${id}/handoff/upload-evidence`,
      file,
    );
    return res.data;
  },

  cancel: (id: string, reason: string) =>
    api.put<{ status: string }>(`/booking-handler/${id}/cancel`, { reason }),

  /** Carrier cancels mid-transit: full refund to sender + tiered penalty + strike. */
  cancelPostPossession: (
    id: string,
    body: {
      reason: string;
      return_answers?: {
        will_return: boolean;
        was_online_order: boolean;
        free_return_eligible: boolean;
      };
    },
    idempotencyKey = newIdempotencyKey(),
  ) =>
    api.post<{
      status: string;
      tier: string;
      penalty_amount: number;
      refund_amount: number;
      strike_id: string | null;
      dispute_id: string | null;
      waiver_eligible: boolean;
    }>(`/booking-handler/${id}/cancel-post-possession`, body, { idempotencyKey }),

  generateOtp: (id: string) =>
    api.post<{ otp_sent?: boolean; expires_in: number; otp?: string; emailed?: boolean }>(
      `/booking-handler/${id}/generate-otp`,
    ),

  confirmOtp: (id: string, otp: string) =>
    api.post<{ confirmed: boolean }>(`/booking-handler/${id}/confirm-otp`, { otp }),

  resendOtp: (id: string) => api.post<{ otp?: string; expires_in?: number; emailed?: boolean }>(`/booking-handler/${id}/resend-otp`),

  // --- Admin endpoints ---
  adminList: async (params?: { page?: number; per_page?: number }) => {
    const res = await api.get<Booking[]>("/booking-handler/admin", params);
    if (Array.isArray(res.data)) {
      res.data = res.data.map((b) => normalizeBooking(b as unknown as RawBooking));
    }
    return res;
  },

  adminVerifyDelivery: (id: string, notes?: string) =>
    api.put<{ confirmed: boolean }>(`/booking-handler/admin/${id}/verify-delivery`, { notes }),
};
