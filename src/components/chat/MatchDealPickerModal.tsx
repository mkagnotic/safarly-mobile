import { Ionicons } from "@expo/vector-icons";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import type { MatchCandidate } from "@/services/api";
import { colors } from "@/theme/colors";
import { formatCandidateDate, parcelRouteOf, tripRouteOf } from "@/utils/matchCandidateLabel";

interface Props {
  open: boolean;
  candidates: MatchCandidate[];
  pending?: boolean;
  onCancel: () => void;
  onPick: (candidate: MatchCandidate) => void;
}


/**
 * Which delivery is this match for?
 *
 * Shown when the server refuses to guess. It refuses deliberately: with more than one
 * parcel/trip pairing in common, any rule it picked would be right for one person's
 * intent and wrong for another's - and matching the wrong one silently attaches the
 * travel documents, the price and the payment to a delivery nobody meant.
 *
 * Keep in sync with web `src/customer/components/MatchDealPickerDialog.tsx`.
 */
export function MatchDealPickerModal({ open, candidates, pending, onCancel, onPick }: Props) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable
        style={styles.backdrop}
        onPress={() => { if (!pending) onCancel(); }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="cube" size={20} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Which delivery is this for?</Text>
            <Text style={styles.subtitle}>
              You have more than one delivery in common with this person. Pick the one
              you mean — the rest are left exactly as they are.
            </Text>
          </View>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
          {candidates.map((c) => {
            const when = formatCandidateDate(c.travel_date);
            // The TRIP is what differs when one parcel pairs with several trips, so
            // it is always shown. Without it every row of a flexible listing read
            // "Any -> Any" and the picker could not actually be used to pick.
            const tripRoute = tripRouteOf(c);
            return (
              <Pressable
                key={`${c.parcel_id}:${c.trip_id}`}
                accessibilityRole="button"
                disabled={pending}
                onPress={() => onPick(c)}
                style={[styles.row, pending ? styles.rowDim : null]}
              >
                <Ionicons name="cube-outline" size={16} color={colors.subtleText} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {parcelRouteOf(c)}
                  </Text>
                  {tripRoute ? (
                    <Text style={styles.rowVia} numberOfLines={2}>via {tripRoute}</Text>
                  ) : null}
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {when ? `Travelling ${when}` : "Travel date not set"}
                    {c.fee_offered != null ? ` · asking $${c.fee_offered}` : ""}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.subtleText} />
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          disabled={pending}
          style={styles.cancel}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "80%",
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  header: { flexDirection: "row", gap: 10, marginBottom: 12 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  subtitle: { marginTop: 3, fontSize: 12, lineHeight: 17, color: colors.subtleText },
  list: { flexGrow: 0 },
  listInner: { gap: 8, paddingBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  rowDim: { opacity: 0.6 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  rowVia: { color: colors.text, fontSize: 11, lineHeight: 15, marginTop: 2 },
  rowMeta: { marginTop: 2, fontSize: 12, color: colors.subtleText },
  cancel: { marginTop: 12, alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 14, fontWeight: "600", color: colors.subtleText },
});
