import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";

import { FormBanner } from "@/components/ui/FormBanner";
import { colors } from "@/theme/colors";
import { sharedStyles } from "@/features/bookings/bookingsStyles";
import { KeyboardModalCard } from "@/features/bookings/components/KeyboardModalCard";
import { REJECT_REASON_MIN } from "@/features/bookings/lib/modalValidation";

// ─────────────── Cancel post-possession modal (carrier mid-trip) ───────────────

interface CancelPostPossessionModalProps {
  /** Only a parcel the sender pre-declared as returnable can ever earn a cash
   *  waiver (`dispute-handler` re-checks `sender_pre_declared_eligible`), so
   *  asking the three questions otherwise is busywork. Web parity:
   *  `CancelPostPossessionDialog`'s `parcelIsReturnEligible`. */
  parcelIsReturnEligible: boolean;
  open: boolean;
  pending: boolean;
  /** Why the last attempt failed — shown inline; the modal stays open to retry. */
  error?: string | null;
  onCancel: () => void;
  onConfirm: (
    reason: string,
    answers?: { will_return: boolean; was_online_order: boolean; free_return_eligible: boolean },
  ) => void;
}

interface WaiverQuestion {
  key: "will_return" | "online_order" | "free_return_eligible";
  label: string;
}

// Web's questions, in web's order (27 Oct 2026): mobile asked about a merchant
// refund and stored the answer as will_return (whether YOU return the parcel).
const WAIVER_QUESTIONS: ReadonlyArray<WaiverQuestion> = [
  { key: "will_return", label: "Will you return the parcel to the sender?" },
  { key: "online_order", label: "Was this an online order shipped to your address?" },
  { key: "free_return_eligible", label: "Is the item eligible for free return / refund?" },
];

export function CancelPostPossessionModal({
  open,
  pending,
  parcelIsReturnEligible,
  error,
  onCancel,
  onConfirm,
}: Readonly<CancelPostPossessionModalProps>) {
  const [reason, setReason] = useState("");
  const [answers, setAnswers] = useState<Record<WaiverQuestion["key"], "yes" | "no" | null>>({
    will_return: null,
    online_order: null,
    free_return_eligible: null,
  });

  const handleClose = () => {
    if (pending) return;
    setReason("");
    setAnswers({
      will_return: null,
      online_order: null,
      free_return_eligible: null,
    });
    onCancel();
  };

  const trimmed = reason.trim();
  const reasonOk = trimmed.length >= REJECT_REASON_MIN;
  // Unanswerable-to-no-effect questions are not required: the waiver needs the
  // sender to have pre-declared the parcel returnable, which the backend
  // re-checks, so for anything else we skip straight to the reason.
  const allAnswered =
    !parcelIsReturnEligible || WAIVER_QUESTIONS.every((q) => answers[q.key] !== null);
  const allYes =
    parcelIsReturnEligible && WAIVER_QUESTIONS.every((q) => answers[q.key] === "yes");

  const handleConfirm = () => {
    if (!reasonOk || !allAnswered) return;
    onConfirm(
      trimmed,
      parcelIsReturnEligible
        ? {
            will_return: answers.will_return === "yes",
            was_online_order: answers.online_order === "yes",
            free_return_eligible: answers.free_return_eligible === "yes",
          }
        : undefined,
    );
  };

  return (
    <Modal statusBarTranslucent navigationBarTranslucent visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardModalCard onBackdropPress={handleClose}>
        <View style={sharedStyles.modalHeader}>
          <View style={sharedStyles.modalHeaderBubbleDanger}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
          </View>
          <Text style={sharedStyles.modalTitle}>Cancel this delivery?</Text>
          <Pressable onPress={handleClose} hitSlop={8} disabled={pending}>
            <Ionicons name="close" size={20} color={colors.mutedText} />
          </Pressable>
        </View>
        <Text style={sharedStyles.modalBody}>You've already accepted this parcel. Cancelling now:</Text>
        <Text style={sharedStyles.modalBody}>
          {"• Refunds the sender in full, if they have already paid\n" +
            "• Takes a cash penalty (5–25%, depending on how close you are to the deadline) from your next payout\n" +
            "• Adds a strike to your account\n" +
            "• The parcel goes back: the sender chooses where, and you send it"}
        </Text>

        <Text style={sharedStyles.modalFieldLabel}>Why are you cancelling? (required)</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Came down with food poisoning, can't travel anymore"
          placeholderTextColor={colors.mutedText}
          style={sharedStyles.modalInput}
          maxLength={1000}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!pending}
        />
        <Text style={sharedStyles.modalHelper}>
          {`${reason.length}/1000 — at least ${REJECT_REASON_MIN} characters`}
        </Text>

        {parcelIsReturnEligible ? (
        <Text style={[sharedStyles.modalFieldLabel, { marginTop: 12 }]}>
          Return-eligibility check
        </Text>
        ) : null}
        {parcelIsReturnEligible ? (
        <Text style={sharedStyles.modalHelper}>
          The sender flagged this parcel as a returnable online order. If you answer "yes" to
          all three, your cash penalty may be waived (the strike still applies):
        </Text>
        ) : null}
        {parcelIsReturnEligible ? (
        <View style={styles.waiverList}>
          {WAIVER_QUESTIONS.map((q) => {
            const current = answers[q.key];
            return (
              <View key={q.key} style={styles.waiverRow}>
                <Text style={styles.waiverLabel}>{q.label}</Text>
                <View style={styles.waiverChoices}>
                  {(["yes", "no"] as const).map((choice) => {
                    const selected = current === choice;
                    const isYes = choice === "yes";
                    return (
                      <Pressable
                        key={choice}
                        onPress={() =>
                          setAnswers((prev) => ({ ...prev, [q.key]: choice }))
                        }
                        disabled={pending}
                        style={[
                          styles.waiverChoice,
                          selected &&
                            (isYes ? styles.waiverChoiceYes : styles.waiverChoiceNo),
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[
                            styles.waiverChoiceText,
                            selected &&
                              (isYes
                                ? styles.waiverChoiceTextYes
                                : styles.waiverChoiceTextNo),
                          ]}
                        >
                          {isYes ? "Yes" : "No"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
        ) : null}

        {parcelIsReturnEligible && allAnswered ? (
          <View style={allYes ? styles.waiverHintGood : styles.waiverHintNeutral}>
            <Ionicons
              name={allYes ? "shield-checkmark" : "information-circle-outline"}
              size={14}
              color={allYes ? colors.safe : colors.mutedText}
            />
            <Text
              style={[
                styles.waiverHintText,
                allYes && { color: colors.safe },
              ]}
            >
              {allYes
                ? "A waiver request will be opened. If the sender agrees, the penalty is cancelled and won't be taken from your payouts. The strike still applies."
                : "A cash penalty will be taken from your next payout."}
            </Text>
          </View>
        ) : null}

        <FormBanner message={error} />

        <View style={sharedStyles.modalFooter}>
          <Pressable
            onPress={handleClose}
            disabled={pending}
            style={[sharedStyles.modalButton, sharedStyles.modalButtonSecondary]}
            accessibilityRole="button"
            accessibilityLabel="Don't cancel"
          >
            <Text style={sharedStyles.modalButtonSecondaryText}>Don't cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={pending || !reasonOk || !allAnswered}
            style={[
              sharedStyles.modalButton,
              sharedStyles.modalButtonDanger,
              (pending || !reasonOk || !allAnswered) && sharedStyles.modalButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cancel delivery"
          >
            {pending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={sharedStyles.modalButtonDangerText}>Cancel delivery</Text>
            )}
          </Pressable>
        </View>
      </KeyboardModalCard>
    </Modal>
  );
}

const styles = StyleSheet.create({
  waiverList: { gap: 10 },
  waiverRow: { gap: 6 },
  waiverLabel: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  waiverChoices: { flexDirection: "row", gap: 8 },
  waiverChoice: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: "transparent",
  },
  waiverChoiceYes: {
    backgroundColor: "rgba(34,195,93,0.10)",
    borderColor: "rgba(34,195,93,0.35)",
  },
  waiverChoiceNo: {
    backgroundColor: "rgba(220,40,40,0.08)",
    borderColor: "rgba(220,40,40,0.32)",
  },
  waiverChoiceText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  waiverChoiceTextYes: { color: colors.safe },
  waiverChoiceTextNo: { color: colors.danger },
  waiverHintGood: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34,195,93,0.08)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  waiverHintNeutral: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  waiverHintText: { color: colors.mutedText, fontSize: 12, fontWeight: "600", flex: 1 },
});
