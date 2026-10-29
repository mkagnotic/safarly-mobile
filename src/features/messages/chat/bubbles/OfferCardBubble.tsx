import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { type OfferCardActions } from "@/features/messages/offerResolution";
import { type OfferCardPayload, type OfferStatus } from "@/services/api";
import { colors } from "@/theme/colors";

import { formatMoney } from "../chatHelpers";
import { chatStyles } from "../chatStyles";

interface OfferCardBubbleProps {
  payload: OfferCardPayload;
  /** The deal's currency when known; the card's stored label is pre-22-Oct USD on ₹ deals (AN14). */
  currency?: string;
  mine: boolean;
  time: string;
  status: OfferStatus;
  actions?: OfferCardActions;
}

/** Per-status presentation for the offer card badge + accents. */
const OFFER_STATUS_META: Record<
  OfferStatus,
  { label: string; icon: keyof typeof Ionicons.glyphMap; fg: string; bg: string }
> = {
  open: { label: "Open offer", icon: "pricetag", fg: colors.primary, bg: colors.surfaceTintPrimary },
  accepted: {
    label: "Accepted",
    icon: "checkmark-circle",
    fg: colors.safe,
    bg: "rgba(34,195,93,0.14)",
  },
  rejected: { label: "Declined", icon: "close-circle", fg: colors.danger, bg: "rgba(220,40,40,0.10)" },
  expired: { label: "Expired", icon: "time-outline", fg: colors.subtleText, bg: colors.surfaceMuted },
  superseded: {
    label: "Superseded",
    icon: "swap-horizontal",
    fg: colors.subtleText,
    bg: colors.surfaceMuted,
  },
};

export function OfferCardBubble({ payload, currency, mine, time, status, actions }: Readonly<OfferCardBubbleProps>) {
  const isClosed = status === "rejected" || status === "expired" || status === "superseded";
  const isOpen = status === "open";
  const meta = OFFER_STATUS_META[status] ?? OFFER_STATUS_META.open;
  const busy = !!actions && (actions.acceptPending || actions.rejectPending);

  return (
    <View style={[styles.offerCardRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View
        style={[
          styles.offerCard,
          isOpen && styles.offerCardOpen,
          status === "accepted" && styles.offerCardAccepted,
          isClosed && styles.offerCardClosed,
        ]}
      >
        <View style={[styles.offerBadge, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={12} color={meta.fg} />
          <Text style={[styles.offerBadgeText, { color: meta.fg }]}>{meta.label}</Text>
        </View>

        <Text
          style={[
            styles.offerCardAmount,
            isClosed && styles.offerCardAmountClosed,
            status === "superseded" && styles.offerCardAmountStruck,
          ]}
        >
          {formatMoney(payload.amount, currency ?? payload.currency)}
        </Text>

        {payload.note ? (
          <Text style={styles.offerCardNote} numberOfLines={3}>
            {payload.note}
          </Text>
        ) : null}

        <Text style={styles.offerCardFooter}>
          {payload.proposer_name ? `${payload.proposer_name} · ` : ""}
          {time}
        </Text>

        {actions ? (
          <View style={styles.offerCardActions}>
            {/* Primary action gets its own full-width row so it's unmissable;
                the two secondary choices sit below with equal weight. */}
            <Pressable
              onPress={actions.onAccept}
              disabled={busy}
              style={[styles.offerActionBtn, styles.offerActionAccept]}
              accessibilityRole="button"
              accessibilityLabel="Accept offer"
            >
              {actions.acceptPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={colors.white} />
                  <Text style={styles.offerActionAcceptText}>Accept offer</Text>
                </>
              )}
            </Pressable>
            <View style={styles.offerActionSecondaryRow}>
              <Pressable
                onPress={actions.onCounter}
                disabled={busy}
                style={[styles.offerActionBtn, styles.offerActionSecondary, styles.offerActionCounter]}
                accessibilityRole="button"
                accessibilityLabel="Counter offer"
              >
                <Ionicons name="swap-horizontal" size={16} color={colors.text} />
                <Text style={styles.offerActionCounterText} numberOfLines={1}>
                  Counter
                </Text>
              </Pressable>
              <Pressable
                onPress={actions.onDecline}
                disabled={busy}
                style={[styles.offerActionBtn, styles.offerActionSecondary, styles.offerActionDecline]}
                accessibilityRole="button"
                accessibilityLabel="Decline offer"
              >
                {actions.rejectPending ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <>
                    <Ionicons name="close" size={16} color={colors.danger} />
                    <Text style={styles.offerActionDeclineText} numberOfLines={1}>
                      Decline
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const offerCardStyles = StyleSheet.create({
  // Typed bubbles — offer cards & system events
  offerCardRow: { flexDirection: "row", paddingHorizontal: 14, marginVertical: 4 },
  offerCard: {
    maxWidth: "92%",
    minWidth: 240,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    // Soft lift so an actionable offer reads as a card, not another bubble.
    shadowColor: "#1B1330",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  offerCardOpen: { borderColor: "rgba(93, 63, 211, 0.30)" },
  // Accepted is a terminal record, so it sits flat like the closed cards — but
  // with a green accent. The fill MUST be opaque: a translucent background under
  // the base card's elevation makes Android paint a grey box behind it.
  offerCardAccepted: {
    borderColor: "rgba(34,195,93,0.45)",
    backgroundColor: "#EAF7EF",
    shadowOpacity: 0,
    elevation: 0,
  },
  // Closed offers (superseded / expired / declined) recede: clean white card,
  // no lift, tighter — a quiet record rather than a live card. They stay white
  // (not the muted fill) so they don't blend into the lavender chat surface.
  offerCardClosed: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    gap: 5,
    paddingVertical: 10,
    shadowOpacity: 0,
    elevation: 0,
  },
  offerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  offerBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  offerCardAmount: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  offerCardAmountClosed: { fontSize: 19, color: colors.mutedText },
  offerCardAmountStruck: { textDecorationLine: "line-through" },
  offerCardNote: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  offerCardFooter: { color: colors.subtleText, fontSize: 11, fontWeight: "600" },
  offerCardActions: {
    gap: 8,
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  offerActionSecondaryRow: { flexDirection: "row", gap: 8 },
  offerActionBtn: {
    height: 46,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  // Primary — full width, solid, lifted so it clearly leads. Orange CTA (web's
  // OfferCard accept is the same `.cta-primary` orange); green is reserved for
  // status.
  offerActionAccept: {
    backgroundColor: colors.ctaAccent,
    shadowColor: colors.ctaAccent,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  offerActionAcceptText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  // Secondary — equal-width, bordered so they read as real buttons, not text.
  // `minWidth: 0` + `flexShrink` on the label keep the text inside the button
  // instead of spilling past the border on a narrow card.
  offerActionSecondary: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    borderWidth: 1,
    backgroundColor: colors.card,
  },
  offerActionCounter: { borderColor: colors.border },
  offerActionCounterText: { color: colors.text, fontSize: 14, fontWeight: "800", flexShrink: 1 },
  offerActionDecline: { borderColor: "rgba(220, 40, 40, 0.35)" },
  offerActionDeclineText: { color: colors.danger, fontSize: 14, fontWeight: "800", flexShrink: 1 },
});

const styles = { ...chatStyles, ...offerCardStyles };
