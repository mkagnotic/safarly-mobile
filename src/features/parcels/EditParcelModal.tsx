import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
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

import { CalendarModal } from "@/components/ui/CalendarModal";
import { DateField, DateModeToggle, LocationCard } from "@/components/ui/FormSection";
import { AppButton } from "@/components/ui/AppButton";
import { ANY_CITY, CityPicker } from "@/features/search/CityPicker";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import type { DeliveryDateMode } from "@/services/api";
import { colors } from "@/theme/colors";
import { sanitizeDecimalInput } from "@/utils/inputSanitizers";

type Country = "IN" | "US";
type Currency = "USD" | "INR";

/** Mirrors the `parcel_requests.category` check constraint. */
type ParcelCategory =
  | "electronics"
  | "documents"
  | "clothing"
  | "food"
  | "medicine"
  | "personal";

const CATEGORIES: readonly ParcelCategory[] = [
  "electronics",
  "documents",
  "clothing",
  "food",
  "medicine",
  "personal",
];

/** Per-item ceiling — matches web `airlineLimits.ts`. */
const MAX_WEIGHT_KG = 23;

const SAME_ROUTE_MSG = "Destination must be different from origin";

function parseYmd(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Same formula as the create form and web. */
function suggestFee(weightKg: number, currency: Currency): number {
  return currency === "USD"
    ? Math.max(15, Math.round((15 + 6 * weightKg) / 5) * 5)
    : Math.max(1200, Math.round((1200 + 480 * weightKg) / 50) * 50);
}

export interface EditParcelFormValues {
  /** `ANY_CITY` sentinel ⇒ "Any city" (any_from). */
  from_city: string;
  from_country: Country;
  to_city: string;
  to_country: Country;
  weight_kg: string;
  description: string;
  category: ParcelCategory;
  fee_offered: string;
  fee_currency: Currency;
  /** `YYYY-MM-DD`. In single mode both dates are the same day. */
  delivery_by_from: string;
  delivery_by_to: string;
  delivery_date_mode: DeliveryDateMode;
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
  const [error, setError] = useState<string | null>(null);
  const [calendarTarget, setCalendarTarget] = useState<"from" | "to" | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const d = parseYmd(initial.delivery_by_from) ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const wasOpenRef = useRef(false);

  // Re-seed on open-transition only — `initial` is recreated every parent render.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setForm(initial);
      setError(null);
      const d = parseYmd(initial.delivery_by_from) ?? new Date();
      setVisibleMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    wasOpenRef.current = open;
  }, [open, initial]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }, [today]);

  const fromDate = parseYmd(form.delivery_by_from);
  const toDate = parseYmd(form.delivery_by_to);
  const weightNum = Number(form.weight_kg);

  const isSameRoute =
    !!form.from_city &&
    !!form.to_city &&
    form.from_city !== ANY_CITY &&
    form.from_country === form.to_country &&
    form.from_city === form.to_city;

  /**
   * Suggested fee only fills an EMPTY field here — unlike the create form,
   * which keeps overwriting until touched. An existing offer is the sender's
   * own decision and must never be silently rewritten on edit. (Web does the
   * same.)
   */
  const suggestedFee = useMemo(() => {
    if (!form.weight_kg || Number.isNaN(weightNum) || weightNum <= 0) return null;
    return suggestFee(weightNum, form.fee_currency);
  }, [form.weight_kg, form.fee_currency, weightNum]);

  useEffect(() => {
    if (suggestedFee != null && form.fee_offered === "") {
      setForm((prev) => ({ ...prev, fee_offered: String(suggestedFee) }));
    }
  }, [suggestedFee, form.fee_offered]);

  const handleSubmit = () => {
    if (!form.from_city) return setError("Select an origin city");
    if (!form.to_city) return setError("Select a destination city");
    if (isSameRoute) return setError(SAME_ROUTE_MSG);
    if (!form.weight_kg || Number.isNaN(weightNum) || weightNum <= 0) {
      return setError("Enter the parcel weight");
    }
    if (weightNum > MAX_WEIGHT_KG) {
      return setError(`Weight exceeds the airline limit of ${MAX_WEIGHT_KG} kg per item`);
    }
    if (!fromDate) return setError("Pick a delivery deadline");
    if (form.delivery_date_mode === "range") {
      if (!toDate) return setError("Pick the latest delivery date");
      // Strictly after: equal ends are a single date, which the mode toggle
      // already expresses. `<` allowed them to match despite this wording.
      if (toDate <= fromDate) return setError("Latest date must be after the earliest");
    }
    const fee = Number(form.fee_offered);
    if (!form.fee_offered || Number.isNaN(fee) || fee <= 0) {
      return setError("Enter a valid amount");
    }
    setError(null);
    // In single mode both dates collapse to the deadline, matching what the
    // handler would do anyway — sending them aligned keeps client and server
    // in agreement rather than relying on the server to fix it up.
    onSubmit(
      form.delivery_date_mode === "single"
        ? { ...form, delivery_by_to: form.delivery_by_from }
        : form,
    );
  };

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

          {/* Deliver by — sits below the destination, matching the create form. */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Deliver by</Text>
            <DateModeToggle<DeliveryDateMode>
              options={[
                { value: "single", label: "Single Date" },
                { value: "range", label: "Date Range" },
              ]}
              value={form.delivery_date_mode}
              onChange={(next) =>
                setForm((prev) => ({
                  ...prev,
                  delivery_date_mode: next,
                  // Collapsing here keeps the two in step; the handler would
                  // otherwise do it and the UI would briefly disagree.
                  delivery_by_to: next === "single" ? prev.delivery_by_from : prev.delivery_by_to,
                }))
              }
            />
            <View style={styles.dateRow}>
              <View style={styles.dateCell}>
                <DateField
                  label={form.delivery_date_mode === "range" ? "Earliest" : "Deliver by"}
                  value={fromDate ? formatDateLabel(fromDate) : null}
                  placeholder="Select date"
                  onPress={() => setCalendarTarget("from")}
                />
              </View>
              <View style={styles.dateCell}>
                <DateField
                  label="Latest"
                  value={toDate ? formatDateLabel(toDate) : null}
                  placeholder="Select date"
                  onPress={() => setCalendarTarget("to")}
                  disabled={form.delivery_date_mode === "single"}
                />
              </View>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => {
                const active = form.category === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setForm((prev) => ({ ...prev, category: c }))}
                    disabled={pending}
                    style={[styles.chip, active && styles.chipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {c[0].toUpperCase() + c.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Weight (kg)</Text>
            <TextInput
              value={form.weight_kg}
              onChangeText={(t) =>
                setForm((prev) => ({ ...prev, weight_kg: sanitizeDecimalInput(t, 4, 2) }))
              }
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.placeholderText}
              style={[styles.textInput, weightNum > MAX_WEIGHT_KG && styles.textInputError]}
              editable={!pending}
            />
            {weightNum > MAX_WEIGHT_KG ? (
              <Text style={styles.inlineError}>
                Exceeds the airline limit of {MAX_WEIGHT_KG} kg per item.
              </Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Fee offered</Text>
            <View style={styles.feeRow}>
              <Pressable
                onPress={() =>
                  setForm((prev) => ({
                    ...prev,
                    fee_currency: prev.fee_currency === "USD" ? "INR" : "USD",
                  }))
                }
                disabled={pending}
                style={styles.currencyToggle}
                accessibilityRole="button"
                accessibilityLabel={`Currency: ${form.fee_currency}. Tap to switch.`}
              >
                <Text style={styles.currencyToggleText}>{form.fee_currency}</Text>
              </Pressable>
              <TextInput
                value={form.fee_offered}
                onChangeText={(t) =>
                  setForm((prev) => ({ ...prev, fee_offered: sanitizeDecimalInput(t, 6, 2) }))
                }
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.placeholderText}
                style={[styles.textInput, styles.feeInput]}
                editable={!pending}
              />
            </View>
            {suggestedFee != null ? (
              <Text style={styles.hint}>
                Suggested for {form.weight_kg} kg: {form.fee_currency === "USD" ? "$" : "₹"}
                {suggestedFee}
              </Text>
            ) : null}
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
          {error ? <Text style={styles.formError}>{error}</Text> : null}
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

      <CalendarModal
        open={calendarTarget !== null}
        title={calendarTarget === "to" ? "Pick the latest date" : "Pick a delivery deadline"}
        selected={calendarTarget === "to" ? toDate : fromDate}
        visibleMonth={visibleMonth}
        // The window's end can't precede its start.
        today={calendarTarget === "to" && fromDate ? fromDate : today}
        maxDate={maxDate}
        onSelect={(d) => {
          const ymd = formatYmd(d);
          setForm((prev) =>
            calendarTarget === "to"
              ? { ...prev, delivery_by_to: ymd }
              : {
                  ...prev,
                  delivery_by_from: ymd,
                  // Single mode keeps both ends on the chosen day.
                  delivery_by_to:
                    prev.delivery_date_mode === "single" ? ymd : prev.delivery_by_to,
                },
          );
          setError(null);
          setCalendarTarget(null);
        }}
        onChangeMonth={setVisibleMonth}
        onClose={() => setCalendarTarget(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  dateCell: { flex: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.wordmark, borderColor: colors.wordmark },
  chipText: { color: colors.mutedText, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  feeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  currencyToggle: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyToggleText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  feeInput: { flex: 1 },
  textInputError: { borderColor: colors.danger },
  inlineError: { color: colors.danger, fontSize: 12, fontWeight: "500", marginTop: 4 },
  hint: { color: colors.subtleText, fontSize: 12, marginTop: 6 },
  formError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
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
