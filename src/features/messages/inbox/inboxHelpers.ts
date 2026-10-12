import { type MatchUserRole } from "@/components/chat/MatchConfirmationModal";
import { type Conversation } from "@/services/api";
import { colors } from "@/theme/colors";

import { type ConversationFlags, type MiniStatus } from "./inboxTypes";

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * "5:30 PM" if today, "Yesterday" if yesterday, else "Mar 18".
 * Mirrors web's `timeLabel` formatting in CustomerMessages.
 */
export function formatRowTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const messageDate = new Date(iso);
  if (Number.isNaN(messageDate.getTime())) return "";
  const now = new Date();
  if (messageDate.toDateString() === now.toDateString()) {
    return messageDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (messageDate.toDateString() === yesterday.toDateString()) return "Yesterday";
  return messageDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Web parity (`CustomerMessages.tsx:287-291`): for buddy context both sides
 * are senders; for booking, `participant_1` is the sender. Mirrors the same
 * helper in OfferChatScreen.
 */
export function getRoleForConversation(
  c: Conversation,
  currentUserId: string | null,
): MatchUserRole {
  if (c.context_type === "buddy") return "sender";
  if (currentUserId && c.participant_1 === currentUserId) return "sender";
  return "carrier";
}

export function flagsForConversation(c: Conversation, currentUserId: string | null): ConversationFlags {
  const status = c.match_status ?? "pending";
  const isPending = status === "pending";
  const matchedByOther = !!c.matched_by && c.matched_by !== currentUserId;
  const matchedByMe = !!c.matched_by && c.matched_by === currentUserId;
  return {
    hasUnread: (c.unread_count ?? 0) > 0,
    isMatched: status === "matched",
    awaitingMine: isPending && matchedByOther,
    awaitingTheirs: isPending && matchedByMe,
    isDeclined: status === "declined",
    isBlocked: status === "blocked",
    // `matched_at` (the permanent marker) distinguishes wasUnmatched from a
    // never-matched fresh conversation.
    wasUnmatched: isPending && !c.matched_by && !!c.matched_at,
  };
}

export function miniStatusForFlags(flags: ConversationFlags): MiniStatus | null {
  // Web parity (CustomerMessages.tsx:1056-1068): declined uses destructive tone,
  // not muted gray.
  if (flags.awaitingMine)
    return { label: "Match request", bg: "rgba(245, 158, 11, 0.15)", fg: colors.warning };
  if (flags.awaitingTheirs) return { label: "Waiting", bg: colors.surfaceMuted, fg: colors.mutedText };
  if (flags.isMatched) return { label: "Matched", bg: "rgba(34, 197, 94, 0.12)", fg: colors.safe };
  if (flags.isDeclined) return { label: "Declined", bg: "rgba(239, 68, 68, 0.12)", fg: colors.danger };
  if (flags.isBlocked) return { label: "Blocked", bg: "rgba(239, 68, 68, 0.12)", fg: colors.danger };
  if (flags.wasUnmatched) return { label: "Unmatched", bg: colors.surfaceMuted, fg: colors.mutedText };
  return null;
}
