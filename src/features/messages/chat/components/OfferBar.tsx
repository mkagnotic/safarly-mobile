import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { type ResolvedOffers } from "@/features/messages/offerResolution";
import { type UseOffersResult } from "@/hooks/api/useOffers";
import { colors } from "@/theme/colors";

import { formatMoney } from "../chatHelpers";
import { chatStyles } from "../chatStyles";

interface OfferBarProps {
  liveOffer: NonNullable<ResolvedOffers["live"]>;
  participantName: string;
  offerPending: UseOffersResult["pending"];
  handleAcceptOffer: (offerId: string) => Promise<void>;
  handleDeclineOffer: (offerId: string) => Promise<void>;
  handleOpenOfferComposer: () => void;
}

/** ───────── Offer bar ───────── */
export function OfferBar({
  liveOffer,
  participantName,
  offerPending,
  handleAcceptOffer,
  handleDeclineOffer,
  handleOpenOfferComposer,
}: Readonly<OfferBarProps>) {
  return (
    <View style={styles.offerBar}>
      <View style={styles.offerBarInfo}>
        <Ionicons name="pricetag" size={16} color={colors.primary} />
        <View style={styles.flex}>
          <Text style={styles.offerBarLabel}>
            {liveOffer.mine
              ? "Your offer"
              : `${participantName.split(" ")[0]}'s offer`}
          </Text>
          <Text style={styles.offerBarAmount} numberOfLines={1}>
            {formatMoney(liveOffer.amount, liveOffer.currency)}
          </Text>
        </View>
      </View>
      {liveOffer.mine ? (
        <Text style={styles.offerBarWaiting}>Waiting…</Text>
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
              <ActivityIndicator size="small" color={colors.danger} />
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
              <ActivityIndicator size="small" color={colors.white} />
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
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceTintPrimary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  offerBarInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  offerBarLabel: { color: colors.mutedText, fontSize: 11, fontWeight: "700" },
  offerBarAmount: { color: colors.text, fontSize: 16, fontWeight: "800" },
  offerBarWaiting: { color: colors.mutedText, fontSize: 12, fontWeight: "700", fontStyle: "italic" },
  offerBarActions: { flexDirection: "row", gap: 6 },
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
