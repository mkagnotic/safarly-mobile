import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

export type ConfirmActionTone = "destructive" | "primary";

interface ConfirmActionModalProps {
  open: boolean;
  /** Sheet title — e.g. "Unmatch?" or "Block Anita Desai?". */
  title: string;
  /** Single-paragraph body explaining the consequence. */
  body: string;
  /** Confirm button label. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** `destructive` (red) for block/unmatch; `primary` for benign confirms. */
  tone?: ConfirmActionTone;
  /** Optional Ionicons glyph for the header bubble. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Disables both buttons + spins the confirm button while a request is in flight. */
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Reusable destructive-confirmation sheet — same visual treatment as
 * `DeclineMatchModal` / `ReportMessageModal` so block + unmatch don't fall
 * back to the system Alert. Mirrors web's shared confirm Dialog in
 * `ChatActionDropdown.tsx:211-235`.
 */
export function ConfirmActionModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "destructive",
  icon,
  pending,
  onCancel,
  onConfirm,
}: Readonly<ConfirmActionModalProps>) {
  const isDestructive = tone === "destructive";
  const accent = isDestructive ? colors.danger : colors.primary;
  const bubbleBg = isDestructive ? "rgba(220, 40, 40, 0.10)" : colors.surfaceTintPrimary;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!pending) onCancel();
      }}
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
            {icon ? (
              <View style={[styles.iconBubble, { backgroundColor: bubbleBg }]}>
                <Ionicons name={icon} size={20} color={accent} />
              </View>
            ) : null}
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              <Text style={styles.body}>{body}</Text>
            </View>
            {/* Explicit dismiss. The backdrop already closes the sheet, but that
                affordance is invisible — a confirm dialog needs a visible way
                out, especially for destructive actions. Disabled mid-request so
                it can't be closed while the mutation is in flight. */}
            <Pressable
              onPress={onCancel}
              disabled={pending}
              hitSlop={10}
              style={[styles.closeButton, pending && styles.buttonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={colors.mutedText} />
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={onCancel}
              disabled={pending}
              style={[styles.button, styles.cancelButton]}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={pending}
              style={[
                styles.button,
                { backgroundColor: accent },
                pending && styles.buttonDisabled,
              ]}
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
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    gap: 16,
  },
  headerRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 4 },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: "800" },
  body: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
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
  confirmText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 },
});
