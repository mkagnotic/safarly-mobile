import { Ionicons } from "@expo/vector-icons";
import { memo, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import type { DealProjection } from "@/services/api";
import { isDealFinished, labelDeals, selectableDeals } from "@/utils/dealLabel";
import { BUDDY_ENTRY_ID, buddyEntryLabel, switcherEntryCount, type BuddyEntry } from "@/utils/buddyEntry";
import { colors } from "@/theme/colors";

interface Props {
  deals: DealProjection[];
  selectedDealId: string | null;
  onSelect: (dealId: string) => void;
  /**
   * The pair's travel-buddy entry in a shared chat, shown as one more chip.
   * `selectedDealId === "buddy"` selects it.
   */
  buddy?: BuddyEntry | null;
}

/**
 * A finished delivery is not a place to act, so it does not belong in a switcher whose
 * whole job is "which one am I working on".
 *
 * COMPLETED is deliberately NOT here: a delivered deal still has a last step - rating
 * the other party - so hiding it would strand that action. Only dead deals go.
 */
// Delegates rather than repeating the rule: `selectableDeals` below decides which
// deals the switcher SHOWS, and the pinned context line uses the same helper. Two
// copies of "is this finished" is how the switcher and that line came to disagree.
const isFinished = (deal: DealProjection): boolean => isDealFinished(deal);

/**
 * The heading over the chips. It counts EXACTLY the chips it sits above - it used
 * to say "N deliveries" over every selectable deal (open requests, deals awaiting
 * payment or handoff...), so a pair with 8 real deliveries read "827 deliveries".
 * A deal is not a delivery until it is delivered, so the word is "deals", and the
 * delivered ones are named separately. Same wording on web and mobile.
 */
export function dealSwitcherHeading(
  shown: readonly { workflow?: { state?: string | null } | null }[],
): string {
  const total = shown.length;
  const delivered = shown.filter((d) => d.workflow?.state === "COMPLETED").length;
  const head = `${total} ${total === 1 ? "deal" : "deals"} with this person`;
  return delivered > 0 ? `${head} · ${delivered} delivered` : head;
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
function ChatDealSwitcherBase({ deals, selectedDealId, onSelect, buddy = null }: Props) {
  // A cancelled or expired delivery is history - keep it out of the picker. The one
  // exception is the deal currently on screen: removing the chip you just tapped would
  // leave the switcher pointing at nothing.
  const shown = selectableDeals(deals ?? [], selectedDealId);

  // Labelled over EVERY deal, not only the visible ones, so a chip here and the
  // pinned line below can never disagree about what a delivery is called. The label
  // used to be the ROUTE alone, and two deals on one route rendered an identical
  // chip - see `utils/dealLabel.ts` for the incident that caused.
  const labels = useMemo(() => labelDeals(deals ?? []), [deals]);

  // Two or more things to choose between - a lone buddy entry (or a lone deal)
  // needs no switcher.
  if (switcherEntryCount(shown.length, buddy) < 2) return null;
  const buddySelected = !!buddy && selectedDealId === BUDDY_ENTRY_ID;
  const buddyLabel = buddy ? buddyEntryLabel(buddy) : "";

  return (
    <View style={styles.wrap}>
      <View style={styles.headingRow}>
        <Ionicons name="cube-outline" size={12} color={colors.subtleText} />
        <Text style={styles.heading}>{dealSwitcherHeading(shown)}{buddy ? " · travel buddy" : ""}</Text>
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
              accessibilityLabel={`Show ${labels.get(id)?.chip ?? "delivery"}`}
              onPress={() => onSelect(id)}
              style={[
                styles.chip,
                selected ? styles.chipOn : styles.chipOff,
                finished ? styles.chipDim : null,
              ]}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextOn : styles.chipTextOff]}>
                {labels.get(id)?.chip ?? "Delivery"}
                {finished ? "  · ended" : ""}
              </Text>
            </Pressable>
          );
        })}
        {buddy ? (
          <Pressable
            key={BUDDY_ENTRY_ID}
            accessibilityRole="button"
            accessibilityState={{ selected: buddySelected }}
            accessibilityLabel={`Show ${buddyLabel}`}
            onPress={() => onSelect(BUDDY_ENTRY_ID)}
            style={[styles.chip, styles.buddyChip, buddySelected ? styles.chipOn : styles.chipOff]}
          >
            <Ionicons name="people-outline" size={12} color={buddySelected ? colors.text : colors.subtleText} />
            <Text style={[styles.chipText, buddySelected ? styles.chipTextOn : styles.chipTextOff]}>
              {buddyLabel}
            </Text>
          </Pressable>
        ) : null}
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
  buddyChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  chipText: { fontSize: 12, fontWeight: "700" },
  chipTextOn: { color: colors.text },
  chipTextOff: { color: colors.subtleText },
});
