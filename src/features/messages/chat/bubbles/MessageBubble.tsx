import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { type OfferRenderState } from "@/features/messages/offerResolution";
import { type DisplayMessage } from "@/hooks/api/useChatMessages";
import {
  type OfferAcceptPayload,
  type OfferCardPayload,
  type SystemEventPayload,
} from "@/services/api";
import { colors } from "@/theme/colors";

import { formatBubbleTime, formatMoney } from "../chatHelpers";
import { chatStyles } from "../chatStyles";
import { Attachment } from "./Attachment";
import { OfferCardBubble } from "./OfferCardBubble";
import { BuddyRateRow } from "./BuddyRateRow";
import { SystemRow, type SystemRowProps } from "./SystemRow";

// ───────────────────────── Bubble ─────────────────────────

interface MessageBubbleProps {
  message: DisplayMessage;
  mine: boolean;
  offer?: OfferRenderState;
  onRetry: () => void;
  onDiscard: () => void;
  onOpenImage: (url: string) => void;
  onLongPress: (message: DisplayMessage) => void;
  onSystemPress: (bookingId: string) => void;
}

const SYSTEM_EVENT_LABELS: Record<string, string> = {
  match_confirmed: "Match confirmed",
  travel_date_confirmed: "Travel date confirmed",
  payment_received: "Payment received",
  payment_pending: "Payment pending",
  handoff_accepted: "Parcel picked up",
  handoff_rejected: "Declined at handover",
  parcel_return_opened: "Parcel return opened",
  return_resolution_set: "Return decision made",
  return_completed: "Parcel sent back",
  cancelled: "Booking cancelled",
  delivered: "Delivered",
};

export function MessageBubble({
  message,
  mine,
  offer,
  onRetry,
  onDiscard,
  onOpenImage,
  onLongPress,
  onSystemPress,
}: Readonly<MessageBubbleProps>) {
  const time = formatBubbleTime(message.created_at);
  const kind = message.message_kind ?? "text";
  const payload = message.payload ?? null;

  if (kind === "offer_card") {
    const p = (payload as OfferCardPayload | null) ?? ({} as OfferCardPayload);
    return (
      <OfferCardBubble
        payload={p}
        currency={offer?.currency ?? p.currency}
        mine={mine}
        time={time}
        status={offer?.status ?? p.status ?? "open"}
        actions={offer?.actions}
      />
    );
  }
  if (kind === "offer_accept") {
    const p = (payload as OfferAcceptPayload | null) ?? null;
    const money = formatMoney(p?.amount, p?.currency);
    return (
      <SystemRow
        icon="checkmark-circle"
        tone="good"
        text={money ? `Offer accepted at ${money}` : "Offer accepted"}
      />
    );
  }
  if (kind === "offer_reject") {
    return <SystemRow icon="close-circle" tone="bad" text="Offer declined" />;
  }
  if (kind === "system_event") {
    const p = (payload as SystemEventPayload | null) ?? null;
    if (p?.event === "buddy_journey_completed" && typeof p.connection_id === "string") {
      return <BuddyRateRow text={message.text?.trim() || "Journey completed"} connectionId={p.connection_id} />;
    }
    // Concise label for known events; else the server's human text, else "Update".
    const mapped = p?.event ? SYSTEM_EVENT_LABELS[p.event] : undefined;
    const label = mapped ?? (message.text?.trim() || p?.event || "Update");
    const tone: SystemRowProps["tone"] =
      p?.event === "delivered" ||
      p?.event === "payment_received" ||
      p?.event === "match_confirmed" ||
      p?.event === "travel_date_confirmed"
        ? "good"
        : p?.event === "cancelled" || p?.event === "handoff_rejected"
          ? "bad"
          : "neutral";
    return (
      <SystemRow
        // Only rendered for good/bad tones, so it reads as an outcome rather
        // than decorating every neutral update with a generic info glyph.
        icon={tone === "good" ? "checkmark-circle" : "alert-circle"}
        tone={tone}
        text={label}
        onPress={p?.booking_id ? () => onSystemPress(p.booking_id as string) : undefined}
      />
    );
  }

  const failed = message._clientStatus === "failed";
  const pending = message._clientStatus === "pending";
  const showText = message.text && message.text !== "📎 Attachment";

  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <Pressable
        onLongPress={() => onLongPress(message)}
        delayLongPress={350}
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          failed && styles.bubbleFailed,
        ]}
        accessibilityRole="text"
        accessibilityHint="Long-press for message options"
      >
        {message.attachment_url ? (
          <Attachment
            url={message.attachment_url}
            type={message.attachment_type ?? ""}
            name={message.attachment_name}
            onOpenImage={onOpenImage}
          />
        ) : null}
        {showText ? (
          <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
            {message.text}
          </Text>
        ) : null}
        <View style={styles.bubbleFooter}>
          <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
            {time}
          </Text>
          {mine ? (
            failed ? (
              <Ionicons name="alert-circle" size={11} color={colors.danger} />
            ) : pending ? (
              <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.65)" />
            ) : message.read_at ? (
              // Web parity: double check rendered bright when the other side has read it.
              <Ionicons name="checkmark-done" size={13} color="#7AD7FF" />
            ) : (
              // Sent + delivered (server has it) but not yet read: muted single check.
              <Ionicons name="checkmark" size={13} color="rgba(255,255,255,0.85)" />
            )
          ) : null}
        </View>
      </Pressable>
      {failed ? (
        <View style={styles.failedActionsRow}>
          <Text style={styles.failedNotSent}>Not sent</Text>
          <Text style={styles.failedSep}>·</Text>
          <Pressable onPress={onRetry} hitSlop={4} accessibilityRole="button" accessibilityLabel="Retry send">
            <Text style={styles.failedAction}>Retry</Text>
          </Pressable>
          <Text style={styles.failedSep}>·</Text>
          <Pressable
            onPress={onDiscard}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Discard message"
          >
            <Text style={styles.failedAction}>Discard</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  // Bubble
  bubbleRow: { width: "100%", marginBottom: 4 },
  bubble: {
    maxWidth: "78%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleFailed: { borderColor: colors.danger, borderWidth: 1 },
  bubbleText: { fontSize: 14, lineHeight: 18 },
  bubbleTextMine: { color: colors.white },
  bubbleTextTheirs: { color: colors.text },
  bubbleFooter: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" },
  bubbleTime: { fontSize: 10, fontWeight: "600" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.75)" },
  bubbleTimeTheirs: { color: colors.subtleText },
  failedActionsRow: { flexDirection: "row", gap: 6, marginTop: 4, alignItems: "center" },
  failedAction: { color: colors.danger, fontSize: 11, fontWeight: "800" },
  failedSep: { color: colors.mutedText, fontSize: 11 },
  failedNotSent: { color: colors.danger, fontSize: 11, fontWeight: "600" },
});

const styles = { ...chatStyles, ...bubbleStyles };
