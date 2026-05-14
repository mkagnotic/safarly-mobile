import { Ionicons } from "@expo/vector-icons";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { useParcelDetail } from "@/hooks/api/useParcelDetail";
import { MainTabParamList } from "@/navigation/types";
import { type Parcel } from "@/services/api";
import { colors } from "@/theme/colors";

type Props = BottomTabScreenProps<MainTabParamList, "ParcelDetailsTab">;

const STATUS_TONES: Record<string, { bg: string; fg: string }> = {
  open: { bg: "#F1ECFA", fg: colors.primary },
  in_transit: { bg: "#FFF3DD", fg: colors.warning },
  delivered: { bg: "#DCFCE7", fg: colors.safe },
  disputed: { bg: "#FDE2E2", fg: colors.danger },
};

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
};

function formatDeliveryDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFee(parcel: Parcel): string {
  const symbol = CURRENCY_SYMBOL[parcel.fee_currency] ?? "";
  const amount = `${parcel.fee_offered}`;
  if (symbol) return `${symbol}${amount}`;
  return `${amount} ${parcel.fee_currency}`;
}

function senderInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

function DetailsHeader({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <Pressable
      onPress={onBack}
      style={styles.backRow}
      accessibilityRole="button"
      accessibilityLabel="Back to Parcels"
    >
      <Ionicons name="chevron-back" size={16} color={colors.subtleText} />
      <Text style={styles.backText}>Back to Parcels</Text>
    </Pressable>
  );
}

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const tone = STATUS_TONES[status] ?? { bg: "#E5E7EB", fg: colors.subtleText };
  return (
    <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusBadgeText, { color: tone.fg }]}>
        {status.replace("_", " ").toUpperCase()}
      </Text>
    </View>
  );
}

function MetricCell({
  icon,
  value,
  label,
  highlightColor,
}: Readonly<{
  icon?: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  highlightColor?: string;
}>) {
  return (
    <View style={styles.metricCell}>
      {icon ? (
        <Ionicons name={icon} size={14} color={colors.mutedText} style={styles.metricIcon} />
      ) : null}
      <Text style={[styles.metricValue, highlightColor ? { color: highlightColor } : null]}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusAlert({ status }: Readonly<{ status: string }>) {
  if (status === "delivered") {
    return (
      <View style={[styles.alertRow, styles.alertSuccess]}>
        <Ionicons name="checkmark-circle" size={16} color={colors.safe} />
        <Text style={[styles.alertText, { color: colors.safe }]}>Payment released to carrier</Text>
      </View>
    );
  }
  if (status === "disputed") {
    return (
      <View style={[styles.alertRow, styles.alertDanger]}>
        <Ionicons name="alert-circle" size={16} color={colors.danger} />
        <Text style={[styles.alertText, { color: colors.danger }]}>
          Payment under review -- dispute open
        </Text>
      </View>
    );
  }
  return null;
}

function ParcelHeaderCard({ parcel }: Readonly<{ parcel: Parcel }>) {
  return (
    <Card style={styles.headerCard}>
      <View style={styles.headerTop}>
        <View style={styles.headerTopLeft}>
          <Text style={styles.parcelId} numberOfLines={1}>
            {parcel.id}
          </Text>
          <View style={styles.routeRow}>
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={styles.routeText} numberOfLines={2}>
              {parcel.from_city}
            </Text>
            <Ionicons name="arrow-forward" size={14} color={colors.subtleText} />
            <Text style={styles.routeText} numberOfLines={2}>
              {parcel.to_city}
            </Text>
          </View>
        </View>
        <StatusBadge status={parcel.status} />
      </View>

      <View style={styles.metricsRow}>
        <MetricCell icon="barbell-outline" value={`${parcel.weight_kg} kg`} label="WEIGHT" />
        <MetricCell
          icon="calendar-outline"
          value={formatDeliveryDate(parcel.delivery_by)}
          label="DELIVERY BY"
        />
        <MetricCell value={formatFee(parcel)} label="FEE" highlightColor={colors.primary} />
        <MetricCell value={parcel.category} label="CATEGORY" />
      </View>
    </Card>
  );
}

function DescriptionCard({ description }: Readonly<{ description: string | null }>) {
  return (
    <Card style={styles.bodyCard}>
      <Text style={styles.bodyLabel}>DESCRIPTION</Text>
      <Text style={styles.bodyText}>{description?.trim() || "No description provided."}</Text>
    </Card>
  );
}

function SenderCard({ sender }: Readonly<{ sender: NonNullable<Parcel["sender"]> }>) {
  return (
    <Card style={styles.senderCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{senderInitial(sender.name ?? "")}</Text>
      </View>
      <View style={styles.senderInfo}>
        <Text style={styles.senderName} numberOfLines={2}>
          {sender.name}
        </Text>
        <Text style={styles.senderRole}>Sender</Text>
      </View>
    </Card>
  );
}

function NotFoundState({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <Card style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>Parcel not found</Text>
      <Text style={styles.emptySubtitle}>
        The parcel you're looking for doesn't exist or could not be loaded.
      </Text>
      <Pressable
        style={styles.emptyButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to Parcels"
      >
        <Text style={styles.emptyButtonText}>Back to Parcels</Text>
      </Pressable>
    </Card>
  );
}

function LoadingState() {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Loading parcel details…</Text>
    </View>
  );
}

export function ParcelDetailsScreen({ navigation, route }: Readonly<Props>) {
  const { parcelId } = route.params;
  const { parcel, error, refetch } = useParcelDetail(parcelId);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Parcels");
  }, [navigation]);

  // Web's `Message Sender` link goes to `/customer/messages` (the inbox), not
  // a specific conversation. Mobile parity: open the Inbox tab.
  const handleMessageSender = useCallback(() => {
    navigation.navigate("Buddies");
  }, [navigation]);

  // Show Loading until we have the parcel OR a confirmed error. Avoids the
  // "Parcel not found" flash on the render-tick between route.params arriving
  // and the hook's first refetch firing.
  if (!parcel && !error) {
    return (
      <Screen onRefresh={refetch}>
        <DetailsHeader onBack={handleBack} />
        <LoadingState />
      </Screen>
    );
  }

  if (error || !parcel) {
    return (
      <Screen onRefresh={refetch}>
        <DetailsHeader onBack={handleBack} />
        <NotFoundState onBack={handleBack} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refetch}>
      <DetailsHeader onBack={handleBack} />

      <ParcelHeaderCard parcel={parcel} />

      <StatusAlert status={parcel.status} />

      <DescriptionCard description={parcel.description} />

      {parcel.sender ? <SenderCard sender={parcel.sender} /> : null}

      <Pressable
        style={styles.messageButton}
        onPress={handleMessageSender}
        accessibilityRole="button"
        accessibilityLabel="Message Sender"
      >
        <Ionicons name="chatbubble-ellipses" size={16} color={colors.text} />
        <Text style={styles.messageButtonText}>Message Sender</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 14,
  },
  backText: {
    color: colors.subtleText,
    fontSize: 13,
    fontWeight: "600",
  },
  headerCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },
  headerTopLeft: {
    flex: 1,
    minWidth: 0,
  },
  parcelId: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  routeText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    flexShrink: 1,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  metricCell: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    minHeight: 64,
    justifyContent: "center",
  },
  metricIcon: {
    marginBottom: 4,
  },
  metricValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  metricLabel: {
    color: colors.subtleText,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginTop: 4,
    textAlign: "center",
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  alertSuccess: {
    backgroundColor: "#DCFCE7",
  },
  alertDanger: {
    backgroundColor: "#FDE2E2",
  },
  alertText: {
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  bodyCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  bodyLabel: {
    color: colors.subtleText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  bodyText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
  senderCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: "800",
  },
  senderInfo: {
    flex: 1,
    minWidth: 0,
  },
  senderName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  senderRole: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  messageButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  messageButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  loadingText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "500",
  },
  emptyCard: {
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
});
