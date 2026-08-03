import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { showToast } from "@/feedback/appFeedback";
import { ApiClientError, getErrorMessage, tripsApi, type Trip } from "@/services/api";
import { colors } from "@/theme/colors";

/** Why the trip locked, in the carrier's words. `carrier` is the only reason
 *  they can undo directly - the rest describe a condition, not a choice. */
const LOCK_REASON_TEXT: Record<string, string> = {
  carrier: "You closed this trip to new matches.",
  capacity_full: "No capacity left - every kilo is spoken for.",
  date_passed: "This trip has already departed.",
  trip_cancelled: "This trip was cancelled.",
};

export interface TripAvailabilityToggleProps {
  trip: Trip & { luggage_capacity?: number };
  /** Refetch the list so the pill and capacity meter reflect the new state. */
  onChanged?: () => void;
}

/**
 * Trip Availability (carrier controlled) - a simple toggle, plus the three
 * automatic locks.
 *
 * What locking does: the trip disappears from search, is excluded from
 * auto-match, and no new senders can start a chat about it. What it explicitly
 * does NOT do: touch deliveries already under way. Carriers lock trips for all
 * sorts of legitimate reasons besides running out of weight - only carrying for
 * friends, luggage full of their own things, keeping the logistics simple - so
 * the control is theirs and reopening is one tap away.
 *
 * Web parity: `src/customer/components/TripAvailabilityToggle.tsx`.
 */
export function TripAvailabilityToggle({ trip, onChanged }: Readonly<TripAvailabilityToggleProps>) {
  const [busy, setBusy] = useState(false);

  const locked = Boolean(trip.is_locked ?? trip.locked_at);
  const reason = trip.lock_reason ?? null;
  // Only a carrier-chosen lock is reversible from here. An automatic one needs
  // the underlying condition to change first, and the API refuses otherwise - so
  // we don't offer a button that would only produce an error.
  const canReopen = locked && (reason === "carrier" || reason == null);

  const capacity = trip.luggage_capacity_kg ?? trip.luggage_capacity ?? null;
  const remaining = trip.remaining_capacity_kg;
  const used = trip.used_capacity_kg;
  const pct =
    capacity != null && used != null && Number(capacity) > 0
      ? Math.min(100, Math.round((Number(used) / Number(capacity)) * 100))
      : null;

  const toggle = async () => {
    if (busy) return;
    if (locked && !canReopen) return;
    setBusy(true);
    try {
      if (locked) await tripsApi.unlock(trip.id);
      else await tripsApi.lock(trip.id);
      showToast({
        variant: "success",
        title: locked ? "Trip reopened for matches" : "Trip locked",
        message: locked ? undefined : "No new senders can match with it.",
      });
      onChanged?.();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : getErrorMessage(err as Error);
      showToast({ variant: "error", title: "Couldn't update the trip", message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.statusWrap}>
          <Ionicons
            name={locked ? "lock-closed-outline" : "lock-open-outline"}
            size={13}
            color={locked ? colors.mutedText : colors.safe}
          />
          <Text style={[styles.statusText, locked ? styles.statusLocked : styles.statusOpen]}>
            {locked ? "Trip locked" : "Open for matches"}
          </Text>
        </View>
        <Pressable
          style={[styles.button, locked ? styles.buttonPrimary : styles.buttonMuted, (busy || (locked && !canReopen)) && styles.disabled]}
          onPress={() => void toggle()}
          disabled={busy || (locked && !canReopen)}
          accessibilityRole="button"
          accessibilityLabel={locked ? "Reopen trip for matches" : "Lock trip"}
        >
          {busy ? (
            <ActivityIndicator size="small" color={locked ? colors.white : colors.text} />
          ) : (
            <Text style={locked ? styles.buttonPrimaryText : styles.buttonMutedText}>
              {locked ? "Reopen" : "Lock trip"}
            </Text>
          )}
        </Pressable>
      </View>

      {capacity != null ? (
        <View style={styles.capacityWrap}>
          <View style={styles.capacityLabels}>
            <Text style={styles.capacityLabel}>Capacity</Text>
            <Text style={styles.capacityValue}>
              {remaining != null ? `${remaining}kg remaining` : `${capacity}kg total`}
            </Text>
          </View>
          {pct != null ? (
            <View style={styles.meterTrack}>
              <View
                style={[
                  styles.meterFill,
                  { width: `${pct}%` },
                  pct >= 100 && styles.meterFull,
                ]}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.hint}>
        {locked
          ? `${reason ? `${LOCK_REASON_TEXT[reason] ?? ""} ` : ""}It won't appear in search or auto-match and no new senders can start a chat. Deliveries already under way are unaffected.`
          : "Senders can find this trip in search. Lock it any time you don't want more parcels - you'll still complete the deliveries you've already taken on."}
      </Text>
      {locked && !canReopen ? (
        <Text style={styles.hintStrong}>This lock is automatic, so it can't be undone here.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 10,
    gap: 6,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statusWrap: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  statusText: { fontSize: 12, fontWeight: "800" },
  statusOpen: { color: colors.safe },
  statusLocked: { color: colors.mutedText },
  button: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: colors.ctaAccent },
  buttonPrimaryText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  buttonMuted: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  buttonMutedText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.5 },

  capacityWrap: { gap: 4 },
  capacityLabels: { flexDirection: "row", justifyContent: "space-between" },
  capacityLabel: { color: colors.mutedText, fontSize: 11, fontWeight: "600" },
  capacityValue: { color: colors.mutedText, fontSize: 11, fontWeight: "700" },
  meterTrack: { height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" },
  meterFill: { height: 5, borderRadius: 3, backgroundColor: colors.primary },
  meterFull: { backgroundColor: colors.danger },

  hint: { color: colors.mutedText, fontSize: 11, lineHeight: 15, fontWeight: "500" },
  hintStrong: { color: colors.mutedText, fontSize: 11, fontWeight: "700" },
});

export default TripAvailabilityToggle;
