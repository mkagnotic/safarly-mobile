import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { useDeliveryHistory } from "@/hooks/api/useDeliveryHistory";
import { type DeliveryHistoryItem } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";

interface DeliveryHistoryModalProps {
  open: boolean;
  conversationId: string | null;
  onClose: () => void;
}

interface StatusToken {
  bg: string;
  fg: string;
}

/**
 * Status pills mirror web's `STATUS_COLORS` map in
 * `customer/components/DeliveryHistoryDialog.tsx`. Anything we don't recognize
 * falls through to a muted gray pill.
 */
const STATUS_TOKENS: Record<string, StatusToken> = {
  delivered: { bg: "rgba(34, 195, 93, 0.15)", fg: colors.safe },
  confirmed: { bg: primaryTint.fill15, fg: colors.primary },
  in_transit: { bg: "rgba(245, 159, 10, 0.18)", fg: colors.warning },
  cancelled: { bg: "rgba(220, 40, 40, 0.15)", fg: colors.danger },
  pending_payment: { bg: colors.surfaceMuted, fg: colors.mutedText },
  disputed: { bg: "rgba(220, 40, 40, 0.15)", fg: colors.danger },
};

function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(
    undefined,
    opts ?? { year: "numeric", month: "short", day: "numeric" },
  );
}

function prettyStatus(status: string): string {
  return status.replace(/_/g, " ");
}

/**
 * Mirrors web's `DeliveryHistoryDialog`: lists past deliveries between the two
 * participants. Useful "have we worked together before?" context. Read-only.
 */
export function DeliveryHistoryModal({
  open,
  conversationId,
  onClose,
}: Readonly<DeliveryHistoryModalProps>) {
  const { items, loading, error, refetch } = useDeliveryHistory({
    conversationId,
    enabled: open,
  });

  const sorted = useMemo(
    () =>
      items.slice().sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [items],
  );

  const renderItem = ({ item }: ListRenderItemInfo<DeliveryHistoryItem>) => {
    const tone = STATUS_TOKENS[item.status] ?? {
      bg: colors.surfaceMuted,
      fg: colors.mutedText,
    };
    const route = item.parcel
      ? `${item.parcel.from_city}, ${item.parcel.from_country} → ${item.parcel.to_city}, ${item.parcel.to_country}`
      : "Route unavailable";
    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTextWrap}>
            <Text style={styles.routeText} numberOfLines={2}>
              {route}
            </Text>
            <Text style={styles.metaText}>
              {formatDate(item.created_at)}
              {item.delivered_at
                ? ` • Delivered ${formatDate(item.delivered_at, { month: "short", day: "numeric" })}`
                : ""}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
            <Text style={[styles.statusText, { color: tone.fg }]}>
              {prettyStatus(item.status)}
            </Text>
          </View>
        </View>
        {item.parcel?.category ? (
          <Text style={styles.categoryText}>Category: {item.parcel.category}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss delivery history"
      />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <View style={styles.headerIcon}>
            <Ionicons name="cube-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Delivery History</Text>
            <Text style={styles.subtitle}>
              Past deliveries between you and this user.
            </Text>
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

        {loading && sorted.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error && sorted.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons
              name="cloud-offline-outline"
              size={32}
              color={colors.mutedText}
            />
            <Text style={styles.errorTitle}>Couldn't load history</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => void refetch()}
              accessibilityRole="button"
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : sorted.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No delivery history found.</Text>
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,25,0.4)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "80%",
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 12, marginTop: 2 },

  listContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, gap: 10 },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  cardTopRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  cardTextWrap: { flex: 1, minWidth: 0 },
  routeText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  metaText: { color: colors.mutedText, fontSize: 11, marginTop: 4 },
  categoryText: {
    color: colors.mutedText,
    fontSize: 11,
    textTransform: "capitalize",
  },

  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "capitalize",
  },

  centered: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 10,
  },
  emptyText: { color: colors.mutedText, fontSize: 13 },
  errorTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  retryButtonText: { color: colors.white, fontSize: 13, fontWeight: "700" },
});
