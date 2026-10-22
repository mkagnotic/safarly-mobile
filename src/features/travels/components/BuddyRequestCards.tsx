import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { usePublicProfile } from "@/hooks/api/usePublicProfile";
import type { BuddyConnection, BuddyRequest } from "@/services/api";
import { colors } from "@/theme/colors";
import { formatLocalDate, toLocalYmd } from "@/utils/travelDate";
import { getInitials } from "@/features/travels/lib/initials";
import {
  CONFIRM_JOURNEY_LOCKED_HINT,
  confirmJourneyLockedLabel,
} from "@/features/travels/buddyRequests";

export function BuddyRequestCard({
  request,
  pending,
  onAccept,
  onReject,
}: Readonly<{ request: BuddyRequest; pending: boolean; onAccept: () => void; onReject: () => void }>) {
  const sender = request.requester ?? request.user_profiles ?? null;
  const message = request.message?.trim() || "wants to be your travel buddy";
  return (
    <View style={styles.lcCard}>
      <View style={styles.lcPersonRow}>
        <View style={styles.lcAvatar}>
          <Text style={styles.lcAvatarText}>{getInitials(sender?.name)}</Text>
        </View>
        <View style={styles.lcPersonInfo}>
          <Text style={styles.lcName} numberOfLines={1}>
            {sender?.name || "Someone"}
          </Text>
          <Text style={styles.lcMessage} numberOfLines={2}>
            {message}
          </Text>
        </View>
      </View>
      <View style={styles.lcActions}>
        <AppButton
          label="Decline"
          variant="secondary"
          onPress={onReject}
          disabled={pending}
          style={styles.lcActionFlex}
        />
        <AppButton
          label={pending ? "…" : "Accept"}
          onPress={onAccept}
          disabled={pending}
          gradientColors={[colors.ctaAccent, colors.ctaAccent]}
          style={styles.lcActionFlex}
        />
      </View>
    </View>
  );
}

/**
 * A request I sent that is still waiting on the other traveller. The list row
 * only joins the SENDER's profile (me), so the recipient's name comes from their
 * public profile.
 */
export function SentBuddyRequestCard({
  request,
  pending,
  onCancel,
}: Readonly<{ request: BuddyRequest; pending: boolean; onCancel: (recipientName: string) => void }>) {
  const { profile: recipient } = usePublicProfile(request.receiver_id);
  const name = recipient?.name || "Traveler";
  const sentOn = request.created_at
    ? new Date(request.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;
  return (
    <View style={styles.lcCard}>
      <View style={styles.lcPersonRow}>
        <View style={styles.lcAvatar}>
          <Text style={styles.lcAvatarText}>{getInitials(recipient?.name)}</Text>
        </View>
        <View style={styles.lcPersonInfo}>
          <Text style={styles.lcName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.lcMessage} numberOfLines={1}>
            {sentOn ? `Sent ${sentOn} · waiting for a reply` : "Waiting for a reply"}
          </Text>
        </View>
      </View>
      <View style={styles.lcActions}>
        <AppButton
          label={pending ? "…" : "Cancel request"}
          variant="secondary"
          onPress={() => onCancel(name)}
          disabled={pending}
          style={styles.lcActionFlex}
        />
      </View>
    </View>
  );
}

export function BuddyConnectionCard({
  connection,
  pending,
  onChat,
  onComplete,
}: Readonly<{
  connection: BuddyConnection;
  pending: boolean;
  onChat: () => void;
  onComplete: () => void;
}>) {
  const c = connection;
  const route = c.from_city && c.to_city ? `${c.from_city} → ${c.to_city}` : null;
  const journeyStart = c.travel_date_from || c.travel_date;
  const journeyStarted =
    !journeyStart || journeyStart.slice(0, 10) <= toLocalYmd();
  // No Disconnect here (client, 22 Oct 2026): a buddy trip is ended by
  // unmatching in the chat, so the card says where that lives.
  const confirmLocked = !c.i_confirmed_completion && !journeyStarted;
  const showUnmatchHint = !!c.conversation_id;
  return (
    <View style={styles.lcCard}>
      <View style={styles.lcPersonRow}>
        <View style={styles.lcAvatar}>
          <Text style={styles.lcAvatarText}>{getInitials(c.buddy?.name)}</Text>
        </View>
        <View style={styles.lcPersonInfo}>
          <Text style={styles.lcName} numberOfLines={1}>
            {c.buddy?.name || "Travel buddy"}
          </Text>
          {route ? (
            <Text style={styles.lcMessage} numberOfLines={1}>
              {route}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.lcActions}>
        {c.conversation_id ? (
          <AppButton
            label="Chat"
            onPress={onChat}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.lcChatBtn}
          />
        ) : null}
        {c.i_confirmed_completion ? (
          <View style={[styles.lcActionFlex, styles.lcChip]}>
            <Text style={styles.lcChipText}>Awaiting buddy</Text>
          </View>
        ) : journeyStarted ? (
          <AppButton
            label={pending ? "…" : "Confirm journey"}
            onPress={onComplete}
            disabled={pending}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.lcActionFlex}
          />
        ) : (
          <View style={[styles.lcActionFlex, styles.lcChip, styles.lcChipMuted]}>
            <Text style={styles.lcChipMutedText} numberOfLines={2}>
              {confirmJourneyLockedLabel(journeyStart, (ymd) => formatLocalDate(ymd))}
            </Text>
          </View>
        )}
      </View>
      {confirmLocked || showUnmatchHint ? (
        <View style={styles.lcHints}>
          {confirmLocked ? <Text style={styles.lcHint}>{CONFIRM_JOURNEY_LOCKED_HINT}</Text> : null}
          {showUnmatchHint ? (
            <Text style={styles.lcHint}>To end this, unmatch in your chat.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Buddy request / connection card
  lcCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 12,
  },
  lcPersonRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  lcAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  lcAvatarText: { color: colors.wordmark, fontSize: 14, lineHeight: 18, fontWeight: "800" },
  lcPersonInfo: { flex: 1, minWidth: 0 },
  lcName: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "800" },
  lcMessage: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "500", marginTop: 2 },
  lcActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  lcActionFlex: { flex: 1 },
  lcChatBtn: { flex: 1 },
  lcChip: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  lcChipText: { color: colors.warning, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  lcChipMuted: { backgroundColor: colors.surfaceMuted },
  lcChipMutedText: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  lcHints: { gap: 4 },
  lcHint: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500" },
});
