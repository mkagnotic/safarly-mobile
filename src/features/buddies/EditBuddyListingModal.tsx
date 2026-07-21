import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { CalendarModal } from "@/components/ui/CalendarModal";
import { ListPickerModal } from "@/components/ui/ListPickerModal";
import { LocationCard } from "@/components/ui/FormSection";
import {
  AIRLINES,
  LANGUAGE_OPTIONS,
  MAX_LANGUAGES,
  SAME_ROUTE_MESSAGE,
  getAgeError,
  isSameRoute as computeSameRoute,
} from "@/features/buddies/buddyOptions";
import { CityPicker } from "@/features/search/CityPicker";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import { colors, primaryTint } from "@/theme/colors";
import { sanitizeDigitsOnly } from "@/utils/inputSanitizers";

type Country = "IN" | "US";

type FieldKey = "fromCity" | "toCity" | "travelDate" | "age";

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseYmd(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export interface EditBuddyListingFormValues {
  /** `ANY_CITY` sentinel ⇒ "Any city". */
  from_city: string;
  from_country: Country;
  to_city: string;
  to_country: Country;
  /**
   * Single `yyyy-MM-dd` travel date. Buddy listings are single-date only —
   * web keeps its "Date range" toggle commented out in both the create page
   * and the edit dialog — so callers persist this as from === to.
   */
  travel_date: string;
  airline: string;
  /** Kept as a string so an empty field round-trips as "no age given". */
  age: string;
  languages: string[];
  interests: string;
  layover: string;
  bio: string;
}

interface EditBuddyListingModalProps {
  open: boolean;
  initial: EditBuddyListingFormValues;
  pending: boolean;
  onCancel: () => void;
  /** Called only once the form validates — callers just map and send. */
  onSubmit: (values: EditBuddyListingFormValues) => void;
}

/**
 * Full-parity buddy listing editor.
 *
 * Mirrors web's `EditBuddyDialog`: every field the create form writes is
 * editable here. Age, languages, interests and layover used to be absent, so
 * callers had to re-seed them from the source listing on every save just to
 * stop the handler's full-upsert PUT from nulling them — which meant those four
 * fields could be set at creation and then never changed from the app.
 */
export function EditBuddyListingModal({
  open,
  initial,
  pending,
  onCancel,
  onSubmit,
}: Readonly<EditBuddyListingModalProps>) {
  const [form, setForm] = useState<EditBuddyListingFormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [airlineOpen, setAirlineOpen] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const d = parseYmd(initial.travel_date) ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const wasOpenRef = useRef(false);

  // Re-seed on open-transition only — `initial` is recreated every parent render.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setForm(initial);
      setErrors({});
      const d = parseYmd(initial.travel_date) ?? new Date();
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

  const selectedDate = useMemo(() => parseYmd(form.travel_date), [form.travel_date]);

  const patch = (next: Partial<EditBuddyListingFormValues>) =>
    setForm((prev) => ({ ...prev, ...next }));

  const clearError = (key: FieldKey) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const fromFlag = form.from_country === "IN" ? "🇮🇳" : "🇺🇸";
  const toFlag = form.to_country === "IN" ? "🇮🇳" : "🇺🇸";
  const fromCountryName = form.from_country === "IN" ? "India" : "United States";
  const toCountryName = form.to_country === "IN" ? "India" : "United States";
  const fromCities = form.from_country === "IN" ? INDIA_CITIES : USA_CITIES;
  const toCities = form.to_country === "IN" ? INDIA_CITIES : USA_CITIES;

  // Live checks, matching the create screen and web.
  const isSameRoute = computeSameRoute(
    form.from_country,
    form.from_city,
    form.to_country,
    form.to_city,
  );
  const toCityError = isSameRoute ? SAME_ROUTE_MESSAGE : errors.toCity;
  const ageError = getAgeError(form.age) ?? errors.age;

  const toggleFromCountry = () => {
    setForm((prev) => ({
      ...prev,
      from_country: prev.from_country === "IN" ? "US" : "IN",
      from_city: "",
    }));
    clearError("fromCity");
  };
  const toggleToCountry = () => {
    setForm((prev) => ({
      ...prev,
      to_country: prev.to_country === "IN" ? "US" : "IN",
      to_city: "",
    }));
    clearError("toCity");
  };

  const handleAddLanguage = (lang: string) => {
    setForm((prev) =>
      prev.languages.length >= MAX_LANGUAGES || prev.languages.includes(lang)
        ? prev
        : { ...prev, languages: [...prev.languages, lang] },
    );
  };

  const handleRemoveLanguage = (lang: string) => {
    setForm((prev) => ({ ...prev, languages: prev.languages.filter((l) => l !== lang) }));
  };

  const handleSubmit = () => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!form.from_city) next.fromCity = "Select a departure city";
    if (!form.to_city) next.toCity = "Select a destination city";
    if (isSameRoute) next.toCity = SAME_ROUTE_MESSAGE;
    // Presence only, matching web. An already-persisted past date must stay
    // saveable, otherwise a stale listing can't be edited at all; the calendar
    // still refuses to *pick* a new past date.
    if (!form.travel_date) next.travelDate = "Pick your travel date";
    const ageRangeError = getAgeError(form.age);
    if (ageRangeError) next.age = ageRangeError;

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onSubmit(form);
  };

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
            <Text style={styles.title}>Edit travel partner request</Text>
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
            {/* ───── Route ───── */}
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
                  patch({ from_city: v });
                  clearError("fromCity");
                }}
                cities={fromCities}
                placeholder="Select departure city"
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
                  patch({ to_city: v });
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

            {/* ───── Travel date ───── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Travel date</Text>
              <Pressable
                onPress={() => setCalendarOpen(true)}
                style={[styles.input, styles.selectInput, !!errors.travelDate && styles.inputError]}
                accessibilityRole="button"
                accessibilityLabel="Pick travel date"
                disabled={pending}
              >
                <Ionicons name="calendar-outline" size={16} color={colors.wordmark} />
                <Text
                  style={[styles.selectInputText, !selectedDate && styles.selectInputPlaceholder]}
                  numberOfLines={1}
                >
                  {selectedDate ? formatDateLabel(selectedDate) : "Select date"}
                </Text>
              </Pressable>
              {errors.travelDate ? (
                <Text style={styles.inlineError}>{errors.travelDate}</Text>
              ) : null}
            </View>

            {/* ───── Airline ───── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Airline <Text style={styles.fieldLabelMuted}>(Optional)</Text>
              </Text>
              <Pressable
                style={[styles.input, styles.selectInput]}
                onPress={() => setAirlineOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Pick airline"
                disabled={pending}
              >
                <Ionicons name="airplane-outline" size={16} color={colors.wordmark} />
                <Text
                  style={[styles.selectInputText, !form.airline && styles.selectInputPlaceholder]}
                  numberOfLines={1}
                >
                  {form.airline || "Select airline"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.mutedText} />
              </Pressable>
            </View>

            {/* ───── Age ───── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Age <Text style={styles.fieldLabelMuted}>(Optional)</Text>
              </Text>
              <TextInput
                value={form.age}
                onChangeText={(v) => {
                  patch({ age: sanitizeDigitsOnly(v, 3) });
                  clearError("age");
                }}
                placeholder="e.g. 28"
                placeholderTextColor={colors.placeholderText}
                keyboardType="number-pad"
                style={[styles.textInput, !!ageError && styles.inputError]}
                editable={!pending}
              />
              {ageError ? <Text style={styles.inlineError}>{ageError}</Text> : null}
            </View>

            {/* ───── Languages ───── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Languages{" "}
                <Text style={styles.fieldLabelMuted}>(Optional, up to {MAX_LANGUAGES})</Text>
              </Text>
              {form.languages.length > 0 ? (
                <View style={styles.chipsRow}>
                  {form.languages.map((lang) => (
                    <View key={lang} style={styles.chip}>
                      <Text style={styles.chipText}>{lang}</Text>
                      <Pressable
                        onPress={() => handleRemoveLanguage(lang)}
                        hitSlop={6}
                        disabled={pending}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${lang}`}
                      >
                        <Ionicons name="close" size={12} color={colors.mutedText} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <Pressable
                style={[styles.input, styles.selectInput]}
                onPress={() => setLanguagePickerOpen(true)}
                disabled={pending || form.languages.length >= MAX_LANGUAGES}
                accessibilityRole="button"
                accessibilityLabel="Add a language"
              >
                <Text style={[styles.selectInputText, styles.selectInputPlaceholder]}>
                  {form.languages.length >= MAX_LANGUAGES
                    ? `Max ${MAX_LANGUAGES} selected`
                    : "Add a language"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.mutedText} />
              </Pressable>
            </View>

            {/* ───── Interests ───── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Interests <Text style={styles.fieldLabelMuted}>(Optional)</Text>
              </Text>
              <TextInput
                value={form.interests}
                onChangeText={(t) => patch({ interests: t })}
                placeholder="e.g. Photography, Hiking, Food, Tech"
                placeholderTextColor={colors.placeholderText}
                style={styles.textInput}
                editable={!pending}
              />
            </View>

            {/* ───── Layover ───── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Layover <Text style={styles.fieldLabelMuted}>(Optional)</Text>
              </Text>
              <TextInput
                value={form.layover}
                onChangeText={(t) => patch({ layover: t })}
                placeholder="e.g. London Heathrow — 3h layover"
                placeholderTextColor={colors.placeholderText}
                style={styles.textInput}
                editable={!pending}
              />
            </View>

            {/* ───── Bio ───── */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                About you <Text style={styles.fieldLabelMuted}>(Optional)</Text>
              </Text>
              <TextInput
                value={form.bio}
                onChangeText={(t) => patch({ bio: t })}
                placeholder="Tell potential buddies about yourself — travel style, what you're looking for…"
                placeholderTextColor={colors.placeholderText}
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

      <ListPickerModal
        open={airlineOpen}
        title="Select airline"
        options={AIRLINES}
        selected={form.airline}
        onSelect={(a) => {
          patch({ airline: a });
          setAirlineOpen(false);
        }}
        onClose={() => setAirlineOpen(false)}
      />

      <ListPickerModal
        open={languagePickerOpen}
        title="Add a language"
        options={LANGUAGE_OPTIONS.filter((l) => !form.languages.includes(l))}
        selected=""
        onSelect={(l) => {
          handleAddLanguage(l);
          setLanguagePickerOpen(false);
        }}
        onClose={() => setLanguagePickerOpen(false)}
      />

      <CalendarModal
        open={calendarOpen}
        title="Pick travel date"
        selected={selectedDate}
        visibleMonth={visibleMonth}
        today={today}
        maxDate={maxDate}
        onSelect={(d) => {
          patch({ travel_date: formatYmd(d) });
          clearError("travelDate");
          setCalendarOpen(false);
        }}
        onChangeMonth={setVisibleMonth}
        onClose={() => setCalendarOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.4)" },
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
    gap: 12,
  },
  title: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: "800", flex: 1 },

  scroll: { flexGrow: 0 },
  scrollContent: { gap: 16 },

  field: { gap: 8 },
  fieldLabel: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  fieldLabelMuted: { color: colors.subtleText, fontWeight: "500" },

  input: {
    backgroundColor: colors.input,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  inputError: { borderColor: colors.danger, backgroundColor: "rgba(220, 40, 40, 0.06)" },
  selectInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectInputText: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "500", flex: 1 },
  selectInputPlaceholder: { color: colors.placeholderText },
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

  inlineError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceTintPrimary,
    borderWidth: 1,
    borderColor: primaryTint.stroke20,
  },
  chipText: { color: colors.wordmark, fontSize: 12, lineHeight: 16, fontWeight: "700" },

  footer: { flexDirection: "row", gap: 10, marginTop: 4 },
  footerButton: { flex: 1 },
});
