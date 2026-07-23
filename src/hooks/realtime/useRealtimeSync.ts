import { useEffect } from "react";

import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { supabase } from "@/integrations/supabase/client";
import { messagesApi } from "@/services/api/messages";
import { notificationsApi } from "@/services/api/notifications";
import { getActiveConversation } from "@/store/activeConversation";
import { bumpRealtimeTopic } from "@/store/realtimeBus";

interface MessagePayload {
  conversation_id?: string;
  from_user_id?: string;
  sender_id?: string;
}

interface NotificationPayload {
  id?: string;
  type?: string;
  title?: string;
  body?: string;
  data?: { link?: string; conversation_id?: string } | null;
}

/** The conversation a notification refers to, from its data (id or link). */
function notificationConversationId(n: NotificationPayload): string | null {
  if (n.data?.conversation_id) return n.data.conversation_id;
  const link = n.data?.link ?? "";
  const m = link.match(/\/customer\/messages\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

/**
 * Mobile port of web's `useRealtimeSync.ts`.
 *
 * Opens ONE consolidated channel `rt:user:{uid}` that multiplexes every
 * user-scoped subscription. When realtime fires, we bump the matching topic
 * counter on `realtimeBus`, and every hook subscribed via `useRealtimeBus`
 * refetches. Mobile doesn't have TanStack Query — this bus pattern fills the
 * same role as `queryClient.invalidateQueries`.
 *
 * The hook also auto-fires `markDelivered` when a new message lands from
 * someone other than us (matches web). Mount once, near the top of the
 * authenticated app tree (currently `RootNavigator`).
 *
 * Why one channel instead of nine?
 *   - Each subscribe = one WebSocket frame + RLS check on the server.
 *   - One multiplexed channel keeps us at ~1 connection per signed-in user.
 *
 * Prereq: Supabase Dashboard → Database → Replication → `supabase_realtime`
 * publication must include `messages`, `conversations`, `notifications`,
 * `parcel_requests`, `travel_listings`, `buddy_listings`, `buddy_requests`,
 * `carrier_requests`, `bookings`, `transactions`. If a table isn't in the
 * publication, its events silently never arrive.
 */
export function useRealtimeSync() {
  const { user } = useAuth();

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    const channel = supabase
      .channel(`rt:user:${uid}`)

      // ───────── Notifications ─────────
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          bumpRealtimeTopic("notifications");
          const n = payload.new as NotificationPayload | undefined;
          if (!n?.title) return;
          // Standard chat behaviour (web parity): don't toast for a message in
          // the conversation the user is already viewing — instead mark that
          // notification read so the bell doesn't tick up for something they're
          // actively reading. Everything else surfaces a toast from any screen.
          const convId = notificationConversationId(n);
          if (convId && convId === getActiveConversation()) {
            if (n.id) void notificationsApi.markAsRead(n.id).catch(() => {});
            return;
          }
          showToast({ title: n.title, message: n.body, variant: "info", duration: 4200 });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${uid}`,
        },
        () => bumpRealtimeTopic("notifications"),
      )

      // ───────── Messages ─────────
      // RLS gates row visibility to the user's conversations server-side, so
      // we can subscribe without a per-user filter on this table.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          const m = (payload.new || payload.old) as MessagePayload | undefined;
          if (!m?.conversation_id) return;
          // Two ticks: one for the inbox row preview/sort/unread badge,
          // one for any open thread that wants to refetch as a fallback
          // (the open thread also has its own per-conversation channel).
          bumpRealtimeTopic("messages");
          bumpRealtimeTopic("conversations");

          // Match web: when an INSERT comes in from the other side, mark it
          // delivered server-side so their bubble flips to the single check.
          // Fire-and-forget — failures are silently swallowed.
          if (payload.eventType === "INSERT") {
            const sender = m.from_user_id ?? m.sender_id;
            if (sender && sender !== uid) {
              void messagesApi.markDelivered(m.conversation_id).catch(() => {});
            }
          }
        },
      )

      // ───────── Conversations ─────────
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `participant_1=eq.${uid}`,
        },
        () => bumpRealtimeTopic("conversations"),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `participant_2=eq.${uid}`,
        },
        () => bumpRealtimeTopic("conversations"),
      )

      // ───────── Parcels ─────────
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "parcel_requests",
          filter: `sender_id=eq.${uid}`,
        },
        () => bumpRealtimeTopic("parcels"),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "parcel_requests",
          filter: `carrier_id=eq.${uid}`,
        },
        () => bumpRealtimeTopic("parcels"),
      )

      // ───────── Trips ─────────
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "travel_listings",
          filter: `carrier_id=eq.${uid}`,
        },
        () => bumpRealtimeTopic("trips"),
      )

      // ───────── Buddy listings ─────────
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "buddy_listings",
          filter: `user_id=eq.${uid}`,
        },
        () => bumpRealtimeTopic("buddies"),
      )

      // ───────── Buddy requests ─────────
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "buddy_requests",
          filter: `sender_id=eq.${uid}`,
        },
        () => bumpRealtimeTopic("buddies"),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "buddy_requests",
          filter: `receiver_id=eq.${uid}`,
        },
        () => bumpRealtimeTopic("buddies"),
      )

      // ───────── Carrier requests ─────────
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "carrier_requests",
          filter: `carrier_id=eq.${uid}`,
        },
        () => {
          bumpRealtimeTopic("carrier-requests");
          bumpRealtimeTopic("parcels");
        },
      )

      // ───────── Bookings ─────────
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `sender_id=eq.${uid}`,
        },
        () => bumpRealtimeTopic("bookings"),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `carrier_id=eq.${uid}`,
        },
        () => bumpRealtimeTopic("bookings"),
      )

      // ───────── Transactions ─────────
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${uid}`,
        },
        () => bumpRealtimeTopic("transactions"),
      )

      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
