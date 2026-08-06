import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import type { DealProjection } from "@/services/api";
import { colors } from "@/theme/colors";

interface Props {
  deals: DealProjection[];
  selectedDealId: string | null;
  onSelect: (dealId: string) => void;
}

/** Short, human label for a deal — the route is how people actually tell them apart. */
function routeLabel(deal: DealProjection): string {
  const p = deal.active_deal.parcel;
  if (!p) return "Delivery";
  const trim = (v: string | null | undefined) => (v || "").split(",")[0].trim();
  const from = trim(p.from_city);
  const to = trim(p.to_city);
  if (from && to) return `${from} → ${to}`;
  return to || from || "Delivery";
}

/**
 * A finished delivery is not a place to act, so it does not belong in a switcher whose
 * whole job is "which one am I working on".
 *
 * COMPLETED is deliberately NOT here: a delivered deal still has a last step - rating
 * the other party - so hiding it would strand that action. Only dead deals go.
 */
function isFinished(deal: DealProjection): boolean {
  return deal.active_deal.request_status === "rejected" ||
    deal.active_deal.request_status === "withdrawn" ||
    ["CANCELLED", "ARCHIVED"].includes(deal.workflow.state);
}

/**
 * Which delivery is this chat showing?
 *
 * A conversation is a thread between two people, but they can have several deliveries
 * running at once - each its own deal, with its own documents, price and lifecycle.
 * Without this, the thread silently showed one of them and the others were invisible.
 *
 * Renders NOTHING for a single deal, which is the overwhelmingly common case: a chat
 * with one delivery looks exactly as it always has. Keep in sync with web
 * `src/customer/components/ChatDealSwitcher.tsx`.
 */
function ChatDealSwitcherBase({ deals, selectedDealId, onSelect }: Props) {
  // A cancelled or expired delivery is history - keep it out of the picker. The one
  // exception is the deal currently on screen: removing the chip you just tapped would
  // leave the switcher pointing at nothing.
  const shown = (deals ?? []).filter(
    (d) => !isFinished(d) || d.active_deal.carrier_request_id === selectedDealId,
  );
  if (shown.length < 2) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headingRow}>
        <Ionicons name="cube-outline" size={12} color={colors.subtleText} />
        <Text style={styles.heading}>{shown.length} deliveries with this person</Text>
      </View>
      {/* Horizontal scroll rather than wrapping: the pinned zone is height-capped, and
          a wrapping row of chips would eat the space the pinned action needs. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {shown.map((deal) => {
          const id = deal.active_deal.carrier_request_id;
          const selected = id === selectedDealId;
          const finished = isFinished(deal);
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Show ${routeLabel(deal)}`}
              onPress={() => onSelect(id)}
              style={[
                styles.chip,
                selected ? styles.chipOn : styles.chipOff,
                finished ? styles.chipDim : null,
              ]}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextOn : styles.chipTextOff]}>
                {routeLabel(deal)}
                {finished ? "  · ended" : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export const ChatDealSwitcher = memo(ChatDealSwitcherBase);

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  heading: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.subtleText,
  },
  row: { flexDirection: "row", gap: 6, paddingBottom: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipOn: { backgroundColor: colors.surfaceMuted, borderColor: colors.controlOutline },
  chipOff: { backgroundColor: "transparent", borderColor: colors.border },
  chipDim: { opacity: 0.6 },
  chipText: { fontSize: 12, fontWeight: "700" },
  chipTextOn: { color: colors.text },
  chipTextOff: { color: colors.subtleText },
});
