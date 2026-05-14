import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  CompositeNavigationProp,
  useNavigation,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
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

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/feedback/appFeedback";
import { ANY_CITY, CityPicker } from "@/features/search/CityPicker";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { getErrorMessage, parcelsApi } from "@/services/api";
import { colors } from "@/theme/colors";
import { sanitizeDecimalInput } from "@/utils/inputSanitizers";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "SendParcelTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

type Direction = "IN_TO_US" | "US_TO_IN";
type WeightUnit = "kg" | "lb";
type SizeUnit = "cm" | "in";
type Currency = "USD" | "INR";

/**
 * Server-side `category` enum is fixed — keep this map in sync with the
 * `parcel_requests.category` check constraint. The free-text "Type of Parcel"
 * input gets mapped through this on submit; unknown values fall back to
 * "personal" (matches web `CustomerSendParcel.tsx:115-126`).
 */
const CATEGORY_MAP: Readonly<
  Record<string, "electronics" | "documents" | "clothing" | "food" | "medicine" | "personal">
> = {
  electronics: "electronics",
  documents: "documents",
  clothing: "clothing",
  food: "food",
  medicine: "medicine",
  personal: "personal",
};

/** Airline carry-on guidelines — same numbers web uses (lines 38-39). */
const MAX_SIZE_CM = { l: 55, w: 40, h: 20 } as const;
const MAX_SIZE_IN = { l: 22, w: 16, h: 8 } as const;

/** Format a `Date` as `YYYY-MM-DD` for the server's `delivery_by` field. */
function formatYmd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Friendlier display: "Apr 30, 2026". */
function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** "Tomorrow" / "Today" / "May 15" headline used inside calendar cells. */
function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

interface CalendarCell {
  date: Date;
  inMonth: boolean;
}

function buildCalendar(monthDate: Date): CalendarCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  // Start week on Monday (matches web's date-fns default).
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    cells.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      inMonth: false,
    });
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

export function SendParcelScreen() {
  const navigation = useNavigation<Nav>();

  // Hide the parent stack header — this screen has its own back row.
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [direction, setDirection] = useState<Direction>("IN_TO_US");
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [parcelType, setParcelType] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [weight, setWeight] = useState("");
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>("cm");
  const [sizeL, setSizeL] = useState("");
  const [sizeW, setSizeW] = useState("");
  const [sizeH, setSizeH] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryBy, setDeliveryBy] = useState<Date | null>(null);
  const [feeOffered, setFeeOffered] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

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

  const fromCountry = direction === "IN_TO_US" ? "IN" : "US";
  const toCountry = direction === "IN_TO_US" ? "US" : "IN";
  const fromLabel = direction === "IN_TO_US" ? "🇮🇳 IN, India" : "🇺🇸 US, USA";
  const toLabel = direction === "IN_TO_US" ? "🇺🇸 US, USA" : "🇮🇳 IN, India";
  const fromCities = direction === "IN_TO_US" ? INDIA_CITIES : USA_CITIES;
  const toCities = direction === "IN_TO_US" ? USA_CITIES : INDIA_CITIES;

  const handleSwapDirection = useCallback(() => {
    setDirection((d) => (d === "IN_TO_US" ? "US_TO_IN" : "IN_TO_US"));
    setFromCity("");
    setToCity("");
  }, []);

  const maxLimits = sizeUnit === "cm" ? MAX_SIZE_CM : MAX_SIZE_IN;
  const sizeErrors = {
    l: !!sizeL && parseFloat(sizeL) > maxLimits.l,
    w: !!sizeW && parseFloat(sizeW) > maxLimits.w,
    h: !!sizeH && parseFloat(sizeH) > maxLimits.h,
  };
  const hasSizeError = sizeErrors.l || sizeErrors.w || sizeErrors.h;

  const handleSubmit = useCallback(async () => {
    if (!fromCity) {
      showToast({ title: "Origin city required", variant: "error" });
      return;
    }
    if (!toCity) {
      showToast({ title: "Destination city required", variant: "error" });
      return;
    }
    const w = parseFloat(weight);
    if (!w || w <= 0) {
      showToast({ title: "Enter a valid weight", variant: "error" });
      return;
    }
    if (hasSizeError) {
      showToast({
        title: "Size exceeds carry-on limit",
        message: `Max ${maxLimits.l}×${maxLimits.w}×${maxLimits.h} ${sizeUnit}.`,
        variant: "error",
      });
      return;
    }
    if (!deliveryBy) {
      showToast({ title: "Pick a delivery-by date", variant: "error" });
      return;
    }
    if (deliveryBy < today) {
      showToast({ title: "Delivery date can't be in the past", variant: "error" });
      return;
    }
    if (deliveryBy > maxDate) {
      showToast({ title: "Delivery date must be within 12 months", variant: "error" });
      return;
    }
    const fee = parseFloat(feeOffered);
    if (!fee || fee <= 0) {
      showToast({ title: "Enter a valid cost offered", variant: "error" });
      return;
    }

    // Server contract: weight stored as kg internally; convert lb on the way in.
    const weightKg = weightUnit === "lb" ? w * 0.453592 : w;
    const isAnyFrom = fromCity === ANY_CITY;
    const isAnyTo = toCity === ANY_CITY;
    const categoryKey = parcelType.trim().toLowerCase();
    const category = CATEGORY_MAP[categoryKey] ?? "personal";

    setSubmitting(true);
    try {
      await parcelsApi.create({
        from_city: isAnyFrom ? "Any" : fromCity,
        from_country: fromCountry,
        to_city: isAnyTo ? "Any" : toCity,
        to_country: toCountry,
        category,
        weight_kg: Math.round(weightKg * 100) / 100,
        description:
          [
            parcelType.trim() ? `Type: ${parcelType.trim()}` : null,
            description.trim() || null,
            sizeL && sizeW && sizeH
              ? `Size: ${sizeL}×${sizeW}×${sizeH} ${sizeUnit}`
              : null,
          ]
            .filter(Boolean)
            .join(" | ") || undefined,
        delivery_by: formatYmd(deliveryBy),
        fee_offered: fee,
        fee_currency: currency,
        any_from: isAnyFrom,
        any_to: isAnyTo,
      });
      setSubmitted(true);
    } catch (err) {
      showToast({
        title: "Couldn't post request",
        message: getErrorMessage(err),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    fromCity,
    toCity,
    weight,
    weightUnit,
    hasSizeError,
    sizeUnit,
    sizeL,
    sizeW,
    sizeH,
    deliveryBy,
    today,
    maxDate,
    feeOffered,
    fromCountry,
    toCountry,
    parcelType,
    description,
    currency,
    maxLimits,
  ]);

  // ───────── Success state ─────────
  if (submitted) {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.successWrap}>
          <View style={styles.successIconBubble}>
            <Ionicons name="checkmark" size={40} color={colors.safe} />
          </View>
          <Text style={styles.successTitle}>Request Posted! 📦</Text>
          <Text style={styles.successBody}>
            Carriers on matching routes will be notified. Sit tight!
          </Text>
          <View style={styles.successButtons}>
            <Pressable
              onPress={() => navigation.navigate("Parcels")}
              style={[styles.button, styles.buttonPrimary]}
              accessibilityRole="button"
            >
              <Text style={styles.buttonPrimaryText}>View My Parcels</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate("Home")}
              style={[styles.button, styles.buttonSecondary]}
              accessibilityRole="button"
            >
              <Text style={styles.buttonSecondaryText}>Go Home</Text>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  // ───────── Form ─────────
  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Your Parcel Details</Text>
          <Text style={styles.subtitle}>
            Tell us where your parcel needs to go and we'll find the perfect
            carrier for you.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        {/* From location */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>From Location</Text>
          <View style={styles.countryChipRow}>
            <View style={styles.countryChip}>
              <Text style={styles.countryChipText}>{fromLabel}</Text>
            </View>
          </View>
          <CityPicker
            value={fromCity}
            onChange={setFromCity}
            cities={fromCities}
            placeholder="Select origin city"
          />
        </View>

        {/* Swap direction */}
        <View style={styles.swapRow}>
          <Pressable
            style={styles.swapButton}
            onPress={handleSwapDirection}
            accessibilityRole="button"
            accessibilityLabel="Swap direction"
          >
            <Ionicons name="swap-vertical-outline" size={16} color={colors.primary} />
            <Text style={styles.swapButtonText}>Swap Direction</Text>
          </Pressable>
        </View>

        {/* To location */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>To Location</Text>
          <View style={styles.countryChipRow}>
            <View style={styles.countryChip}>
              <Text style={styles.countryChipText}>{toLabel}</Text>
            </View>
          </View>
          <CityPicker
            value={toCity}
            onChange={setToCity}
            cities={toCities}
            placeholder="Select destination city"
          />
        </View>

        {/* Type of Parcel */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Type of Parcel</Text>
          <TextInput
            value={parcelType}
            onChangeText={setParcelType}
            placeholder="e.g. Documents, Electronics, Clothing, Food"
            placeholderTextColor={colors.subtleText}
            style={styles.input}
            autoCapitalize="words"
          />
        </View>

        {/* Parcel Size */}
        <View style={styles.field}>
          <View style={styles.unitToggleRow}>
            <UnitToggle<SizeUnit>
              options={[
                { value: "cm", label: "CM" },
                { value: "in", label: "Inches" },
              ]}
              value={sizeUnit}
              onChange={setSizeUnit}
            />
            <Text style={styles.fieldLabelInline}>
              Parcel Size <Text style={styles.fieldLabelMuted}>(Optional)</Text>
            </Text>
          </View>
          <View style={styles.sizeRow}>
            {(
              [
                { val: sizeL, set: setSizeL, label: `Length (${sizeUnit})`, ph: "L", err: sizeErrors.l },
                { val: sizeW, set: setSizeW, label: `Width (${sizeUnit})`, ph: "W", err: sizeErrors.w },
                { val: sizeH, set: setSizeH, label: `Height (${sizeUnit})`, ph: "H", err: sizeErrors.h },
              ] as const
            ).map(({ val, set, label, ph, err }) => (
              <View key={label} style={styles.sizeCell}>
                <Text style={styles.sizeCellLabel}>{label}</Text>
                <TextInput
                  value={val}
                  onChangeText={(v) => set(sanitizeDecimalInput(v, 4, 1))}
                  placeholder={ph}
                  placeholderTextColor={colors.subtleText}
                  keyboardType="decimal-pad"
                  style={[styles.input, err && styles.inputError]}
                />
              </View>
            ))}
          </View>
          <Text style={[styles.helperText, hasSizeError && styles.helperError]}>
            {hasSizeError
              ? `⚠️ Exceeds airline carry-on limit (${maxLimits.l}×${maxLimits.w}×${maxLimits.h} ${sizeUnit}). Consider checked baggage.`
              : `Airline carry-on max: ${maxLimits.l}×${maxLimits.w}×${maxLimits.h} ${sizeUnit}`}
          </Text>
        </View>

        {/* Weight */}
        <View style={styles.field}>
          <View style={styles.unitToggleRow}>
            <UnitToggle<WeightUnit>
              options={[
                { value: "kg", label: "KG" },
                { value: "lb", label: "LBS" },
              ]}
              value={weightUnit}
              onChange={setWeightUnit}
            />
            <Text style={styles.fieldLabelInline}>Parcel Weight</Text>
          </View>
          <TextInput
            value={weight}
            onChangeText={(v) => setWeight(sanitizeDecimalInput(v, 4, 2))}
            placeholder={`e.g. ${weightUnit === "kg" ? "2.5" : "5.5"}`}
            placeholderTextColor={colors.subtleText}
            keyboardType="decimal-pad"
            style={styles.input}
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Description <Text style={styles.fieldLabelMuted}>(Optional)</Text>
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your parcel briefly…"
            placeholderTextColor={colors.subtleText}
            style={[styles.input, styles.textarea]}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Delivery By */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Deliver By</Text>
          <Pressable
            style={[styles.input, styles.dateInput]}
            onPress={() => setCalendarOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Pick delivery deadline"
          >
            <Ionicons name="calendar-outline" size={16} color={colors.mutedText} />
            <Text
              style={[
                styles.dateInputText,
                !deliveryBy && { color: colors.subtleText },
              ]}
            >
              {deliveryBy ? formatDateLabel(deliveryBy) : "Pick a delivery deadline"}
            </Text>
          </Pressable>
          <Text style={styles.helperText}>
            Select the latest date you need this delivered by.
          </Text>
        </View>

        {/* Cost Offered */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Cost Offered 💰</Text>
          <View style={styles.costRow}>
            <CurrencyToggle value={currency} onChange={setCurrency} />
            <View style={styles.costInputWrap}>
              <Text style={styles.costSymbol}>
                {currency === "USD" ? "$" : "₹"}
              </Text>
              <TextInput
                value={feeOffered}
                onChangeText={(v) => setFeeOffered(sanitizeDecimalInput(v, 6, 2))}
                placeholder="e.g. 45"
                placeholderTextColor={colors.subtleText}
                keyboardType="decimal-pad"
                style={[styles.input, styles.costInput]}
              />
            </View>
          </View>
          <Text style={styles.helperText}>
            The amount you're willing to pay the carrier for delivery.
          </Text>
        </View>

        {/* Restricted items notice */}
        <View style={styles.warningBox}>
          <Ionicons
            name="warning"
            size={16}
            color={colors.warning}
            style={styles.warningIcon}
          />
          <View style={styles.warningBody}>
            <Text style={styles.warningTitle}>Restricted Items Notice</Text>
            <Text style={styles.warningText}>
              The following items are <Text style={styles.warningStrong}>not allowed</Text>:
              Liquids ({">"}100ml), Perishable food, Weapons, Illegal items, Live animals,
              Hazardous materials.
            </Text>
            <Text style={styles.warningText}>
              Medications require a valid prescription copy.
            </Text>
            <Text style={styles.warningText}>
              I confirm this parcel does not contain restricted or prohibited items.
            </Text>
          </View>
        </View>

        {/* Submit */}
        <View style={styles.submitRow}>
          <Pressable
            onPress={() => void handleSubmit()}
            disabled={submitting}
            style={[styles.submitButton, submitting && styles.buttonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Submit and find carriers"
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="cube-outline" size={16} color={colors.white} />
            )}
            <Text style={styles.submitButtonText}>
              {submitting ? "Posting…" : "📦 Submit & Find Carriers"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Inline calendar modal */}
      <CalendarModal
        open={calendarOpen}
        selected={deliveryBy}
        visibleMonth={visibleMonth}
        today={today}
        maxDate={maxDate}
        onSelect={(d) => {
          setDeliveryBy(d);
          setCalendarOpen(false);
        }}
        onChangeMonth={setVisibleMonth}
        onClose={() => setCalendarOpen(false)}
      />
    </Screen>
  );
}

// ───────────────────────── Sub-components ─────────────────────────

interface UnitToggleProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}

function UnitToggle<T extends string>({
  options,
  value,
  onChange,
}: Readonly<UnitToggleProps<T>>) {
  return (
    <View style={styles.unitToggle}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.unitToggleButton,
              active && styles.unitToggleButtonActive,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.unitToggleText,
                active && styles.unitToggleTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CurrencyToggle({
  value,
  onChange,
}: Readonly<{ value: Currency; onChange: (next: Currency) => void }>) {
  const options: ReadonlyArray<{ value: Currency; label: string }> = [
    { value: "USD", label: "🇺🇸 USD" },
    { value: "INR", label: "🇮🇳 INR" },
  ];
  return (
    <View style={styles.currencyToggle}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.currencyButton,
              active && styles.currencyButtonActive,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.currencyText,
                active && styles.currencyTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface CalendarModalProps {
  open: boolean;
  selected: Date | null;
  visibleMonth: Date;
  today: Date;
  maxDate: Date;
  onSelect: (d: Date) => void;
  onChangeMonth: (d: Date) => void;
  onClose: () => void;
}

function CalendarModal({
  open,
  selected,
  visibleMonth,
  today,
  maxDate,
  onSelect,
  onChangeMonth,
  onClose,
}: Readonly<CalendarModalProps>) {
  const cells = useMemo(() => buildCalendar(visibleMonth), [visibleMonth]);
  const monthLabel = formatMonthLabel(visibleMonth);

  const goPrev = () => {
    const next = new Date(visibleMonth);
    next.setMonth(next.getMonth() - 1);
    onChangeMonth(next);
  };
  const goNext = () => {
    const next = new Date(visibleMonth);
    next.setMonth(next.getMonth() + 1);
    onChangeMonth(next);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.calendarBackdrop} onPress={onClose} />
      <View style={styles.calendarSheet}>
        <View style={styles.calendarHeader}>
          <Pressable
            onPress={goPrev}
            style={styles.calendarNavButton}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.calendarTitle}>{monthLabel}</Text>
          <Pressable
            onPress={goNext}
            style={styles.calendarNavButton}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.calendarWeekRow}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={styles.calendarWeekday}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {cells.map((cell, i) => {
            const isPast = cell.date < today;
            const isFuture = cell.date > maxDate;
            const disabled = isPast || isFuture;
            const isSelected = sameDate(selected, cell.date);
            const isToday = sameDate(today, cell.date);
            return (
              <Pressable
                key={i}
                disabled={disabled}
                onPress={() => onSelect(cell.date)}
                style={[
                  styles.calendarCell,
                  isSelected && styles.calendarCellSelected,
                  isToday && !isSelected && styles.calendarCellToday,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected: isSelected }}
              >
                <Text
                  style={[
                    styles.calendarCellText,
                    !cell.inMonth && styles.calendarCellTextMuted,
                    disabled && styles.calendarCellTextDisabled,
                    isSelected && styles.calendarCellTextSelected,
                  ]}
                >
                  {cell.date.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.calendarFooter}>
          <Pressable
            onPress={onClose}
            style={[styles.button, styles.buttonSecondary]}
            accessibilityRole="button"
          >
            <Text style={styles.buttonSecondaryText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  headerRow: { marginTop: 8, marginBottom: 14, gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 8 },
  subtitle: { color: colors.mutedText, fontSize: 13, marginTop: 4, lineHeight: 18 },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 16,
    gap: 18,
  },

  field: { gap: 6 },
  fieldLabel: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  fieldLabelInline: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  fieldLabelMuted: { color: colors.mutedText, fontWeight: "500", textTransform: "none" },

  countryChipRow: { flexDirection: "row" },
  countryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.surfaceTintPrimary,
    marginBottom: 6,
  },
  countryChipText: { color: colors.primary, fontSize: 12, fontWeight: "700" },

  swapRow: { alignItems: "center" },
  swapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  swapButtonText: { color: colors.primary, fontSize: 12, fontWeight: "700" },

  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: colors.text,
    fontSize: 14,
  },
  inputError: { borderWidth: 1, borderColor: colors.danger },
  textarea: { minHeight: 84, paddingTop: 12 },
  dateInput: { flexDirection: "row", alignItems: "center", gap: 10 },
  dateInputText: { color: colors.text, fontSize: 14 },

  unitToggleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  unitToggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  unitToggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unitToggleButtonActive: { backgroundColor: colors.primary },
  unitToggleText: { color: colors.mutedText, fontSize: 11, fontWeight: "700" },
  unitToggleTextActive: { color: colors.white },

  sizeRow: { flexDirection: "row", gap: 10 },
  sizeCell: { flex: 1, gap: 4 },
  sizeCellLabel: { color: colors.subtleText, fontSize: 10 },

  helperText: { color: colors.mutedText, fontSize: 11, marginTop: 4 },
  helperError: { color: colors.danger, fontWeight: "700" },

  costRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  currencyToggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 2,
    gap: 2,
  },
  currencyButton: { paddingHorizontal: 10, paddingVertical: Platform.OS === "ios" ? 11 : 9, borderRadius: 10 },
  currencyButtonActive: { backgroundColor: colors.primary },
  currencyText: { color: colors.mutedText, fontSize: 12, fontWeight: "700" },
  currencyTextActive: { color: colors.white },
  costInputWrap: { flex: 1, position: "relative" },
  costSymbol: {
    position: "absolute",
    left: 12,
    top: Platform.OS === "ios" ? 12 : 10,
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "700",
    zIndex: 1,
  },
  costInput: { paddingLeft: 28 },

  warningBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(245, 159, 10, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(245, 159, 10, 0.25)",
  },
  warningIcon: { marginTop: 2 },
  warningBody: { flex: 1, gap: 4 },
  warningTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  warningText: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  warningStrong: { color: colors.text, fontWeight: "800" },

  submitRow: { alignItems: "center", marginTop: 4 },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  submitButtonText: { color: colors.white, fontSize: 14, fontWeight: "800" },

  // Buttons (success state)
  successWrap: { alignItems: "center", paddingTop: 32, gap: 12 },
  successIconBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(34, 195, 93, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
  successBody: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 19,
  },
  successButtons: { flexDirection: "row", gap: 10, marginTop: 18 },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 132,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  buttonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonSecondaryText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  buttonDisabled: { opacity: 0.6 },

  // Calendar modal
  calendarBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.4)" },
  calendarSheet: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "20%",
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  calendarTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  calendarWeekRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  calendarWeekday: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: colors.subtleText,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  calendarCellSelected: { backgroundColor: colors.primary },
  calendarCellToday: { borderWidth: 1, borderColor: colors.primary },
  calendarCellText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  calendarCellTextMuted: { color: colors.subtleText },
  calendarCellTextDisabled: { color: colors.subtleText, opacity: 0.4 },
  calendarCellTextSelected: { color: colors.white, fontWeight: "800" },
  calendarFooter: { alignItems: "flex-end", marginTop: 4 },

  // Suppress lint hint (referenced via JSX); ScrollView re-export kept for parity.
  _spacer: { height: 0 },
});

// Re-export so the file's ScrollView import isn't tree-shaken under Metro.
const _scrollViewKeepalive = ScrollView;
void _scrollViewKeepalive;
