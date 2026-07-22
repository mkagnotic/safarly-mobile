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

import { LocationCard } from "@/components/ui/FormSection";
import { AppButton } from "@/components/ui/AppButton";
import { CityPicker } from "@/features/search/CityPicker";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import { MAX_WEIGHT_KG, isSameRoute } from "@/features/travels/routeValidation";
import { colors } from "@/theme/colors";

type Country = "IN" | "US";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

interface CalendarCell {
  date: Date;
  inMonth: boolean;
}

type CalendarTarget = "from" | "to";

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
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function buildCalendar(monthDate: Date): CalendarCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    cells.push({ date: new Date(year, month - 1, daysInPrev - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length < 42) {
    const nextDay = cells.length - (firstWeekday + daysInMonth) + 1;
    cells.push({ date: new Date(year, month + 1, nextDay), inMonth: false });
  }
  return cells;
}

function sameDate(a: Date | null, b: Date): boolean {
  return (
    !!a &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Fields that can carry an inline validation error. */
type FieldKey = "fromCity" | "toCity" | "departDate" | "capacity";

/** Web parity (`CustomerListTrip.tsx` sameRouteMsg). */
const SAME_ROUTE_MSG = "Arrival city must be different from departure";

export interface EditTripFormValues {
  /** `ANY_CITY` sentinel ⇒ "Any city" (any_from). */
  from_city: string;
  from_country: Country;
  to_city: string;
  to_country: Country;
  /** Departure date (= travel_date_from). `YYYY-MM-DD`. */
  travel_date_from: string;
  /** Return date (= travel_date_to). Empty string ⇒ single date (same day). */
  travel_date_to: string;
  luggage_capacity_kg: string;
  notes: string;
}

interface EditTripModalProps {
  open: boolean;
  initial: EditTripFormValues;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: EditTripFormValues) => void;
}

export function EditTripModal({
  open,
  initial,
  pending,
  onCancel,
  onSubmit,
}: Readonly<EditTripModalProps>) {
  const [form, setForm] = useState<EditTripFormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const initialDate = parseYmd(initial.travel_date_from) ?? new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });
  const wasOpenRef = useRef(false);

  // Re-seed on open-transition only — `initial` is recreated every parent render.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setForm(initial);
      setErrors({});
      const d = parseYmd(initial.travel_date_from) ?? new Date();
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

  const selectedFrom = useMemo(() => parseYmd(form.travel_date_from), [form.travel_date_from]);
  const selectedTo = useMemo(() => parseYmd(form.travel_date_to), [form.travel_date_to]);

  const openCalendar = (target: CalendarTarget) => {
    const seed =
      target === "from"
        ? parseYmd(form.travel_date_from) ?? new Date()
        : parseYmd(form.travel_date_to) ?? parseYmd(form.travel_date_from) ?? new Date();
    setVisibleMonth(new Date(seed.getFullYear(), seed.getMonth(), 1));
    setCalendarTarget(target);
  };

  const handleSelectDate = (d: Date) => {
    if (!calendarTarget) return;
    const ymd = formatYmd(d);
    setForm((prev) => {
      if (calendarTarget === "from") {
        // A "to" earlier than the new "from" no longer makes sense — clear it.
        const next = { ...prev, travel_date_from: ymd };
        const prevTo = parseYmd(prev.travel_date_to);
        if (prevTo && prevTo < d) next.travel_date_to = "";
        return next;
      }
      return { ...prev, travel_date_to: ymd };
    });
    setCalendarTarget(null);
  };

  /**
   * This modal previously called `onSubmit(form)` with no checks at all, so an
   * empty city or a same-city route reached the API. Web's edit dialog blocks
   * both; the create screen blocks those plus the capacity bounds. Validating
   * here (rather than in each caller) means MyTravels and TripDetails can't
   * drift apart the way they had.
   */
  const handleSubmit = () => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!form.from_city) next.fromCity = "Select a departure city";
    if (!form.to_city) next.toCity = "Select an arrival city";
    if (isSameRoute(form.from_country, form.from_city, form.to_country, form.to_city)) {
      next.toCity = SAME_ROUTE_MSG;
    }
    // Presence only, matching web: an already-persisted past date must stay
    // saveable, and the calendar already refuses to pick a new one.
    if (!form.travel_date_from) next.departDate = "Pick a travel date";

    const capacity = Number(form.luggage_capacity_kg);
    if (form.luggage_capacity_kg.trim() === "" || !Number.isFinite(capacity) || capacity <= 0) {
      next.capacity = "Enter the capacity you can carry";
    } else if (capacity > MAX_WEIGHT_KG) {
      next.capacity = `Must be ${MAX_WEIGHT_KG} kg or less`;
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit(form);
  };

  const clearError = (key: FieldKey) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  /** Live same-route error, so it shows on selection rather than only on save. */
  const liveSameRoute = isSameRoute(
    form.from_country,
    form.from_city,
    form.to_country,
    form.to_city,
  );
  const toCityError = liveSameRoute ? SAME_ROUTE_MSG : errors.toCity;

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

  const fromLabel = selectedFrom ? formatDateLabel(selectedFrom) : "Select date";
  const toLabel = selectedTo ? formatDateLabel(selectedTo) : selectedFrom ? "Same day" : "Select date";
  const calendarCells = buildCalendar(visibleMonth);
  const calendarMin = calendarTarget === "to" && selectedFrom ? selectedFrom : today;

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
            <Text style={styles.title}>Edit trip</Text>
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
                setForm((prev) => ({ ...prev, to_city: v }));
                clearError("toCity");
              }}
              cities={toCities}
              placeholder="Select arrival city"
              variant="card"
              disabled={pending}
              invalid={!!toCityError}
            />
            {toCityError ? <Text style={styles.inlineError}>{toCityError}</Text> : null}
          </View>

          <View style={styles.dateRow}>
            <View style={[styles.field, styles.dateField]}>
              <Text style={styles.fieldLabel}>Depart</Text>
              <Pressable
                onPress={() => openCalendar("from")}
                style={styles.input}
                accessibilityRole="button"
                accessibilityLabel="Pick depart date"
                disabled={pending}
              >
                <Ionicons name="calendar-outline" size={16} color={colors.wordmark} />
                <Text
                  style={[styles.inputText, !selectedFrom && styles.inputPlaceholder]}
                  numberOfLines={1}
                >
                  {fromLabel}
                </Text>
              </Pressable>
              {errors.departDate ? (
                <Text style={styles.inlineError}>{errors.departDate}</Text>
              ) : null}
            </View>

            <View style={[styles.field, styles.dateField]}>
              <Text style={styles.fieldLabel}>
                Return <Text style={styles.fieldLabelMuted}>(Optional)</Text>
              </Text>
              <Pressable
                onPress={() => openCalendar("to")}
                style={styles.input}
                accessibilityRole="button"
                accessibilityLabel="Pick return date"
                disabled={pending}
              >
                <Ionicons name="calendar-outline" size={16} color={colors.wordmark} />
                <Text
                  style={[styles.inputText, !selectedTo && styles.inputPlaceholder]}
                  numberOfLines={1}
                >
                  {toLabel}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Luggage capacity (kg)</Text>
            <TextInput
              value={form.luggage_capacity_kg}
              onChangeText={(t) => {
                setForm((prev) => ({ ...prev, luggage_capacity_kg: t }));
                clearError("capacity");
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.placeholderText}
              style={[styles.textInput, !!errors.capacity && styles.inputError]}
              editable={!pending}
            />
            {errors.capacity ? <Text style={styles.inlineError}>{errors.capacity}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Notes <Text style={styles.fieldLabelMuted}>(Optional)</Text>
            </Text>
            <TextInput
              value={form.notes}
              onChangeText={(t) => setForm((prev) => ({ ...prev, notes: t }))}
              placeholder="Any notes for carriers…"
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

      {/* Calendar sub-modal — shared between Depart + Return */}
      <Modal
        visible={calendarTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarTarget(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setCalendarTarget(null)} />
        <View style={styles.calendarCenter} pointerEvents="box-none">
          <View style={styles.calendarSheet}>
            <View style={styles.calendarHeaderRow}>
              <Pressable
                onPress={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1),
                  )
                }
                style={styles.calendarNavButton}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>
              <Text style={styles.calendarTitle}>{formatMonthLabel(visibleMonth)}</Text>
              <Pressable
                onPress={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
                  )
                }
                style={styles.calendarNavButton}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((d) => (
                <Text key={d} style={styles.weekday}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {calendarCells.map((cell, i) => {
                const isPast = cell.date < calendarMin;
                const isFuture = cell.date > maxDate;
                const disabled = isPast || isFuture;
                const isSelected =
                  calendarTarget === "from"
                    ? sameDate(selectedFrom, cell.date)
                    : sameDate(selectedTo, cell.date);
                return (
                  <Pressable
                    key={i}
                    disabled={disabled}
                    onPress={() => handleSelectDate(cell.date)}
                    style={[
                      styles.cell,
                      isSelected && styles.cellSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled, selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        !cell.inMonth && styles.cellTextMuted,
                        disabled && styles.cellTextDisabled,
                        isSelected && styles.cellTextSelected,
                      ]}
                    >
                      {cell.date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
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
  dateRow: { flexDirection: "row", gap: 12 },
  dateField: { flex: 1 },
  fieldLabel: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  fieldLabelMuted: { color: colors.subtleText, fontWeight: "500" },

  input: {
    backgroundColor: colors.input,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputText: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "500", flex: 1 },
  inputPlaceholder: { color: colors.subtleText },
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
  inputError: { borderColor: colors.danger, backgroundColor: "rgba(220, 40, 40, 0.06)" },
  inlineError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },

  footer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  footerButton: { flex: 1 },

  // Calendar
  calendarCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  calendarSheet: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 14,
    gap: 10,
  },
  calendarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  weekday: {
    flex: 1,
    textAlign: "center",
    color: colors.subtleText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellSelected: { borderRadius: 999 },
  cellText: { color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: "600" },
  cellTextMuted: { color: colors.subtleText, opacity: 0.45 },
  cellTextDisabled: { color: colors.subtleText, opacity: 0.35 },
  cellTextSelected: {
    color: colors.white,
    backgroundColor: colors.wordmark,
    width: 36,
    height: 36,
    lineHeight: 36,
    textAlign: "center",
    borderRadius: 18,
    overflow: "hidden",
    fontWeight: "800",
  },
});
