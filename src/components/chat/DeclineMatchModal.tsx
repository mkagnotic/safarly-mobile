import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

interface DeclineMatchModalProps {
  open: boolean;
  participantName: string;
  pending: boolean;
  /**
   * `true` when the OTHER side requested the match — web phrases this case as
   * "Close Match Request" since you're closing their request, not declining
   * one you sent. Defaults to `false` (regular "Decline match" wording).
   */
  matchRequestFromOther?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Mirrors web's `Decline Match` dialog (`ChatActionDropdown.tsx:248-279`):
 * a small confirmation surface with an optional reason that flows into
 * `messagesApi.declineConversation(id, reason)`.
 */
export function DeclineMatchModal({
  open,
  participantName,
  pending,
  matchRequestFromOther = false,
  onCancel,
  onConfirm,
}: Readonly<DeclineMatchModalProps>) {
  const [reason, setReason] = useState("");
  const title = matchRequestFromOther
    ? `Close ${participantName}'s match request?`
    : `Decline match with ${participantName}?`;
  const body = matchRequestFromOther
    ? "They'll see the request was closed. You can re-open later from the inbox."
    : "You can optionally tell them why — or leave it blank.";
  const confirmLabel = matchRequestFromOther ? "Close" : "Decline";

  // Reset the input when the modal closes so reopening doesn't carry text over.
  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!pending) onCancel();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!pending) onCancel();
          }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View style={styles.center} pointerEvents="box-none">
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.iconBubble}>
                <Ionicons name="close-circle" size={20} color={colors.danger} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title} numberOfLines={2}>
                  {title}
                </Text>
                <Text style={styles.body}>{body}</Text>
              </View>
            </View>

            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.subtleText}
              style={styles.input}
              editable={!pending}
              multiline
              // Match web — no client-side cap on the decline reason; the
              // server's `decline_reason` column is unbounded TEXT.
            />

            <View style={styles.footer}>
              <Pressable
                onPress={onCancel}
                disabled={pending}
                style={[styles.button, styles.cancelButton]}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => onConfirm(reason.trim())}
                disabled={pending}
                style={[styles.button, styles.confirmButton, pending && styles.buttonDisabled]}
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
              >
                {pending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.confirmText}>{confirmLabel}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,25,0.4)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: 18,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(220, 40, 40, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 16, fontWeight: "800" },
  body: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  input: {
    minHeight: 80,
    maxHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: "top",
  },
  footer: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 96,
  },
  cancelButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  confirmButton: { backgroundColor: colors.danger },
  confirmText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 },
});
