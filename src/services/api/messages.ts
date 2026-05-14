import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_ANON_KEY, SUPABASE_FUNCTIONS_URL } from "@/integrations/supabase/env";

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
  participant?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

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

  listConversations: (params?: { page?: number; per_page?: number }) =>
    api.get<Conversation[]>("/message-handler/conversations", params),

  /** Total unread count for the inbox badge. */
  unreadCount: () =>
    api.get<{ unread_count: number }>("/message-handler/conversations/unread-count"),

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
    const formData = new FormData();
    // RN's FormData accepts the blob shape directly. The cast satisfies TS DOM lib.
    formData.append("file", file as unknown as Blob);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/message-handler/conversations/${conversationId}/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: formData,
      },
    );

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiClientError(
        result?.error?.message ?? "Upload failed",
        result?.error?.code ?? "UPLOAD_FAILED",
        response.status,
        result?.error?.details,
      );
    }
    return result.data;
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
