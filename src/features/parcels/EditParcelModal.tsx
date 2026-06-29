import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { LocationCard } from "@/components/ui/FormSection";
import { AppButton } from "@/components/ui/AppButton";
import { CityPicker } from "@/features/search/CityPicker";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import { colors } from "@/theme/colors";

type Country = "IN" | "US";

export interface EditParcelFormValues {
  /** `ANY_CITY` sentinel ⇒ "Any city" (any_from). */
  from_city: string;
  from_country: Country;
  to_city: string;
  to_country: Country;
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

  const fromFlag = form.from_country === "IN" ? "🇮🇳" : "🇺🇸";
  const toFlag = form.to_country === "IN" ? "🇮🇳" : "🇺🇸";
  const fromCountryName = form.from_country === "IN" ? "India" : "United States";
  const toCountryName = form.to_country === "IN" ? "India" : "United States";
  const fromCities = form.from_country === "IN" ? INDIA_CITIES : USA_CITIES;
  const toCities = form.to_country === "IN" ? INDIA_CITIES : USA_CITIES;

  const toggleFromCountry = () =>
    setForm((prev) => ({
      ...prev,
      from_country: prev.from_country === "IN" ? "US" : "IN",
      from_city: "",
    }));
  const toggleToCountry = () =>
    setForm((prev) => ({
      ...prev,
      to_country: prev.to_country === "IN" ? "US" : "IN",
      to_city: "",
    }));

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

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>From</Text>
            <LocationCard
              flag={fromFlag}
              label={fromCountryName}
              filled
              onToggle={toggleFromCountry}
            />
            <CityPicker
              value={form.from_city}
              onChange={(v) => setForm((prev) => ({ ...prev, from_city: v }))}
              cities={fromCities}
              placeholder="Select origin city"
              variant="card"
              disabled={pending}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>To</Text>
            <LocationCard
              flag={toFlag}
              label={toCountryName}
              filled
              onToggle={toggleToCountry}
            />
            <CityPicker
              value={form.to_city}
              onChange={(v) => setForm((prev) => ({ ...prev, to_city: v }))}
              cities={toCities}
              placeholder="Select destination city"
              variant="card"
              disabled={pending}
            />
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
          </ScrollView>

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
    maxHeight: "88%",
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

  scroll: { flexGrow: 0 },
  scrollContent: { gap: 16 },

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
