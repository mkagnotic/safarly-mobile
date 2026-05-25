import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { colors } from "@/theme/colors";

export interface EditParcelFormValues {
  weight_kg: string;
  description: string;
}

interface EditParcelModalProps {
  open: boolean;
  initial: EditParcelFormValues;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: EditParcelFormValues) => void;
}

export function EditParcelModal({
  open,
  initial,
  pending,
  onCancel,
  onSubmit,
}: Readonly<EditParcelModalProps>) {
  const [form, setForm] = useState<EditParcelFormValues>(initial);
  const wasOpenRef = useRef(false);

  // Re-seed on open-transition only — `initial` is recreated every parent render.
  useEffect(() => {
    if (open && !wasOpenRef.current) setForm(initial);
    wasOpenRef.current = open;
  }, [open, initial]);

  const handleSubmit = () => onSubmit(form);

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
          <View style={styles.header}>
            <Text style={styles.title}>Edit parcel</Text>
            <Pressable
              onPress={onCancel}
              hitSlop={8}
              disabled={pending}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Weight (kg)</Text>
            <TextInput
              value={form.weight_kg}
              onChangeText={(t) => setForm((prev) => ({ ...prev, weight_kg: t }))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.subtleText}
              style={styles.textInput}
              editable={!pending}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Description <Text style={styles.fieldLabelMuted}>(Optional)</Text>
            </Text>
            <TextInput
              value={form.description}
              onChangeText={(t) => setForm((prev) => ({ ...prev, description: t }))}
              placeholder="Describe what's in the parcel…"
              placeholderTextColor={colors.subtleText}
              style={[styles.textInput, styles.multiline]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!pending}
            />
          </View>

          <View style={styles.footer}>
            <AppButton
              label="Cancel"
              variant="secondary"
              onPress={onCancel}
              disabled={pending}
              style={styles.footerButton}
            />
            <AppButton
              label={pending ? "Saving…" : "Save changes"}
              onPress={handleSubmit}
              disabled={pending}
              gradientColors={[colors.ctaAccent, colors.ctaAccent]}
              leftIcon={
                pending ? <ActivityIndicator size="small" color={colors.white} /> : undefined
              }
              style={styles.footerButton}
            />
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
    maxWidth: 440,
    borderRadius: 22,
    backgroundColor: colors.card,
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: "800" },

  field: { gap: 8 },
  fieldLabel: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  fieldLabelMuted: { color: colors.subtleText, fontWeight: "500" },

  textInput: {
    backgroundColor: colors.input,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
  },
  multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },

  footer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  footerButton: { flex: 1 },
});
