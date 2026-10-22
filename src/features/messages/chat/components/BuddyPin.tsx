import { Ionicons } from "@expo/vector-icons";
import { memo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { MatchConfirmationModal } from "@/components/chat/MatchConfirmationModal";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { showToast } from "@/feedback/appFeedback";
import { getErrorMessage, messagesApi } from "@/services/api";
import { colors } from "@/theme/colors";
import { buddyActionToast, buddyPinView, type BuddyEntry, type BuddyPinAction } from "@/utils/buddyEntry";

interface Props {
  conversationId: string;
  buddy: BuddyEntry;
  counterpartName: string;
  /** Re-read the chat (active-deal + messages) after an action. */
  onChanged: () => void;
}

/**
 * The travel-buddy entry's pin in a SHARED chat (22 Oct 2026) — shown instead of
 * the parcel workflow pin while the buddy entry is selected. One sentence, at
 * most one primary button. Request and Accept go through the same buddy
 * confirmation sheet as a buddy-chat Match, so there is no extra step; Decline
 * answers straight away. Words come from `utils/buddyEntry.ts` (same as web).
 */
function BuddyPinBase({ conversationId, buddy, counterpartName, onChanged }: Props) {
  const view = buddyPinView(buddy, counterpartName);
  const [confirming, setConfirming] = useState<"request" | "accept" | null>(null);
  const [pending, setPending] = useState<BuddyPinAction | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const run = async (action: BuddyPinAction) => {
    setPending(action);
    setModalError(null);
    try {
      if (action === "request") await messagesApi.requestBuddy(conversationId, buddy.listing_id);
      else if (buddy.request) {
        if (action === "accept") await messagesApi.acceptBuddy(conversationId, buddy.request.id);
        else await messagesApi.declineBuddy(conversationId, buddy.request.id);
      }
      setConfirming(null);
      showToast({ title: buddyActionToast(action, counterpartName), variant: "success", duration: 2200 });
      onChanged();
    } catch (err) {
      const message = getErrorMessage(err, "Something went wrong. Please try again.");
      // Inside the sheet a toast would be drawn underneath it, so say it there.
      if (action === "decline") showToast({ title: message, variant: "error" });
      else setModalError(message);
      // The other side may have answered meanwhile — show where things stand now.
      onChanged();
    } finally {
      setPending(null);
    }
  };

  const busy = pending !== null;

  return (
    <View style={styles.wrap} accessibilityLabel="Travel buddy">
      <Ionicons name="people-outline" size={18} color={colors.primary} />
      <Text style={styles.text}>{view.text}</Text>
      {view.primary || view.secondary ? (
        <View style={styles.actions}>
          {view.secondary ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={view.secondary.label}
              disabled={busy}
              onPress={() => void run("decline")}
              style={[styles.button, styles.buttonOutline, busy ? styles.disabled : null]}
            >
              {pending === "decline" ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={styles.buttonOutlineText}>{view.secondary.label}</Text>
              )}
            </Pressable>
          ) : null}
          {view.primary ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={view.primary.label}
              disabled={busy}
              onPress={() => { setModalError(null); setConfirming(view.primary!.action); }}
              style={[styles.button, styles.buttonPrimary, busy ? styles.disabled : null]}
            >
              <Text style={styles.buttonPrimaryText}>{view.primary.label}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <MatchConfirmationModal
        open={confirming !== null}
        pending={pending === "request" || pending === "accept"}
        contextType="buddy"
        error={modalError}
        onCancel={() => { if (!busy) setConfirming(null); }}
        onConfirm={() => { if (confirming) void run(confirming); }}
      />
    </View>
  );
}

export const BuddyPin = memo(BuddyPinBase);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  text: { flex: 1, minWidth: 160, color: colors.text, fontSize: 13, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 6 },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, minHeight: 34, justifyContent: "center" },
  buttonPrimary: { backgroundColor: colors.ctaAccent },
  buttonPrimaryText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  buttonOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  buttonOutlineText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
