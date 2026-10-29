import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { ownOfferWaitKind, type ResolvedOffers } from "@/features/messages/offerResolution";
import { type UseOffersResult } from "@/hooks/api/useOffers";
import { colors } from "@/theme/colors";
import { BusyLabel } from "@/components/ui/BusyLabel";

import { formatMoney } from "../chatHelpers";
import { chatStyles } from "../chatStyles";

interface OfferBarProps {
  liveOffer: NonNullable<ResolvedOffers["live"]>;
  participantName: string;
  offerPending: UseOffersResult["pending"];
  handleAcceptOffer: (offerId: string) => Promise<void>;
  handleDeclineOffer: (offerId: string) => Promise<void>;
  handleOpenOfferComposer: () => void;
  /** The carrier can't be paid yet: say why it is waiting (client, 23 Oct 2026). */
  waitingOnPayouts?: boolean;
  /** The viewer is the carrier: then THEY are the one to set up payouts. */
  viewerIsCarrier?: boolean;
  /** Opens Payout Setup (carrier only). */
  onSetUpPayouts?: () => void;
}

/** ───────── Offer bar ───────── */
export function OfferBar({
  liveOffer,
  participantName,
  offerPending,
  handleAcceptOffer,
  handleDeclineOffer,
  handleOpenOfferComposer,
  waitingOnPayouts = false,
  viewerIsCarrier = false,
  onSetUpPayouts,
}: Readonly<OfferBarProps>) {
  const waitKind = ownOfferWaitKind(waitingOnPayouts, viewerIsCarrier);
  const firstName = participantName.split(" ")[0];
  // The row WRAPS: on a 375pt phone (iPhone 8) the three buttons left the amount
  // ~40pt and it rendered as "₹…" (client, 23 Oct 2026). The info block keeps a
  // minimum width, so the buttons drop to their own line instead of squeezing it.
  return (
    <View style={styles.offerBar}>
      <View style={styles.offerBarInfo}>
        <Ionicons name="pricetag" size={16} color={colors.primary} />
        <View style={styles.flex}>
          <Text style={styles.offerBarLabel} numberOfLines={1}>
            {liveOffer.mine ? "Your offer" : `${firstName}'s offer`}
          </Text>
          <Text style={styles.offerBarAmount} numberOfLines={1} testID="offer-bar-amount">
            {formatMoney(liveOffer.amount, liveOffer.currency)}
          </Text>
        </View>
      </View>
      {liveOffer.mine ? (
        // Says who it waits for, and gives a way out: a bare "Waiting…" with no
        // action read as stuck. Change sends a new amount that replaces this offer.
        <View style={styles.offerBarActions}>
          {/* A carrier without payouts was told to wait for the SENDER to set them
              up (28 Oct 2026). They are the one to act; Change stays beside it. */}
          <Text style={styles.offerBarWaiting} numberOfLines={3}>
            {waitKind === "setup"
              ? `Set up payouts so ${firstName} can accept — they can't until your earnings have somewhere to go.`
              : waitKind === "payouts"
                ? `Waiting for ${firstName} to set up payouts…`
                : `Waiting for ${firstName}…`}
          </Text>
          {waitKind === "setup" && onSetUpPayouts ? (
            <Pressable
              onPress={onSetUpPayouts}
              style={[styles.offerBarBtn, styles.offerBarBtnPrimary]}
              accessibilityRole="button"
              accessibilityLabel="Set up payouts"
            >
              <Text style={styles.offerBarBtnPrimaryText}>Set up payouts</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleOpenOfferComposer}
            disabled={!!offerPending}
            style={[styles.offerBarBtn, styles.offerBarBtnOutline]}
            accessibilityRole="button"
            accessibilityLabel="Change your offer"
          >
            <Text style={styles.offerBarBtnOutlineText}>Change</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.offerBarActions}>
          <Pressable
            onPress={() => void handleDeclineOffer(liveOffer.offerId)}
            disabled={!!offerPending}
            style={[styles.offerBarBtn, styles.offerBarBtnGhost]}
            accessibilityRole="button"
            accessibilityLabel="Decline offer"
          >
            {offerPending === `reject:${liveOffer.offerId}` ? (
              <BusyLabel label="Declining…" color={colors.danger} textStyle={styles.offerBarBtnGhostText} />
            ) : (
              <Text style={styles.offerBarBtnGhostText}>Decline</Text>
            )}
          </Pressable>
          <Pressable
            onPress={handleOpenOfferComposer}
            disabled={!!offerPending}
            style={[styles.offerBarBtn, styles.offerBarBtnOutline]}
            accessibilityRole="button"
            accessibilityLabel="Counter offer"
          >
            <Text style={styles.offerBarBtnOutlineText}>Counter</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleAcceptOffer(liveOffer.offerId)}
            disabled={!!offerPending}
            style={[styles.offerBarBtn, styles.offerBarBtnPrimary]}
            accessibilityRole="button"
            accessibilityLabel="Accept offer"
          >
            {offerPending === `accept:${liveOffer.offerId}` ? (
              <BusyLabel label="Accepting…" textStyle={styles.offerBarBtnPrimaryText} />
            ) : (
              <Text style={styles.offerBarBtnPrimaryText}>Accept</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const offerBarStyles = StyleSheet.create({
  // Offer bar (above the composer)
  offerBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 10,
    rowGap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceTintPrimary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // flexBasis is the amount's guaranteed room: below it the actions wrap.
  offerBarInfo: { flexDirection: "row", alignItems: "center", gap: 8, flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0 },
  offerBarLabel: { color: colors.mutedText, fontSize: 11, fontWeight: "700" },
  offerBarAmount: { color: colors.text, fontSize: 16, fontWeight: "800" },
  offerBarWaiting: { color: colors.mutedText, fontSize: 12, fontWeight: "700", fontStyle: "italic", flexShrink: 1 },
  offerBarActions: { flexDirection: "row", alignItems: "center", gap: 6, flexGrow: 1, justifyContent: "flex-end" },
  offerBarBtn: {
    paddingHorizontal: 12,
    minWidth: 64,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  offerBarBtnGhost: { backgroundColor: "transparent" },
  offerBarBtnGhostText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  offerBarBtnOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  offerBarBtnOutlineText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  // Pinned offer bar's accept — same orange as the card above it (web parity:
  // ChatOfferPrompt uses `.btn-action-primary`).
  offerBarBtnPrimary: { backgroundColor: colors.ctaAccent },
  offerBarBtnPrimaryText: { color: colors.white, fontSize: 12, fontWeight: "800" },
});

const styles = { ...chatStyles, ...offerBarStyles };
