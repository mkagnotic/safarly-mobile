import { supabase } from "@/integrations/supabase/client";

import { api, ApiClientError } from "./client";

export interface Conversation {
  id: string;
  participant_id: string;
  participant_1: string;
  participant_2: string;
  context_type: string;
  last_message: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  match_status: "pending" | "matched" | "declined" | "blocked";
  matched_at: string | null;
  matched_by: string | null;
  declined_at: string | null;
  declined_by: string | null;
  decline_reason: string | null;
  /** Whether the current user has archived this conversation (per-user). */
  archived?: boolean;
  participant?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

/** A shared attachment in a conversation, with a fresh signed URL. */
export interface ChatMediaItem {
  id: string;
  from_user_id: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  created_at: string;
  /**
   * Where the item came from: a chat message, the carrier's travel document, or
   * the sender's parcel photos. Lets the gallery badge verification media.
   */
  category?: "chat" | "travel_document" | "parcel_photo";
}

export type MessageKind =
  | "text"
  | "offer_card"
  | "offer_accept"
  | "offer_reject"
  | "system_event";

// ── Server-owned chat workflow (FSM) ─────────────────────────────────────────
// Ported verbatim from web (`web/src/services/api/messages.ts`) so the two
// platforms project the SAME backend state. The FSM is the single source of
// truth (`supabase/functions/_shared/fsm.ts`); the UI is a pure projection of
// `WorkflowView` returned by `GET /conversations/:id/active-deal`.

/** Canonical FSM state — mirrors `supabase/functions/_shared/fsm.ts`. */
export type WorkflowState =
  | "NEGOTIATING"
  | "MATCH_REQUESTED"
  | "MATCH_DECLINED"
  | "BLOCKED"
  | "MATCHED"
  | "TRAVEL_VERIFICATION"
  | "ADMIN_REVIEW"
  | "PARCEL_REVIEW"
  | "PRICE_OFFER"
  | "PAYMENT_PENDING"
  | "PAYMENT_GRACE_PERIOD"
  | "AWAITING_HANDOFF"
  | "IN_TRANSIT"
  | "OTP_VERIFICATION"
  | "COMPLETED"
  | "ARCHIVED"
  | "CANCELLED"
  | "RETURN_FLOW";

export type WorkflowEvent =
  | "REQUEST_MATCH" | "ACCEPT_MATCH" | "REJECT_MATCH" | "CANCEL_MATCH"
  | "BLOCK" | "UNBLOCK"
  | "UPLOAD_TRAVEL_DOCUMENT" | "APPROVE_TRAVEL_DOCUMENT" | "REJECT_TRAVEL_DOCUMENT" | "REQUEST_ADMIN_REVIEW"
  | "UPLOAD_PARCEL" | "ACCEPT_PARCEL" | "REJECT_PARCEL"
  | "MAKE_OFFER" | "COUNTER" | "ACCEPT_OFFER" | "REJECT_OFFER"
  | "PAY" | "PAYMENT_COMPLETED"
  | "CONFIRM_TRAVEL_DATE" | "ACCEPT_HANDOFF" | "REJECT_HANDOFF"
  | "GENERATE_OTP" | "VERIFY_OTP"
  | "CANCEL";

/** The single pinned CTA for the viewer, computed by the backend FSM. */
export interface WorkflowCta {
  /** Stable slug → localized copy/icon on the client. */
  code: string;
  /** English default label (fallback). null = read-only (no action). */
  label: string | null;
  kind: "action" | "waiting" | "link" | "none";
  event: WorkflowEvent | null;
  variant?: "primary" | "secondary" | "destructive";
}

/** Backend-owned workflow view — the UI is a pure projection of this. */
export interface WorkflowView {
  state: WorkflowState;
  role: "carrier" | "sender";
  cta: WorkflowCta;
  allowed_events: WorkflowEvent[];
  /** Absolute ISO instant the stage times out. Display only — a scheduled job does the work. */
  expires_at?: string | null;
  /** What happens at `expires_at` (e.g. "match_auto_decline", "payment_cancel"). */
  timeout_kind?: string | null;
}

/** The single "current deal" that drives the one in-chat pinned action. */
export interface ActiveDeal {
  carrier_request_id: string;
  parcel_id: string;
  parcel: { from_city: string; to_city: string; category: string | null; weight_kg: number | null } | null;
  trip_capacity_kg: number | null;
  offer: {
    offer_id: string;
    amount: number;
    currency: string;
    status: "open" | "accepted" | "superseded" | "expired" | "rejected";
    proposed_by: string;
  } | null;
  booking_id: string | null;
  booking_status: string | null;
  travel_doc_status: "none" | "pending" | "approved" | "rejected";
  parcel_review_status: "none" | "pending" | "approved" | "rejected";
  viewer_role: "carrier" | "sender";
  match_status: "pending" | "matched" | "declined" | "blocked";
  matched_by: string | null;
}

export interface ActiveDealResponse {
  active_deal: ActiveDeal | null;
  workflow: WorkflowView;
}

export type OfferStatus = "open" | "accepted" | "superseded" | "expired" | "rejected";

export interface OfferCardPayload {
  offer_id: string;
  carrier_request_id?: string;
  parcel_id?: string;
  parcel_from_city?: string | null;
  parcel_to_city?: string | null;
  parcel_category?: string | null;
  amount: number;
  currency: string;
  note?: string | null;
  status: OfferStatus;
  /** Optional display helper some server responses attach. */
  proposer_name?: string | null;
}

export interface OfferAcceptPayload {
  accepted_offer_id: string;
  booking_id: string;
  amount: number;
  currency: string;
}

export interface OfferRejectPayload {
  rejected_offer_id: string;
  note?: string | null;
}

export type SystemEventName =
  | "match_confirmed"
  | "payment_received"
  | "handoff_accepted"
  | "handoff_rejected"
  | "cancelled"
  | "delivered";

export interface SystemEventPayload {
  event: SystemEventName | string;
  booking_id?: string;
  details?: Record<string, unknown>;
}

export type MessagePayload =
  | OfferCardPayload
  | OfferAcceptPayload
  | OfferRejectPayload
  | SystemEventPayload;

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  from_user_id?: string;
  text: string;
  created_at: string;
  delivered_at?: string | null;
  read_at?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  sender?: { id: string; name: string; avatar_url: string | null };
  /** Discriminates typed offer/system messages; absent on legacy text rows. */
  message_kind?: MessageKind;
  payload?: MessagePayload | null;
}

export interface DeliveryHistoryItem {
  id: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  parcel_id: string;
  parcel?: {
    from_city: string;
    from_country: string;
    to_city: string;
    to_country: string;
    category: string;
  } | null;
}

/**
 * RN-shaped multipart payload — `fetch` reads `{ uri, name, type }` blobs out
 * of FormData and streams them. Keep `name` lowercase-extension to match the
 * MIME type the server expects.
 */
export interface RNUploadFile {
  uri: string;
  name: string;
  type: string;
}

export const messagesApi = {
  /**
   * Create or get a conversation with another user.
   *
   * Self-chat guard: web reads the user id out of `localStorage`, which doesn't
   * exist on RN. We read it from the live Supabase session instead.
   */
  createConversation: async (participant_id: string, context_type?: string) => {
    const { data } = await supabase.auth.getSession();
    const currentUserId = data.session?.user?.id;
    if (currentUserId && participant_id === currentUserId) {
      throw new Error("Cannot start a conversation with yourself");
    }
    return api.post<Conversation>("/message-handler/conversations", {
      participant_id,
      context_type: context_type ?? "booking",
    });
  },

  /**
   * List conversations. Pass `archived: true` for the WhatsApp-style Archived
   * view; default (omitted/false) returns only non-archived conversations.
   */
  listConversations: (params?: { page?: number; per_page?: number; archived?: boolean }) =>
    api.get<Conversation[]>("/message-handler/conversations", {
      page: params?.page,
      per_page: params?.per_page,
      archived: params?.archived ? "true" : undefined,
    }),

  /** Total unread count for the inbox badge. */
  unreadCount: () =>
    api.get<{ unread_count: number }>("/message-handler/conversations/unread-count"),

  /**
   * The server-computed workflow view that drives the pinned action bar. Same
   * endpoint web uses; the client is a pure projection of `workflow`.
   */
  getActiveDeal: (conversationId: string) =>
    api.get<ActiveDealResponse>(
      `/message-handler/conversations/${conversationId}/active-deal`,
    ),

  getMessages: (conversationId: string, params?: { limit?: number; before?: string }) =>
    api.get<{ messages: Message[]; has_more: boolean }>(
      `/message-handler/conversations/${conversationId}/messages`,
      params,
    ),

  sendMessage: (
    conversationId: string,
    text: string,
    attachment?: { url: string; type: string },
  ) =>
    api.post<Message>(`/message-handler/conversations/${conversationId}/messages`, {
      text,
      attachment_url: attachment?.url,
      attachment_type: attachment?.type,
    }),

  /**
   * Upload a chat attachment. Pass an RN-style file blob (`{ uri, name, type }`),
   * not a DOM `File`.
   */
  uploadAttachment: async (
    conversationId: string,
    file: RNUploadFile,
  ): Promise<{ url: string; path: string; type: string }> => {
    // Byte-accurate multipart via api.uploadRNFile. A plain FormData `{uri}` blob
    // does NOT stream the file bytes to the Deno edge fn under Expo/Hermes — it
    // arrives empty and 422s — so chat attachments must use the same byte-reader
    // travel-doc / parcel-review already use. See client.ts.
    const res = await api.uploadRNFile<{ url: string; path: string; type: string }>(
      `/message-handler/conversations/${conversationId}/upload`,
      file,
    );
    if (!res.data) throw new ApiClientError("Upload failed", "UPLOAD_FAILED", 0);
    return res.data;
  },

  /** Mark incoming messages as delivered (fire-and-forget from realtime). */
  markDelivered: (conversationId: string) =>
    api.post<{ ok: boolean }>(`/message-handler/conversations/${conversationId}/mark-delivered`),

  reportMessage: (messageId: string, reason: string, details?: string) =>
    api.post<{ report_id: string }>(`/message-handler/${messageId}/report`, { reason, details }),

  matchConversation: (conversationId: string) =>
    api.put<Conversation>(`/message-handler/conversations/${conversationId}/match`),

  declineConversation: (conversationId: string, reason?: string) =>
    api.put<Conversation>(`/message-handler/conversations/${conversationId}/decline`, { reason }),

  blockUser: (conversationId: string) =>
    api.post<{ blocked: boolean }>(`/message-handler/conversations/${conversationId}/block`),

  unblockUser: (conversationId: string) =>
    api.delete<{ unblocked: boolean }>(`/message-handler/conversations/${conversationId}/block`),

  /** Revert matched -> pending. */
  unmatchConversation: (conversationId: string) =>
    api.put<Conversation>(`/message-handler/conversations/${conversationId}/unmatch`),

  getDeliveryHistory: (conversationId: string) =>
    api.get<DeliveryHistoryItem[]>(
      `/message-handler/conversations/${conversationId}/delivery-history`,
    ),

  /** Archive the conversation for the current user only (WhatsApp-style). */
  archiveConversation: (conversationId: string) =>
    api.post<{ archived: boolean }>(
      `/message-handler/conversations/${conversationId}/archive`,
    ),

  /** Unarchive the conversation for the current user only. */
  unarchiveConversation: (conversationId: string) =>
    api.delete<{ archived: boolean }>(
      `/message-handler/conversations/${conversationId}/archive`,
    ),

  /** All shared media/attachments in the conversation (newest first). */
  getMedia: (conversationId: string) =>
    api.get<{ media: ChatMediaItem[] }>(
      `/message-handler/conversations/${conversationId}/media`,
    ),

  // --- Admin endpoints ---
  adminListConversations: (params?: { page?: number; per_page?: number }) =>
    api.get<unknown[]>("/message-handler/admin/conversations", params),

  adminGetMessages: (conversationId: string, params?: { limit?: number }) =>
    api.get<{ messages: Message[]; has_more: boolean }>(
      `/message-handler/admin/conversations/${conversationId}/messages`,
      params,
    ),

  adminSendMessage: (
    conversationId: string,
    text: string,
    attachment_url?: string,
    attachment_type?: string,
  ) =>
    api.post<Message>(
      `/message-handler/admin/conversations/${conversationId}/messages`,
      { text, attachment_url, attachment_type },
    ),
};
