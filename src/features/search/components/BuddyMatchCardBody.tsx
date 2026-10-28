import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ModerationMenu } from "@/components/moderation/ModerationMenu";
import { useAuth } from "@/context/AuthContext";
import { MetricRow, MetricTile, RouteHeader } from "@/features/search/routeBlocks";
import type { BuddySearchMatch } from "@/services/api";
import { colors } from "@/theme/colors";
import { sharedStyles } from "@/features/search/searchStyles";

interface BuddyMatchCardBodyProps {
  match: BuddySearchMatch;
  /** Deep-link highlight (web parity: the `?match=` ring). */
  highlighted?: boolean;
  dateLabel: string;
  details: { label: string; value: string }[];
  handleViewProfile: () => void;
  chatStarting: boolean;
  handleStartChat: () => Promise<void>;
  /** Below the actions, inside the card (the person's other listings). */
  footer?: ReactNode;
}

/**
 * What a travel-buddy match card shows. Its state and actions (View profile,
 * Start chat) stay in `BuddyMatchCard` in SearchScreen.tsx. There is no Connect
 * button by design: a buddy match is formed like every other request - Start
 * chat, one side taps Match, the other accepts.
 */
export function BuddyMatchCardBody({
  match,
  highlighted,
  dateLabel,
  details,
  handleViewProfile,
  chatStarting,
  handleStartChat,
  footer,
}: Readonly<BuddyMatchCardBodyProps>) {
  const { user } = useAuth();
  const canReport = !!match.user?.id && match.user.id !== user?.id;
  return (
    <Card style={[sharedStyles.matchCard, highlighted && sharedStyles.matchHighlighted]}>
      <View style={sharedStyles.personRow}>
        <Avatar name={match.user?.name} uri={match.user?.avatar_url} size={48} verified={match.user?.is_verified} />
        <View style={sharedStyles.personInfo}>
          <View style={styles.buddyTitleRow}>
            <Text style={sharedStyles.personName} numberOfLines={2}>
              {match.user?.name || "Traveler"}
            </Text>
            <View style={styles.badgeSafe}>
              <Text style={styles.badgeText}>Buddy</Text>
            </View>
          </View>
          <Text style={sharedStyles.ratingText}>
            {match.user?.rating && match.user.rating > 0
              ? `${match.user.rating.toFixed(1)} rating`
              : "New member"}
          </Text>
        </View>
        {canReport ? (
          <ModerationMenu target={{ type: "buddy_listing", id: match.id }} reportLabel="Report listing" />
        ) : null}
      </View>

      <View style={styles.travelDetailsBlock}>
        <Text style={styles.travelLabel}>Travel details</Text>
        <RouteHeader fromCity={match.from_city} toCity={match.to_city} kind="trip" compact />
        <MetricRow>
          <MetricTile label="Date" value={dateLabel} compact />
          <MetricTile label="Airline" value={match.airline || "—"} highlight compact />
        </MetricRow>
        {details.length > 0 ? (
          <View style={styles.detailsGrid}>
            {details.map((d) => (
              <View key={d.label} style={styles.detailItem}>
                <Text style={styles.detailLabel}>{d.label}</Text>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {d.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {match.bio ? (
          <Text style={styles.bioText} numberOfLines={2}>
            {match.bio}
          </Text>
        ) : null}
      </View>

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
          disabled={chatStarting || !match.user?.id}
          gradientColors={[colors.ctaAccent, colors.ctaAccent]}
          style={sharedStyles.actionButtonFlex}
        />
      </View>
      {footer}
    </Card>
  );
}

const styles = StyleSheet.create({
  // Buddy card
  buddyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  badgeSafe: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  badgeText: { color: colors.safe, fontSize: 10, lineHeight: 13, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  travelDetailsBlock: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  travelLabel: {
    color: colors.subtleText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  detailItem: { width: "44%" },
  detailLabel: {
    color: colors.mutedText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  bioText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
