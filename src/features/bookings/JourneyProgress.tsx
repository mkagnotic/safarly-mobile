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
          visible as part of the journey. */}
      <View style={styles.labelRow}>
        {JOURNEY_STEP_ORDER.map((key, i) => {
          const done = isDone || i < currentIdx;
          const active = !isDone && i === currentIdx;
          return (
            <View key={key} style={styles.labelCell}>
              {done ? <Ionicons name="checkmark" size={9} color={colors.safe} /> : null}
              <Text
                numberOfLines={1}
                style={[
                  styles.labelText,
                  active ? styles.labelActive : done ? styles.labelDone : styles.labelTodo,
                ]}
              >
                {JOURNEY_STEP[key].name}
              </Text>
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

  labelRow: { flexDirection: "row", gap: 4, marginTop: 5 },
  labelCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: 2, minWidth: 0 },
  labelText: { fontSize: 9, lineHeight: 12, flexShrink: 1 },
  labelActive: { color: colors.primary, fontWeight: "800" },
  labelDone: { color: colors.safe },
  labelTodo: { color: colors.mutedText },
});

export default JourneyProgress;
