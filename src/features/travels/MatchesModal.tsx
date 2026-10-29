import { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  CompositeNavigationProp,
  useNavigation,
} from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { VerifiedAvatarBadge } from "@/components/ui/Avatar";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { FormBanner } from "@/components/ui/FormBanner";
import { withoutBlocked } from "@/features/moderation/blockFilter";
import { useBlockedUsers } from "@/hooks/api/useBlockedUsers";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import {
  getErrorMessage,
  messagesApi,
  parcelsApi,
  tripsApi,
} from "@/services/api";
import { colors } from "@/theme/colors";
import { formatMoneyShort } from "@/utils/money";
import { formatLocalDate } from "@/utils/travelDate";
import { ErrorState } from "@/components/ui/ErrorState";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export interface MatchesSource {
  /** `parcel` → show matching carriers; `trip` → show matching senders. */
  kind: "parcel" | "trip";
  id: string;
  routeLabel: string;
}

interface MatchRow {
  key: string;
  personId: string | null;
  name: string;
  verified: boolean;
  rating: number;
  fromCity: string;
  toCity: string;
  dateLabel: string;
  metaParts: string[];
}

function formatDate(iso?: string | null): string {
  // `travel_date` is a date-only column — never `new Date()`. See formatLocalDate.
  return formatLocalDate(iso, { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface Props {
  open: boolean;
  source: MatchesSource | null;
  onClose: () => void;
}

export function MatchesModal({ open, source, onClose }: Readonly<Props>) {
  const navigation = useNavigation<Nav>();

  const [allRows, setRows] = useState<MatchRow[]>([]);
  // Suggestions are browse content: blocked people (either direction) drop out.
  const { hiddenUserIds } = useBlockedUsers();
  const rows = useMemo(
    () => withoutBlocked(allRows, hiddenUserIds, (r) => r.personId),
    [allRows, hiddenUserIds],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  // A failed "Message" tap is reported in the card — a toast would render
  // under this Modal. Cleared on retry and whenever the modal closes.
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setChatError(null);
  }, [open]);

  const kind = source?.kind;
  const sourceId = source?.id;
  const isParcel = kind === "parcel";
  const title = isParcel ? "Matching carriers" : "Matching senders";
  const description = isParcel
    ? `Carriers on ${source?.routeLabel ?? ""} who can deliver this parcel.`
    : `Senders on ${source?.routeLabel ?? ""} with parcels that match your trip.`;

  /** Bumped by Retry to re-run the load below. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || !kind || !sourceId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRows([]);
    (async () => {
      try {
        if (kind === "parcel") {
          const res = await parcelsApi.findMatches(sourceId);
          if (cancelled) return;
          setRows(
            (res.data ?? []).map((m) => {
              const cap = m.luggage_capacity_kg ?? m.luggage_capacity;
              return {
                key: m.trip_id,
                personId: m.carrier?.id ?? m.carrier_id ?? null,
                name: m.carrier?.name ?? m.carrier_name ?? "Carrier",
                verified: m.carrier?.is_verified === true,
                rating: m.carrier?.rating ?? 0,
                fromCity: m.from_city,
                toCity: m.to_city,
                dateLabel: formatDate(m.travel_date),
                metaParts: [
                  cap != null ? `${cap} kg capacity` : "",
                  m.airline ?? "",
                ].filter(Boolean),
              };
            }),
          );
        } else {
          const res = await tripsApi.findParcels(sourceId);
          if (cancelled) return;
          setRows(
            (res.data ?? []).map((m) => {
              const weight = m.weight_kg ?? m.weight;
              return {
                key: m.parcel_id,
                personId: m.sender?.id ?? m.sender_id ?? null,
                name: m.sender?.name ?? m.sender_name ?? "Sender",
                verified: m.sender?.is_verified === true,
                rating: m.sender?.rating ?? 0,
                fromCity: m.from_city,
                toCity: m.to_city,
                dateLabel: `by ${formatDate(m.delivery_by)}`,
                metaParts: [
                  m.category?.trim() ?? "",
                  weight != null ? `${weight} kg` : "",
                  m.fee_offered != null ? formatMoneyShort(m.fee_offered, m.fee_currency) : "",
                ].filter(Boolean),
              };
            }),
          );
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, kind, sourceId, attempt]);

  const handleViewProfile = useCallback(
    (personId: string | null, name: string) => {
      if (!personId) return;
      onClose();
      navigation.navigate("PublicProfileTab", { userId: personId, name });
    },
    [navigation, onClose],
  );

  const handleStartChat = useCallback(
    async (personId: string | null, name: string) => {
      if (!personId) return;
      setStartingId(personId);
      setChatError(null);
      try {
        const res = await messagesApi.createConversation(personId, "booking");
        onClose();
        navigation.navigate("OfferChatTab", {
          conversationId: res.data.id,
          name: name || "Conversation",
          source: "messages",
        });
      } catch (err) {
        // Leave the modal open so the user can retry, and say why it failed —
        // this used to swallow the error and the tap simply did nothing.
        setChatError(`Couldn't start the chat. ${getErrorMessage(err)}`);
      } finally {
        setStartingId(null);
      }
    },
    [navigation, onClose],
  );

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <View style={styles.titleRow}>
                <Ionicons
                  name={isParcel ? "airplane-outline" : "cube-outline"}
                  size={18}
                  color={colors.wordmark}
                />
                <Text style={styles.title}>
                  {title}
                  {!loading && !error ? ` (${rows.length})` : ""}
                </Text>
              </View>
              <Text style={styles.description}>{description}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>

          <FormBanner message={chatError} onDismiss={() => setChatError(null)} />

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : error ? (
            <ErrorState error={error} subject="matches" onRetry={() => setAttempt((n) => n + 1)} />
          ) : rows.length === 0 ? (
            <View style={styles.stateBox}>
              <Ionicons name="people-outline" size={28} color={colors.mutedText} />
              <Text style={styles.emptyTitle}>No matches right now</Text>
              <Text style={styles.stateText}>
                We&apos;ll keep watching — new {isParcel ? "carriers" : "senders"} on this route
                will show up here.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {rows.map((r) => (
                <View key={r.key} style={styles.matchRow}>
                  <View style={styles.personRow}>
                    <View>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getInitials(r.name)}</Text>
                      </View>
                      <VerifiedAvatarBadge verified={r.verified} avatarSize={44} />
                    </View>
                    <View style={styles.personInfo}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={12} color={colors.warning} />
                        <Text style={styles.ratingText}>
                          {r.rating > 0 ? `${r.rating.toFixed(1)} rating` : "New"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.routeRow}>
                    <Text style={styles.routeText} numberOfLines={1}>
                      {r.fromCity}
                    </Text>
                    <Ionicons name="arrow-forward" size={13} color={colors.mutedText} />
                    <Text style={styles.routeText} numberOfLines={1}>
                      {r.toCity}
                    </Text>
                  </View>
                  <Text style={styles.metaText} numberOfLines={1}>
                    {[r.dateLabel, ...r.metaParts].join(" · ")}
                  </Text>

                  <View style={styles.actionsRow}>
                    <AppButton
                      label="View profile"
                      variant="secondary"
                      onPress={() => handleViewProfile(r.personId, r.name)}
                      disabled={!r.personId}
                      style={styles.actionButtonFlex}
                    />
                    <AppButton
                      label={startingId === r.personId ? "Starting…" : "Start chat"}
                      onPress={() => void handleStartChat(r.personId, r.name)}
                      disabled={!r.personId || startingId === r.personId}
                      gradientColors={[colors.ctaAccent, colors.ctaAccent]}
                      style={styles.actionButtonFlex}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,25,0.4)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "82%",
    borderRadius: 22,
    backgroundColor: colors.card,
    padding: 20,
    gap: 14,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headerText: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: "800" },
  description: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "500" },

  stateBox: { alignItems: "center", justifyContent: "center", paddingVertical: 28, gap: 8 },
  stateText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 320,
  },
  emptyTitle: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "800", marginTop: 2 },

  scroll: { flexGrow: 0 },
  scrollContent: { gap: 12 },

  matchRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 10,
  },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.wordmark, fontSize: 14, lineHeight: 18, fontWeight: "800" },
  personInfo: { flex: 1, minWidth: 0 },
  personName: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "800" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingText: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500" },

  routeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  routeText: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700", flexShrink: 1 },
  metaText: { color: colors.mutedText, fontSize: 12, lineHeight: 17, fontWeight: "500" },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  actionButtonFlex: { flex: 1 },
});
