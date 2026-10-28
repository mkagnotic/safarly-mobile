import { Ionicons } from "@expo/vector-icons";
import { ListingFilesField } from "@/components/listing/ListingFilesField";
import { minAmountProblem } from "@/utils/minAmount";
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
import { KeyboardLift } from "@/components/ui/KeyboardLift";
import { ANY_CITY, CityPicker } from "@/features/search/CityPicker";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import type { DeliveryDateMode } from "@/services/api";
import { colors } from "@/theme/colors";
import { sanitizeDecimalInput } from "@/utils/inputSanitizers";
import { validateReturnForm, type ReturnAddressErrors, type ReturnFormValues } from "@/utils/addressOptions";
import { ReturnAddressFields } from "./ReturnAddressFields";
import { currencySymbol } from "@/utils/money";

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
/** One string for the live line and Save (28 Oct 2026 edit canon). */
const WEIGHT_OVER_MAX_MSG = `Exceeds the airline limit of ${MAX_WEIGHT_KG} kg per item.`;
const RETURN_SUMMARY_MSG = "Check the seller's return address.";

/** Fields that can carry an inline validation error (28 Oct 2026: was one line above the footer). */
type FieldKey = "fromCity" | "toCity" | "date" | "weight" | "fee";

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
  /** Online order / return block, same fields as the send form (27 Oct 2026). */
  returnForm: ReturnFormValues;
}

export interface EditParcelSubmitOptions {
  /**
   * False while the private return address hasn't loaded and the user hasn't
   * touched the block: the caller must not send it (web's checkReturn).
   */
  includeReturn: boolean;
}

interface EditParcelModalProps {
  open: boolean;
  initial: EditParcelFormValues;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: EditParcelFormValues, options: EditParcelSubmitOptions) => void;
  /** The listing being edited: its optional owner files are managed here (26 Oct 2026). */
  listingId?: string;
  /** The parcel already has offers: the server refuses a currency change (409). */
  currencyLocked?: boolean;
  /** The server's refusal of the last save (e.g. booked parcel), shown in the modal. */
  serverError?: string | null;
  /**
   * The owner's detail read (currency lock, full return address) is still
   * loading (My Travels, 28 Oct 2026): the currency switch stays off and the
   * return block isn't checked or sent until it arrives or is edited.
   */
  detailPending?: boolean;
}

export function EditParcelModal({
  open,
  initial,
  listingId,
  pending,
  onCancel,
  onSubmit,
  currencyLocked = false,
  serverError = null,
  detailPending = false,
}: Readonly<EditParcelModalProps>) {
  const [form, setForm] = useState<EditParcelFormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [returnSummary, setReturnSummary] = useState<string | null>(null);
  const [returnErrors, setReturnErrors] = useState<ReturnAddressErrors>({});
  const [returnTouched, setReturnTouched] = useState(false);
  const detailPendingRef = useRef(detailPending);
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
      setErrors({});
      setReturnSummary(null);
      setReturnErrors({});
      setReturnTouched(false);
      const d = parseYmd(initial.delivery_by_from) ?? new Date();
      setVisibleMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    wasOpenRef.current = open;
  }, [open, initial]);

  // The private return address arrives with the detail read: fill the block
  // then, unless the user already started on it (web parity).
  useEffect(() => {
    if (open && detailPendingRef.current && !detailPending && !returnTouched) {
      setForm((prev) => ({ ...prev, returnForm: initial.returnForm }));
    }
    detailPendingRef.current = detailPending;
  }, [open, detailPending, initial.returnForm, returnTouched]);

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

  /** Fee check, on blur (web rule: "Checked when you leave the field, as on Send Parcel") and on Save. */
  const feeProblem = (): string | undefined => {
    const fee = Number(form.fee_offered);
    if (!form.fee_offered || Number.isNaN(fee) || fee <= 0) return "Enter a valid amount";
    // Same minimum as the server: $5 / ₹500 (client, 26 Oct 2026).
    return minAmountProblem(fee, form.fee_currency);
  };

  const clearError = (key: FieldKey) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  // Untouched and not loaded yet: leave the return details alone (web's checkReturn).
  const checkReturn = !detailPending || returnTouched;

  const handleSubmit = () => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!form.from_city) next.fromCity = "Select an origin city";
    if (!form.to_city) next.toCity = "Select a destination city";
    else if (isSameRoute) next.toCity = SAME_ROUTE_MSG;
    if (!form.weight_kg || Number.isNaN(weightNum) || weightNum <= 0) {
      next.weight = "Enter the parcel weight";
    } else if (weightNum > MAX_WEIGHT_KG) {
      next.weight = WEIGHT_OVER_MAX_MSG;
    }
    if (!fromDate) {
      next.date =
        form.delivery_date_mode === "range" ? "Pick the earliest delivery date" : "Pick a delivery date";
    } else if (form.delivery_date_mode === "range") {
      if (!toDate) next.date = "Pick the latest delivery date";
      // Strictly after: equal ends are a single date, which the mode toggle
      // already expresses. `<` allowed them to match despite this wording.
      else if (toDate <= fromDate) next.date = "Latest date must be after the earliest";
    }
    const fee = feeProblem();
    if (fee) next.fee = fee;
    const ra = checkReturn ? validateReturnForm(form.returnForm) : {};
    const returnBad = Object.keys(ra).length > 0;
    setErrors(next);
    setReturnErrors(ra);
    setReturnSummary(returnBad ? RETURN_SUMMARY_MSG : null);
    if (Object.keys(next).length > 0 || returnBad) return;
    // In single mode both dates collapse to the deadline, matching what the
    // handler would do anyway — sending them aligned keeps client and server
    // in agreement rather than relying on the server to fix it up.
    onSubmit(
      form.delivery_date_mode === "single"
        ? { ...form, delivery_by_to: form.delivery_by_from }
        : form,
      { includeReturn: checkReturn },
    );
  };

  /** Live: same route under "To", and the weight over the airline max. */
  const toCityError = isSameRoute ? SAME_ROUTE_MSG : errors.toCity;
  const weightError = weightNum > MAX_WEIGHT_KG ? WEIGHT_OVER_MAX_MSG : errors.weight;
  const currencyDisabled = pending || currencyLocked || detailPending;

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
      statusBarTranslucent
      navigationBarTranslucent
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!pending) onCancel();
      }}
    >
      {/* A Modal's window is not resized for the keyboard on either platform
          (edge-to-edge on Android), so lift the card ourselves: the form scrolls in the space left and
          the Cancel / Save footer stays above the keyboard. */}
      <KeyboardLift style={styles.flex}>
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
                onChange={(v) => {
                  setForm((prev) => ({ ...prev, from_city: v }));
                  clearError("fromCity");
                }}
                cities={fromCities}
                placeholder="Select origin city"
                variant="card"
                disabled={pending}
                invalid={!!errors.fromCity}
              />
              {errors.fromCity ? <Text style={styles.inlineError}>{errors.fromCity}</Text> : null}
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
                onChange={(v) => {
                  setForm((prev) => ({ ...prev, to_city: v }));
                  clearError("toCity");
                }}
                cities={toCities}
                placeholder="Select destination city"
                variant="card"
                disabled={pending}
                invalid={!!toCityError}
              />
              {toCityError ? <Text style={styles.inlineError}>{toCityError}</Text> : null}
            </View>

            {/* Deliver by — sits below the destination, matching the create form. */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Deliver by</Text>
              <DateModeToggle<DeliveryDateMode>
                options={[
                  { value: "single", label: "Single date" },
                  { value: "range", label: "Date range" },
                ]}
                value={form.delivery_date_mode}
                onChange={(next) => {
                  setForm((prev) => ({
                    ...prev,
                    delivery_date_mode: next,
                    // Collapsing here keeps the two in step; the handler would
                    // otherwise do it and the UI would briefly disagree.
                    delivery_by_to: next === "single" ? prev.delivery_by_from : prev.delivery_by_to,
                  }));
                  clearError("date");
                }}
              />
              <View style={styles.dateRow}>
                <View style={styles.dateCell}>
                  <DateField
                    label={form.delivery_date_mode === "range" ? "Earliest" : "Deliver by"}
                    value={fromDate ? formatDateLabel(fromDate) : null}
                    placeholder="Pick a date"
                    onPress={() => setCalendarTarget("from")}
                  />
                </View>
                <View style={styles.dateCell}>
                  <DateField
                    label="Latest"
                    value={toDate ? formatDateLabel(toDate) : null}
                    placeholder="Pick a date"
                    onPress={() => setCalendarTarget("to")}
                    disabled={form.delivery_date_mode === "single"}
                  />
                </View>
              </View>
              {errors.date ? <Text style={styles.inlineError}>{errors.date}</Text> : null}
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
                onChangeText={(t) => {
                  setForm((prev) => ({ ...prev, weight_kg: sanitizeDecimalInput(t, 4, 2) }));
                  clearError("weight");
                }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.placeholderText}
                style={[styles.textInput, !!weightError && styles.textInputError]}
                editable={!pending}
              />
              {weightError ? (
                <Text style={styles.inlineError}>{weightError}</Text>
              ) : (
                <Text style={styles.hint}>
                  Used to suggest a fair carrier fee. Airline max: {MAX_WEIGHT_KG} kg per item.
                </Text>
              )}
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
                  disabled={currencyDisabled}
                  style={[styles.currencyToggle, (currencyLocked || detailPending) && styles.currencyToggleLocked]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: currencyDisabled }}
                  accessibilityLabel={
                    currencyLocked
                      ? `Currency: ${form.fee_currency}. Locked once offers have been made.`
                      : detailPending
                        ? `Currency: ${form.fee_currency}.`
                        : `Currency: ${form.fee_currency}. Tap to switch.`
                  }
                >
                  <Text style={styles.currencyToggleText}>{form.fee_currency}</Text>
                </Pressable>
                <TextInput
                  value={form.fee_offered}
                  onChangeText={(t) => {
                    setForm((prev) => ({ ...prev, fee_offered: sanitizeDecimalInput(t, 6, 2) }));
                    clearError("fee");
                  }}
                  onBlur={() => {
                    const problem = feeProblem();
                    setErrors((prev) => (problem ? { ...prev, fee: problem } : prev));
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.placeholderText}
                  style={[styles.textInput, styles.feeInput, !!errors.fee && styles.textInputError]}
                  editable={!pending}
                />
              </View>
              {errors.fee ? <Text style={styles.inlineError}>{errors.fee}</Text> : null}
              {currencyLocked ? (
                <Text style={styles.hint}>Currency is locked once offers have been made.</Text>
              ) : null}
              {suggestedFee != null ? (
                <Text style={styles.hint}>
                  Suggested {currencySymbol(form.fee_currency)}
                  {suggestedFee} for {form.weight_kg} kg — adjust to whatever you like.
                </Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Description <Text style={styles.fieldLabelMuted}>(optional)</Text>
              </Text>
              <TextInput
                value={form.description}
                onChangeText={(t) => setForm((prev) => ({ ...prev, description: t }))}
                placeholder="Describe what's in the parcel…"
                maxLength={2000}
                placeholderTextColor={colors.subtleText}
                style={[styles.textInput, styles.multiline]}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!pending}
              />
            </View>

            <ReturnAddressFields
              value={form.returnForm}
              onChange={(patch) => {
                setReturnTouched(true);
                setForm((prev) => ({ ...prev, returnForm: { ...prev.returnForm, ...patch } }));
              }}
              errors={returnErrors}
              onFieldEdited={(k) =>
                setReturnErrors((prev) => {
                  if (!prev[k]) return prev;
                  const next = { ...prev };
                  delete next[k];
                  return next;
                })
              }
              disabled={pending}
            />
            {returnSummary ? <Text style={styles.inlineError}>{returnSummary}</Text> : null}

            {/* Last field inside the scroll, as web (28 Oct 2026): pinned outside it ate the
                form's room on small phones. */}
            {listingId ? (
              <ListingFilesField kind="parcel" listingId={listingId} label="Parcel photos or documents" hint="photos, invoice or order screenshot (PDF or photos)" />
            ) : null}
            </ScrollView>

            {/* The server's refusal, above the footer so it is seen however far the form scrolled. */}
            {serverError ? (
              <Text style={styles.formError} accessibilityLiveRegion="polite">
                {serverError}
              </Text>
            ) : null}

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
      </KeyboardLift>

      <CalendarModal
        open={calendarTarget !== null}
        title={calendarTarget === "to" ? "Pick the latest date" : "Pick a delivery date"}
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
          clearError("date");
          setCalendarTarget(null);
        }}
        onChangeMonth={setVisibleMonth}
        onClose={() => setCalendarTarget(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  currencyToggleLocked: { opacity: 0.5 },
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
