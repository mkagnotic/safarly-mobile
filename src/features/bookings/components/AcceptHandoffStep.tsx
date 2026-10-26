import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";

import { journeyStepShort } from "@/utils/journeySteps";
import type { Booking } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { sharedStyles } from "@/features/bookings/bookingsStyles";
import type { ExpandedBookingState } from "@/features/bookings/hooks/useExpandedBooking";

interface AcceptHandoffStepProps {
  booking: Booking;
  originCity: string | null;
  isOnlineOrder: boolean;
  actionPending: ExpandedBookingState["actionPending"];
  setAcceptHandoffOpen: ExpandedBookingState["setAcceptHandoffOpen"];
  canRejectHandoff: boolean;
  setRejectHandoffOpen: ExpandedBookingState["setRejectHandoffOpen"];
  rejectHandoffLabel: string;
  handoffDispatched: boolean;
  returnEligible: boolean;
}

/** Phase 1 (handoff) card for the carrier: agree, inspect, then accept or decline. */
export function AcceptHandoffStep({
  booking,
  originCity,
  isOnlineOrder,
  actionPending,
  setAcceptHandoffOpen,
  canRejectHandoff,
  setRejectHandoffOpen,
  rejectHandoffLabel,
  handoffDispatched,
  returnEligible,
}: Readonly<AcceptHandoffStepProps>) {
  return (
    <View style={styles.stepCardPrimary}>
      <View style={sharedStyles.stepCardHeader}>
        <Ionicons name="home-outline" size={14} color={colors.primary} />
        <Text style={styles.stepCardEyebrowPrimary}>{journeyStepShort("handoff")}</Text>
      </View>
      <Text style={sharedStyles.stepCardTitle}>
        {booking.sender?.name
          ? `Get the parcel from ${booking.sender.name} into your hands`
          : "Get the parcel into your hands"}
      </Text>
      <Text style={sharedStyles.stepCardBody}>
        You are receiving the parcel at this step, before you travel. Accepting it
        asks your sender to pay within 48 hours; their money is then held in escrow
        until you deliver it.
      </Text>

      <View style={styles.stepCardNote}>
        <Text style={styles.stepCardNoteStrong}>First, agree the details in chat</Text>
        <Text style={styles.stepCardNoteText}>
          • Couriered to you — share your local address
          {originCity ? ` in ${originCity}` : ""} and the sender ships it there
          {isOnlineOrder ? " (the usual route for an online order)" : ""}.
        </Text>
        <Text style={styles.stepCardNoteText}>
          • In person — agree a meetup{originCity ? ` in ${originCity}` : ""} and
          collect it yourself.
        </Text>
      </View>

      <View style={styles.stepCardNote}>
        <Text style={styles.stepCardNoteStrong}>Then inspect it before you accept</Text>
        <Text style={styles.stepCardNoteText}>
          • Contents match the listing and the parcel photos you approved.
        </Text>
        <Text style={styles.stepCardNoteText}>
          • Nothing restricted or prohibited; packed and sealed safely.
        </Text>
        <Text style={styles.stepCardNoteText}>
          • Size and weight are what you agreed and fit your baggage allowance.
        </Text>
      </View>

      <Text style={sharedStyles.stepCardFootnote}>
        No code at this step. Accepting starts the 48-hour payment window; the
        6-digit code belongs to the final Delivery step, from the receiver.
      </Text>

      {/* Nothing to inspect until the sender marks it sent / handed over
          (client, 26 Oct 2026); the server refuses an earlier accept too. Web parity. */}
      {!handoffDispatched ? (
        <Text style={styles.waitingNote} testID="handoff-accept-waiting">
          Waiting for your sender to mark the parcel as sent (or handed over, if you're meeting). You can inspect and accept it after that.
        </Text>
      ) : null}
      <Pressable
        style={[
          sharedStyles.actionButton,
          sharedStyles.actionPrimary,
          sharedStyles.fullWidthAction,
          styles.stepCardCta,
          !handoffDispatched && styles.ctaDisabled,
        ]}
        onPress={() => setAcceptHandoffOpen(true)}
        disabled={actionPending !== null || !handoffDispatched}
        accessibilityRole="button"
        accessibilityLabel="I have it and inspected it, accept the parcel"
        accessibilityState={{ disabled: actionPending !== null || !handoffDispatched }}
        testID="handoff-accept"
      >
        {actionPending === "accept-handoff" ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={14} color={colors.white} />
            <Text style={sharedStyles.actionPrimaryText}>I have it and inspected it — accept</Text>
          </>
        )}
      </Pressable>
      {canRejectHandoff ? (
        <Pressable
          style={[sharedStyles.actionButton, sharedStyles.actionDanger, sharedStyles.fullWidthAction, styles.stepCardCta]}
          onPress={() => setRejectHandoffOpen(true)}
          disabled={actionPending !== null}
          accessibilityRole="button"
          accessibilityLabel={rejectHandoffLabel}
        >
          <Ionicons name="close-circle" size={14} color={colors.danger} />
          <Text style={sharedStyles.actionDangerText}>{rejectHandoffLabel}</Text>
        </Pressable>
      ) : null}
      <Text style={sharedStyles.stepCardFootnote}>
        {handoffDispatched
          ? "Declining ends the delivery with no penalty to you, and your sender won't be charged. "
          : "This is how you cancel at this step - no penalty to you, and your sender won't be charged. "}
        {returnEligible
          ? "This order can go back to the seller — the sender arranges the return."
          : "The sender then arranges collection of the parcel from you."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Two-step delivery cards (pickup / drop-off). Each names the step so the
  // physical action and the delivery code can't be mistaken for each other.
  stepCardPrimary: {
    width: "100%",
    backgroundColor: primaryTint.fill08,
    borderWidth: 1,
    borderColor: primaryTint.stroke20,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  stepCardEyebrowPrimary: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  stepCardNote: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 2,
  },
  stepCardNoteText: { color: colors.mutedText, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  stepCardNoteStrong: { color: colors.text, fontWeight: "800" },
  stepCardCta: { marginTop: 4 },
  ctaDisabled: { opacity: 0.45 },
  waitingNote: {
    marginTop: 4,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.primary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
});
