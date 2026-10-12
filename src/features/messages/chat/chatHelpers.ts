import { type MatchUserRole } from "@/components/chat/MatchConfirmationModal";
import { type Conversation } from "@/services/api";
import { currencySymbol } from "@/utils/money";

/**
 * Chat attachment caps — the server's (`message-handler` upload check): images
 * and documents up to 5 MB, video up to 10 MB. A larger client cap only let a
 * file through the picker for the upload to be refused afterwards.
 */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

export function getBackTarget(source: "home" | "messages" | "buddies" | "travels") {
  switch (source) {
    case "home":
      return "Home" as const;
    case "buddies":
      return "Buddies" as const;
    // "Parcels" is the My Travels tab — chats opened from a parcel card there
    // should return to it rather than dropping the user on the inbox.
    case "travels":
      return "Parcels" as const;
    // The inbox is where a chat belongs when the caller gave no context —
    // a notification tap, a deep link, anything that arrives without `source`.
    case "messages":
    default:
      return "MessagesTab" as const;
  }
}

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatBubbleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Web parity (`CustomerMessages.tsx:287-291`): for buddy context, both sides
 * are "sender"; for booking, `participant_1` is the sender and `participant_2`
 * is the carrier. Defaults to "sender" when we don't know enough yet.
 */
export function getRoleForConversation(
  conv: Conversation | null,
  currentUserId: string | null,
): MatchUserRole {
  if (!conv) return "sender";
  if (conv.context_type === "buddy") return "sender";
  if (currentUserId && conv.participant_1 === currentUserId) return "sender";
  return "carrier";
}

// ───────────────────────── Typed message bubbles ─────────────────────────
// Mirrors the server's `message_kind` discriminator (see
// `MOBILE_IMPLEMENTATION_GUIDE.md` §10: chat is the source of truth for offer
// state). Kinds are optional on the wire today — when missing we fall back to
// a plain text bubble so older threads keep rendering.

export function formatMoney(amount?: number, currency?: string): string {
  if (typeof amount !== "number") return "";
  const sym = currencySymbol(currency);
  return `${sym}${amount.toFixed(2)}`;
}
