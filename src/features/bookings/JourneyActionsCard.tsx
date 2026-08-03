import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import type { Booking, JourneyDelayReason } from "@/services/api";
import { colors } from "@/theme/colors";

/**
 * Stages 8, 9 and 10 - the carrier's own milestones once the money is secured
 * and the parcel is in their luggage: confirm ready, start the journey, mark
 * that they have landed. Plus Report Delay, which is deliberately separate from
 * cancelling: the spec calls out "flight delayed (reschedule instead of return
 * workflow)", so a slipped trip reschedules and the parcel stays where it is.
 *
 * Every button here is advisory in the same sense the handoff sub-steps are -
 * skipping the checklist never blocks departure - so the card always offers the
 * NEXT real action rather than gating on the previous one.
 *
 * Web parity: `src/customer/components/JourneyActions.tsx`.
 */
export interface JourneyActionsCardProps {
  booking: Booking;
  pending: "confirm-ready" | "start-journey" | "mark-landed" | "report-delay" | null;
  onConfirmReady: () => void;
  onStartJourney: () => void;
  onMarkLanded: () => void;
  onReportDelay: (args: { reason: JourneyDelayReason; note?: string; new_travel_date?: string }) => void;
}

/** The five reasons a journey slips, in the order the spec lists them. */
const DELAY_REASONS: { value: JourneyDelayReason; label: string; hint: string }[] = [
  { value: "flight_delayed", label: "Flight delayed", hint: "Same trip, later than planned." },
  { value: "missed_flight", label: "Missed flight", hint: "You'll rebook and travel later." },
  { value: "trip_postponed", label: "Trip postponed", hint: "Moved to a different date." },
  { value: "cancelled", label: "Flight cancelled", hint: "The airline cancelled the flight." },
  { value: "emergency", label: "Emergency", hint: "Something urgent came up." },
];

export function JourneyActionsCard({
  booking,
  pending,
  onConfirmReady,
  onStartJourney,
  onMarkLanded,
  onReportDelay,
}: Readonly<JourneyActionsCardProps>) {
  const [delayOpen, setDelayOpen] = useState(false);
  const [reason, setReason] = useState<JourneyDelayReason>("flight_delayed");
  const [note, setNote] = useState("");
  const [newDate, setNewDate] = useState("");

  const isReady = Boolean(booking.ready_to_travel_at);
  const preFlight = booking.status === "payment_secured";
  const inFlight = booking.status === "in_transit";
  const landed = Boolean(booking.ready_for_delivery_at);

  // Nothing to drive: either the money isn't secured yet, or the parcel has
  // already been handed over at the far end.
  if (!preFlight && !inFlight) return null;
  if (inFlight && landed) return null;

  const busy = pending !== null;
  const dateValid = !newDate || /^\d{4}-\d{2}-\d{2}$/.test(newDate);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons
          name={preFlight ? "briefcase-outline" : "airplane-outline"}
          size={14}
          color={colors.primary}
        />
        <Text style={styles.stepLabel}>
          {preFlight ? "STEP 2 OF 5 · TRAVEL READY" : "STEP 3 OF 5 · IN TRANSIT"}
        </Text>
      </View>

      {booking.delay_reason ? (
        <View style={styles.delayNotice}>
          <Ionicons name="warning-outline" size={13} color={colors.warning} />
          <Text style={styles.delayNoticeText}>
            You reported a delay
            {booking.agreed_travel_date ? ` - now travelling ${booking.agreed_travel_date}` : ""}.
            {booking.delay_note ? ` "${booking.delay_note}"` : ""}
          </Text>
        </View>
      ) : null}

      {preFlight ? (
        <>
          <Text style={styles.title}>
            {isReady ? "You're ready - start the journey when you set off" : "Confirm you're ready to travel"}
          </Text>
          <Text style={styles.body}>
            {isReady
              ? "Your sender knows you're packed and travelling. Tap start when you actually set off so they can follow along."
              : "Payment is secured and you have the parcel. Confirm it's packed, your documents are ready, and you're still travelling as planned."}
          </Text>
          {!isReady ? (
            <Pressable
              style={[styles.primaryButton, busy && styles.disabled]}
              onPress={onConfirmReady}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Yes, I'm ready to travel"
            >
              {pending === "confirm-ready" ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={14} color={colors.white} />
                  <Text style={styles.primaryButtonText}>Yes, I'm ready</Text>
                </>
              )}
            </Pressable>
          ) : null}
          <Pressable
            style={[isReady ? styles.primaryButton : styles.secondaryButton, busy && styles.disabled]}
            onPress={onStartJourney}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Start the journey"
          >
            {pending === "start-journey" ? (
              <ActivityIndicator size="small" color={isReady ? colors.white : colors.text} />
            ) : (
              <>
                <Ionicons name="airplane" size={14} color={isReady ? colors.white : colors.text} />
                <Text style={isReady ? styles.primaryButtonText : styles.secondaryButtonText}>
                  Start the journey
                </Text>
              </>
            )}
          </Pressable>
        </>
      ) : null}

      {inFlight ? (
        <>
          <Text style={styles.title}>You're on your way</Text>
          <Text style={styles.body}>
            Mark that you've landed when you arrive
            {booking.parcel?.to_city ? ` in ${booking.parcel.to_city}` : ""} - that's the receiver's
            cue to coordinate pickup and get their delivery code.
          </Text>
          <Pressable
            style={[styles.primaryButton, busy && styles.disabled]}
            onPress={onMarkLanded}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="I've landed"
          >
            {pending === "mark-landed" ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="location" size={14} color={colors.white} />
                <Text style={styles.primaryButtonText}>I've landed</Text>
              </>
            )}
          </Pressable>
        </>
      ) : null}

      {/* Report Delay - framed as the alternative to cancelling, because a
          delayed carrier reaching for "Cancel" is how a parcel ends up going
          home for no reason. */}
      {!delayOpen ? (
        <Pressable
          style={styles.linkButton}
          onPress={() => setDelayOpen(true)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Report a delay"
        >
          <Ionicons name="warning-outline" size={12} color={colors.warning} />
          <Text style={styles.linkButtonText}>Something's changed - report a delay</Text>
        </Pressable>
      ) : (
        <View style={styles.delayForm}>
          <View style={styles.delayFormHeader}>
            <Text style={styles.delayFormTitle}>What happened?</Text>
            <Pressable
              onPress={() => setDelayOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close delay form"
            >
              <Ionicons name="close" size={16} color={colors.mutedText} />
            </Pressable>
          </View>
          <Text style={styles.delayFormHint}>
            This reschedules the trip - you keep the parcel and nothing is refunded. To end the
            delivery instead, use Cancel delivery.
          </Text>

          <View style={styles.optionList}>
            {DELAY_REASONS.map((r) => {
              const active = reason === r.value;
              return (
                <Pressable
                  key={r.value}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => setReason(r.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={r.label}
                >
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={15}
                    color={active ? colors.warning : colors.mutedText}
                  />
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>{r.label}</Text>
                    <Text style={styles.optionHint}>{r.hint}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <AppInput
            label="New travel date (optional)"
            placeholder="YYYY-MM-DD"
            value={newDate}
            onChangeText={setNewDate}
            autoCapitalize="none"
            error={dateValid ? undefined : "Use the format YYYY-MM-DD"}
          />
          <AppInput
            label="Anything your sender should know (optional)"
            placeholder="Add a short note"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
          />

          <Pressable
            style={[styles.primaryButton, (busy || !dateValid) && styles.disabled]}
            onPress={() => {
              if (!dateValid) return;
              onReportDelay({
                reason,
                note: note.trim() || undefined,
                new_travel_date: newDate || undefined,
              });
              setDelayOpen(false);
              setNote("");
              setNewDate("");
            }}
            disabled={busy || !dateValid}
            accessibilityRole="button"
            accessibilityLabel="Report delay"
          >
            {pending === "report-delay" ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="warning" size={14} color={colors.white} />
                <Text style={styles.primaryButtonText}>Report delay</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.30)",
    backgroundColor: "rgba(37,99,235,0.05)",
    borderRadius: 14,
    padding: 12,
    gap: 6,
    width: "100%",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  title: { color: colors.text, fontSize: 13, fontWeight: "800" },
  body: { color: colors.mutedText, fontSize: 11, lineHeight: 16, fontWeight: "500" },

  delayNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(245,159,10,0.40)",
    backgroundColor: "rgba(245,159,10,0.08)",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  delayNoticeText: { flex: 1, color: colors.mutedText, fontSize: 11, lineHeight: 15, fontWeight: "500" },

  linkButton: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingVertical: 4 },
  linkButtonText: { color: colors.warning, fontSize: 11, fontWeight: "700" },

  delayForm: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 10,
    gap: 6,
    marginTop: 4,
  },
  delayFormHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  delayFormTitle: { color: colors.text, fontSize: 12, fontWeight: "800" },
  delayFormHint: { color: colors.mutedText, fontSize: 11, lineHeight: 15, fontWeight: "500" },

  optionList: { gap: 6, marginTop: 2 },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optionActive: { borderColor: colors.warning, backgroundColor: "rgba(245,159,10,0.14)" },
  optionTextWrap: { flex: 1, gap: 1 },
  optionTitle: { color: colors.text, fontSize: 12, fontWeight: "800" },
  optionHint: { color: colors.mutedText, fontSize: 11, lineHeight: 15, fontWeight: "500" },

  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: colors.ctaAccent,
    marginTop: 6,
  },
  primaryButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginTop: 6,
  },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.5 },
});

export default JourneyActionsCard;
