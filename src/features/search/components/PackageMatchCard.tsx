import { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ModerationMenu } from "@/components/moderation/ModerationMenu";
import { useAuth } from "@/context/AuthContext";
import { MetricRow, MetricTile, RouteHeader } from "@/features/search/routeBlocks";
import { getErrorMessage, messagesApi, type PackageMatch } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { formatMoneyShort } from "@/utils/money";
import { showToast } from "@/feedback/appFeedback";
import type { Nav } from "@/features/search/lib/navigation";
import { capitalize, formatDateLabel } from "@/features/search/lib/searchConfig";
import { sharedStyles } from "@/features/search/searchStyles";

// ───────────────────────── Cards ─────────────────────────

export function PackageMatchCard({
  match,
  navigation,
  nested,
  highlighted,
}: Readonly<{
  match: PackageMatch;
  navigation: Nav;
  nested?: boolean;
  /** Deep-link highlight (web parity: the `?match=` ring). */
  highlighted?: boolean;
}>) {
  const isTrip = match.type === "carrier_trip";
  const person = isTrip ? match.carrier : match.sender;
  const { user } = useAuth();
  // Every listing someone else posted can be reported from where it is seen
  // (App Store 1.2) - search is the only place most of them are ever seen.
  const canReport = !!person?.id && person.id !== user?.id;
  const dateLabel = isTrip
    ? formatDateLabel(match.travel_date)
    : formatDateLabel(match.delivery_by);

  const [chatStarting, setChatStarting] = useState(false);

  const handleViewProfile = useCallback(() => {
    if (!person?.id) {
      showToast({
        title: "User unavailable",
        message: "Unable to open profile — user not available.",
        variant: "error",
      });
      return;
    }
    navigation.navigate("PublicProfileTab", {
      userId: person.id,
      name: person.name ?? undefined,
    });
  }, [person?.id, person?.name, navigation]);

  const handleStartChat = useCallback(async () => {
    if (!person?.id) {
      showToast({
        title: "User unavailable",
        message: "Unable to start chat — user not available.",
        variant: "error",
      });
      return;
    }
    setChatStarting(true);
    try {
      const res = await messagesApi.createConversation(person.id, "booking");
      navigation.navigate("OfferChatTab", {
        conversationId: res.data.id,
        name: person.name || "Conversation",
        source: "messages",
      });
    } catch (err) {
      showToast({ title: "Couldn't start chat", message: getErrorMessage(err), variant: "error" });
    } finally {
      setChatStarting(false);
    }
  }, [person?.id, person?.name, navigation]);

  const secondary = isTrip
    ? {
        label: "CAPACITY",
        value:
          match.luggage_capacity_kg != null
            ? `${match.luggage_capacity_kg} kg`
            : "—",
      }
    : {
        label: "FEE",
        value:
          match.fee_offered != null ? formatMoneyShort(match.fee_offered, match.fee_currency) : "—",
      };

  const inlineSubtitle = isTrip
    ? match.airline
      ? `Via ${match.airline}`
      : null
    : // Receive request: category + weight (web parity — web shows both).
      [
        match.category?.trim() ? capitalize(match.category.trim()) : null,
        match.weight_kg != null ? `${match.weight_kg} kg` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null;

  const personBlock = (
    <View style={sharedStyles.personRow}>
      <Avatar name={person?.name} uri={person?.avatar_url} size={40} />
      <View style={sharedStyles.personInfo}>
        <Text style={sharedStyles.personName} numberOfLines={2}>
          {person?.name || "Unknown user"}
        </Text>
        <Text style={sharedStyles.ratingText}>
          {person?.rating && person.rating > 0
            ? `${person.rating.toFixed(1)} rating`
            : "New member"}
        </Text>
      </View>
      {canReport ? (
        <ModerationMenu
          target={{ type: isTrip ? "trip" : "parcel", id: match.id }}
          reportLabel={isTrip ? "Report trip" : "Report parcel"}
        />
      ) : null}
    </View>
  );

  const metricsBlock = (
    <MetricRow>
      <MetricTile label="DATE" value={dateLabel} compact />
      <MetricTile label={secondary.label} value={secondary.value} highlight compact />
    </MetricRow>
  );

  const subtitleBlock = inlineSubtitle ? (
    <Text style={[styles.matchSubtitle, nested && styles.matchSubtitleNested]}>
      {inlineSubtitle}
    </Text>
  ) : null;

  // Web parity: a match still shows but wears an amber pill when the parcel is
  // heavier than the carrier's capacity. Copy differs by side (carrier trip vs
  // your trip), matching web's "Exceeds capacity" / "Exceeds your capacity".
  // A carrier bidding on this needs to know BEFORE they commit: an online order
  // is normally couriered to their local address rather than handed over in
  // person, which changes what they are agreeing to.
  const onlineOrderPill = !isTrip && match.is_online_order ? (
    <View style={[styles.onlineOrderPill, nested && styles.capacityPillNested]}>
      <Ionicons name="cube-outline" size={12} color={colors.primary} />
      <Text style={styles.onlineOrderPillText}>Online order</Text>
    </View>
  ) : null;

  const warningBlock = (match.exceeds_capacity || onlineOrderPill) ? (
    <View style={styles.pillRow}>
      {match.exceeds_capacity ? (
        <View style={[styles.capacityPill, nested && styles.capacityPillNested]}>
          <Ionicons name="alert-circle" size={12} color={colors.warning} />
          <Text style={styles.capacityPillText}>
            {isTrip ? "Exceeds capacity" : "Exceeds your capacity"}
          </Text>
        </View>
      ) : null}
      {onlineOrderPill}
    </View>
  ) : null;

  const actionsBlock = (
    <View style={sharedStyles.actionsRow}>
      <AppButton
        label="View profile"
        variant="secondary"
        onPress={handleViewProfile}
        style={sharedStyles.actionButtonFlex}
      />
      <AppButton
        label={chatStarting ? "Starting…" : "Start chat"}
        onPress={() => void handleStartChat()}
        disabled={chatStarting || !person?.id}
        gradientColors={[colors.ctaAccent, colors.ctaAccent]}
        style={sharedStyles.actionButtonFlex}
      />
    </View>
  );

  // Nested under a listing card: no card chrome or route header (parent shows it).
  if (nested) {
    return (
      <View style={[styles.matchNested, highlighted && sharedStyles.matchHighlighted]}>
        {personBlock}
        {metricsBlock}
        {subtitleBlock}
        {warningBlock}
        {actionsBlock}
      </View>
    );
  }

  return (
    <Card style={[sharedStyles.matchCard, highlighted && sharedStyles.matchHighlighted]}>
      <RouteHeader
        fromCity={match.from_city}
        toCity={match.to_city}
        kind={isTrip ? "trip" : "parcel"}
        compact
      />
      {metricsBlock}
      {subtitleBlock}
      {warningBlock}
      <View style={styles.divider} />
      {personBlock}
      {actionsBlock}
    </Card>
  );
}

const styles = StyleSheet.create({
  matchNested: { gap: 12 },
  matchSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
  },
  matchSubtitleNested: { textAlign: "left" },
  capacityPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(245, 159, 10, 0.12)",
    marginTop: 6,
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  onlineOrderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: primaryTint.fill12,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  onlineOrderPillText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  capacityPillNested: { alignSelf: "flex-start" },
  capacityPillText: { color: colors.warning, fontSize: 11, lineHeight: 14, fontWeight: "700" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
