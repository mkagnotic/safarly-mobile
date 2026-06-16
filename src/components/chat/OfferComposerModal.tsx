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

export interface OfferComposerSubmit {
  amount: number;
  note?: string;
}

interface OfferComposerModalProps {
  open: boolean;
  /** "seed" for the first offer, "counter" to beat the current open offer. */
  mode: "seed" | "counter";
  pending: boolean;
  /** Pre-fill for a counter — the amount you're responding to. */
  currentAmount?: number | null;
  currencySymbol?: string;
  onCancel: () => void;
  onSubmit: (input: OfferComposerSubmit) => void;
}

/**
 * Collects the price (and an optional note) for an in-chat offer. Currency is
 * resolved server-side from the parcel listing, so we only capture the amount.
 */
export function OfferComposerModal({
  open,
  mode,
  pending,
  currentAmount,
  currencySymbol = "$",
  onCancel,
  onSubmit,
}: Readonly<OfferComposerModalProps>) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) {
      setAmount("");
      setNote("");
    }
  }, [open]);

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  const title = mode === "seed" ? "Make an offer" : "Counter offer";
  const body =
    mode === "seed"
      ? "Propose a delivery price. They can accept, counter, or decline."
      : currentAmount != null
        ? `Current offer is ${currencySymbol}${currentAmount.toFixed(2)}. Send your counter.`
        : "Send your counter price.";

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
                <Ionicons name="pricetag" size={20} color={colors.primary} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.body}>{body}</Text>
              </View>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.currency}>{currencySymbol}</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.subtleText}
                style={styles.amountInput}
                keyboardType="decimal-pad"
                editable={!pending}
                autoFocus
              />
            </View>

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (optional)"
              placeholderTextColor={colors.subtleText}
              style={styles.noteInput}
              editable={!pending}
              multiline
              maxLength={280}
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
                onPress={() => onSubmit({ amount: parsed, note: note.trim() || undefined })}
                disabled={pending || !valid}
                style={[
                  styles.button,
                  styles.confirmButton,
                  (pending || !valid) && styles.buttonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={mode === "seed" ? "Send offer" : "Send counter"}
              >
                {pending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.confirmText}>
                    {mode === "seed" ? "Send offer" : "Send counter"}
                  </Text>
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.4)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: 18,
    gap: 14,
  },
  headerRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(163, 136, 250, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 16, fontWeight: "800" },
  body: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  currency: { color: colors.text, fontSize: 22, fontWeight: "800" },
  amountInput: { flex: 1, color: colors.text, fontSize: 22, fontWeight: "800", padding: 0 },
  noteInput: {
    minHeight: 60,
    maxHeight: 120,
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
    minWidth: 110,
  },
  cancelButton: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  confirmButton: { backgroundColor: colors.primary },
  confirmText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  buttonDisabled: { opacity: 0.5 },
});
