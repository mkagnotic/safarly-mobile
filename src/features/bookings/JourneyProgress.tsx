import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import {
  JOURNEY_STEP,
  JOURNEY_STEP_ORDER,
  currentJourneyStep,
  journeyStepIndex,
} from "@/utils/journeySteps";

/**
 * One authoritative "where am I" for a booking. Mirrors web's JourneyProgress.
 *
 * Before this, the only indication of progress was an eyebrow on each action
 * card — and several cards are deliberately shown before their turn (the
 * delivery-code card is offered during IN_TRANSIT so a forgotten "I've landed"
 * tap can't strand a delivery). The result was a carrier seeing "Step 4 of 6 ·
 * In transit" and "Step 6 of 6 · Delivery" stacked on the same screen, with no
 * way to tell which one they were actually on, and no indication of the steps
 * that had no card at all.
 */
export function JourneyProgress({
  booking,
}: Readonly<{
  booking: {
    status: string;
    journey_started_at?: string | null;
    ready_for_delivery_at?: string | null;
    delivered_at?: string | null;
  };
}>) {
  const current = currentJourneyStep(booking);
  const currentIdx = journeyStepIndex(current);
  const isDone = booking.status === "delivered" || !!booking.delivered_at;

  return (
    <View style={styles.wrap}>
      {/* No header row. The step's NAME is on the action card's eyebrow directly
          below and again in the labels row under the bar, and the filled segments
          already say "5 of 6" - a counter line on its own left an empty band
          across the card with one small number stranded at the right. */}
      <View style={styles.track} accessibilityRole="progressbar">
        {JOURNEY_STEP_ORDER.map((key, i) => {
          const done = isDone || i < currentIdx;
          const active = !isDone && i === currentIdx;
          return (
            <View
              key={key}
              style={[
                styles.segment,
                done ? styles.segmentDone : active ? styles.segmentActive : styles.segmentTodo,
              ]}
            />
          );
        })}
      </View>

      {/* Named steps, so the ones with no action card of their own are still
          visible as part of the journey.

          STACKED, one per row, matching what web now does at phone widths.
          They used to sit inline under their segment in six flex:1 cells at
          fontSize 9 with numberOfLines={1}, which on a phone is ~45dp of room per
          label - about nine characters. "Ready for delivery" and "Travel ready"
          were therefore ellipsised on every device, and on a 320dp screen so was
          "In transit". Six unreadable stubs under the bar are no better than the
          bar on its own, which is exactly what was reported. */}
      <View style={styles.labelList}>
        {JOURNEY_STEP_ORDER.map((key, i) => {
          const done = isDone || i < currentIdx;
          const active = !isDone && i === currentIdx;
          return (
            <View key={key} style={styles.labelRow}>
              {/* Fixed-width marker column so the names line up whatever the
                  marker is, and the rows read as a list rather than ragged text. */}
              <View style={styles.marker}>
                {done ? (
                  <Ionicons name="checkmark" size={12} color={colors.safe} />
                ) : (
                  <View style={[styles.dot, active ? styles.dotActive : styles.dotTodo]} />
                )}
              </View>
              {/* No numberOfLines: a long name is allowed to wrap. Cutting it off
                  is the whole reason this row exists. */}
              <Text
                style={[
                  styles.labelText,
                  active ? styles.labelActive : done ? styles.labelDone : styles.labelTodo,
                ]}
              >
                {JOURNEY_STEP[key].name}
              </Text>
              {active ? <Text style={styles.nowChip}>NOW</Text> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", marginTop: 10, marginBottom: 2 },

  track: { flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 5, borderRadius: 999 },
  segmentDone: { backgroundColor: colors.safe },
  segmentActive: { backgroundColor: colors.primary },
  segmentTodo: { backgroundColor: colors.border },

  labelList: { marginTop: 8, gap: 4 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  marker: { width: 14, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 999 },
  dotActive: { backgroundColor: colors.primary },
  dotTodo: { backgroundColor: colors.border },
  // 11px, matching web's phone layout - 9px was only ever a way to squeeze six
  // labels onto one line, and that line is gone.
  labelText: { flex: 1, fontSize: 11, lineHeight: 15 },
  labelActive: { color: colors.primary, fontWeight: "800" },
  labelDone: { color: colors.safe },
  labelTodo: { color: colors.mutedText },
  nowChip: { color: colors.primary, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
});

export default JourneyProgress;
