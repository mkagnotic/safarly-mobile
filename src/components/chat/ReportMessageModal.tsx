import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

interface ReportReason {
  value: string;
  label: string;
  helper: string;
}

/** Web parity (`ChatActionDropdown.tsx:120-126`). */
const REASONS: readonly ReportReason[] = [
  {
    value: "spam",
    label: "Spam or scam",
    helper: "Unsolicited ads, phishing, or scam attempts.",
  },
  {
    value: "harassment",
    label: "Harassment or abuse",
    helper: "Threats, bullying, or personal attacks.",
  },
  { value: "fraud", label: "Fraud", helper: "Misrepresenting identity, parcel, or intent." },
  {
    value: "inappropriate",
    label: "Inappropriate content",
    helper: "Explicit, offensive, or unsafe material.",
  },
  { value: "other", label: "Other", helper: "Something else — please describe below." },
];

const MAX_DETAILS = 500;

interface ReportMessageModalProps {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: { reason: string; details: string | undefined }) => void;
}

/**
 * Mirrors web's `Report User` dialog (`ChatActionDropdown.tsx:282-363`):
 * radio-style reason picker + optional details textarea (required when
 * "other" is selected). Resets between opens.
 */
export function ReportMessageModal({
  open,
  pending,
  onCancel,
  onSubmit,
}: Readonly<ReportMessageModalProps>) {
  const [reason, setReason] = useState<string>("spam");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("spam");
      setDetails("");
    }
  }, [open]);

  const submitDisabled =
    pending || (reason === "other" && details.trim().length === 0);

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
                <Ionicons name="flag" size={18} color={colors.danger} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>Report message</Text>
                <Text style={styles.body}>
                  Help us keep Safarly safe. Our trust &amp; safety team reviews every report.
                </Text>
              </View>
            </View>

            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.bodyScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {REASONS.map((r) => {
                const selected = r.value === reason;
                return (
                  <Pressable
                    key={r.value}
                    onPress={() => setReason(r.value)}
                    disabled={pending}
                    style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={r.label}
                  >
                    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <View style={styles.reasonText}>
                      <Text style={styles.reasonLabel}>{r.label}</Text>
                      <Text style={styles.reasonHelper}>{r.helper}</Text>
                    </View>
                  </Pressable>
                );
              })}

              <Text style={styles.detailsLabel}>
                Additional details
                {reason !== "other" ? " (optional)" : ""}
              </Text>
              <TextInput
                value={details}
                onChangeText={(v) => setDetails(v.slice(0, MAX_DETAILS))}
                placeholder="Share any context that will help our team investigate…"
                placeholderTextColor={colors.subtleText}
                style={styles.detailsInput}
                multiline
                editable={!pending}
              />
              <Text style={styles.detailsCount}>
                {details.length} / {MAX_DETAILS}
              </Text>
            </ScrollView>

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
                onPress={() =>
                  onSubmit({
                    reason,
                    details: details.trim() ? details.trim() : undefined,
                  })
                }
                disabled={submitDisabled}
                style={[
                  styles.button,
                  styles.confirmButton,
                  submitDisabled && styles.buttonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Submit report"
              >
                {pending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.confirmText}>Submit report</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "100%",
    borderRadius: 18,
    backgroundColor: colors.card,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 12,
  },
  headerRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
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
  body: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },

  bodyScroll: { maxHeight: 380 },
  bodyScrollContent: { gap: 8, paddingBottom: 4 },

  reasonRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceTintPrimary,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.controlOutline,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioOuterSelected: { borderColor: colors.primary },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  reasonText: { flex: 1 },
  reasonLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  reasonHelper: { color: colors.mutedText, fontSize: 11, marginTop: 2 },

  detailsLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  detailsInput: {
    minHeight: 70,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
    textAlignVertical: "top",
  },
  detailsCount: {
    color: colors.subtleText,
    fontSize: 10,
    textAlign: "right",
    marginTop: 4,
  },

  footer: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 116,
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
