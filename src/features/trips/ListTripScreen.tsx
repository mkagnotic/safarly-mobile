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
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { ANY_CITY, CityPicker } from "@/features/search/CityPicker";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { getErrorMessage, tripsApi } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { sanitizeDecimalInput, sanitizeDigitsOnly } from "@/utils/inputSanitizers";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "ListTripTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

type Direction = "IN_TO_US" | "US_TO_IN";
type DateMode = "single" | "range";
type WeightUnit = "kg" | "lb";
type SizeUnit = "cm" | "in";

/** Web parity (`CustomerListTrip.tsx:41-46`). */
const AIRLINES: readonly string[] = [
  "Air India",
  "United Airlines",
  "American Airlines",
  "Delta Air Lines",
  "Emirates",
  "Qatar Airways",
  "Etihad Airways",
  "Lufthansa",
  "British Airways",
  "Singapore Airlines",
  "Turkish Airlines",
  "KLM Royal Dutch",
  "Air France",
  "Cathay Pacific",
  "Japan Airlines",
];

/** Web parity (`CustomerListTrip.tsx:17-21`). */
const LANGUAGE_OPTIONS: readonly string[] = [
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Urdu",
  "Spanish",
  "French",
  "German",
  "Mandarin",
  "Japanese",
  "Korean",
  "Arabic",
  "Portuguese",
  "Russian",
];

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

function formatYmd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function sameDate(a: Date | null, b: Date): boolean {
  return (
    !!a &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface CalendarCell {
  date: Date;
  inMonth: boolean;
}

function buildCalendar(monthDate: Date): CalendarCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
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

export function ListTripScreen() {
  const navigation = useNavigation<Nav>();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [direction, setDirection] = useState<Direction>("IN_TO_US");
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [airline, setAirline] = useState("");
  const [airlineOpen, setAirlineOpen] = useState(false);

  const [dateMode, setDateMode] = useState<DateMode>("single");
  const [departDate, setDepartDate] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState<"depart" | "return" | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [sizeUnit, setSizeUnit] = useState<SizeUnit>("cm");
  const [sizeL, setSizeL] = useState("");
  const [sizeW, setSizeW] = useState("");
  const [sizeH, setSizeH] = useState("");

  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [maxWeight, setMaxWeight] = useState("");

  const [openToBuddy, setOpenToBuddy] = useState(false);
  const [buddyAge, setBuddyAge] = useState("");
  const [buddyLanguages, setBuddyLanguages] = useState<string[]>([]);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [buddyInterests, setBuddyInterests] = useState("");
  const [buddyLayover, setBuddyLayover] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  const handleAddBuddyLanguage = useCallback(
    (lang: string) => {
      // Defensive — the picker button is disabled at the cap.
      if (buddyLanguages.length >= 3) return;
      if (!buddyLanguages.includes(lang)) {
        setBuddyLanguages([...buddyLanguages, lang]);
      }
    },
    [buddyLanguages],
  );
  const handleRemoveBuddyLanguage = useCallback((lang: string) => {
    setBuddyLanguages((prev) => prev.filter((l) => l !== lang));
  }, []);

  const handleSubmit = useCallback(async () => {
    setFormError(null);
    if (!fromCity) {
      setFormError("Departure city is required.");
      return;
    }
    if (!toCity) {
      setFormError("Arrival city is required.");
      return;
    }
    if (!departDate) {
      setFormError("Pick a travel date.");
      return;
    }
    if (departDate < today) {
      setFormError("Travel date can't be in the past.");
      return;
    }
    if (departDate > maxDate) {
      setFormError("Travel date must be within 12 months.");
      return;
    }
    if (dateMode === "range" && returnDate) {
      if (returnDate > maxDate) {
        setFormError("Return date must be within 12 months.");
        return;
      }
      if (returnDate < departDate) {
        setFormError("Return date must be after departure.");
        return;
      }
    }
    const w = parseFloat(maxWeight);
    if (!w || w <= 0) {
      setFormError("Enter a valid maximum weight.");
      return;
    }

    const weightKg = weightUnit === "lb" ? w * 0.453592 : w;
    const isAnyFrom = fromCity === ANY_CITY;
    const isAnyTo = toCity === ANY_CITY;
    const sizeStr = sizeL && sizeW && sizeH ? `${sizeL}×${sizeW}×${sizeH} ${sizeUnit}` : null;
    const endDateStr = dateMode === "range" && returnDate ? formatYmd(returnDate) : null;

    setSubmitting(true);
    try {
      await tripsApi.create({
        from_city: isAnyFrom ? "Any" : fromCity,
        from_country: fromCountry,
        to_city: isAnyTo ? "Any" : toCity,
        to_country: toCountry,
        any_from: isAnyFrom,
        any_to: isAnyTo,
        travel_date: formatYmd(departDate),
        luggage_capacity_kg: Math.round(weightKg * 100) / 100,
        open_to_buddy: openToBuddy,
        airline: airline || undefined,
        buddy_age: openToBuddy && buddyAge ? buddyAge : undefined,
        buddy_languages:
          openToBuddy && buddyLanguages.length > 0 ? buddyLanguages : undefined,
        buddy_interests:
          openToBuddy && buddyInterests.trim() ? buddyInterests.trim() : undefined,
        buddy_layover:
          openToBuddy && buddyLayover.trim() ? buddyLayover.trim() : undefined,
        notes:
          [
            sizeStr ? `Max parcel size: ${sizeStr}` : null,
            endDateStr ? `Return date: ${endDateStr}` : null,
            weightUnit === "lb" ? `Original weight: ${maxWeight} lbs` : null,
            sizeUnit === "in" ? `Size unit: inches` : null,
          ]
            .filter(Boolean)
            .join(" | ") || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setFormError(`Couldn't post trip. ${getErrorMessage(err)}`);
    } finally {
      setSubmitting(false);
    }
  }, [
    fromCity,
    toCity,
    departDate,
    returnDate,
    dateMode,
    today,
    maxDate,
    maxWeight,
    weightUnit,
    sizeL,
    sizeW,
    sizeH,
    sizeUnit,
    fromCountry,
    toCountry,
    openToBuddy,
    airline,
    buddyAge,
    buddyLanguages,
    buddyInterests,
    buddyLayover,
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
          <Text style={styles.title}>Trip Posted</Text>
        </View>
        <View style={styles.successWrap}>
          <View style={styles.successIconBubble}>
            <Ionicons name="airplane-outline" size={40} color={colors.safe} />
          </View>
          <Text style={styles.successTitle}>You're all set</Text>
          <Text style={styles.successBody}>
            We're searching for the best parcel matches for your route.
            {openToBuddy
              ? " A Travel Buddy listing was also created — fellow travelers can now find you!"
              : ""}
          </Text>
          <View style={styles.successButtons}>
            <AppButton
              label="View my travels"
              onPress={() => navigation.navigate("Parcels")}
              gradientColors={[colors.ctaAccent, colors.ctaAccent]}
              style={styles.successButtonFlex}
            />
            <AppButton
              label="Go home"
              variant="secondary"
              onPress={() => navigation.navigate("Home")}
              style={styles.successButtonFlex}
            />
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
        <Text style={styles.title}>Your Travel Details</Text>
      </View>
      <Text style={styles.subtitle}>
        Share your travel plans and we'll find the best parcel matches for you.
      </Text>

      {formError ? (
        <View style={styles.bannerSlot}>
          <FormBanner message={formError} onDismiss={() => setFormError(null)} />
        </View>
      ) : null}

      <View style={styles.card}>
        {/* From */}
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
            placeholder="Select departure city"
          />
        </View>

        {/* Swap */}
        <View style={styles.swapRow}>
          <Pressable
            style={styles.swapButton}
            onPress={handleSwapDirection}
            accessibilityRole="button"
            accessibilityLabel="Swap direction"
          >
            <Ionicons name="swap-vertical-outline" size={16} color={colors.wordmark} />
            <Text style={styles.swapButtonText}>Swap Direction</Text>
          </Pressable>
        </View>

        {/* To */}
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
            placeholder="Select arrival city"
          />
        </View>

        {/* Airline */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Airline <Text style={styles.fieldLabelMuted}>(Optional)</Text>
          </Text>
          <Pressable
            style={[styles.input, styles.selectInput]}
            onPress={() => setAirlineOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Pick airline"
          >
            <Text
              style={[
                styles.selectInputText,
                !airline && { color: colors.subtleText },
              ]}
            >
              {airline || "Select airline"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.mutedText} />
          </Pressable>
          <Text style={styles.helperText}>
            Helps match with Travel Buddies on the same flight.
          </Text>
        </View>

        {/* Travel Date */}
        <View style={styles.field}>
          <View style={styles.unitToggleRow}>
            <UnitToggle<DateMode>
              options={[
                { value: "single", label: "Single" },
                { value: "range", label: "Range" },
              ]}
              value={dateMode}
              onChange={(next) => {
                setDateMode(next);
                if (next === "single") setReturnDate(null);
              }}
            />
            <Text style={styles.fieldLabelInline}>Travel Date</Text>
          </View>

          {dateMode === "single" ? (
            <Pressable
              style={[styles.input, styles.selectInput]}
              onPress={() => setCalendarOpen("depart")}
              accessibilityRole="button"
              accessibilityLabel="Pick travel date"
            >
              <Ionicons name="calendar-outline" size={16} color={colors.mutedText} />
              <Text
                style={[
                  styles.selectInputText,
                  !departDate && { color: colors.subtleText },
                ]}
              >
                {departDate ? formatDateLabel(departDate) : "Pick a date"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.rangeRow}>
              <Pressable
                style={[styles.input, styles.selectInput, styles.rangeCell]}
                onPress={() => setCalendarOpen("depart")}
                accessibilityRole="button"
                accessibilityLabel="Pick departure date"
              >
                <Ionicons name="calendar-outline" size={16} color={colors.mutedText} />
                <Text
                  style={[
                    styles.selectInputText,
                    !departDate && { color: colors.subtleText },
                  ]}
                  numberOfLines={2}
                >
                  {departDate ? formatDateLabel(departDate) : "Departure"}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.input, styles.selectInput, styles.rangeCell]}
                onPress={() => setCalendarOpen("return")}
                accessibilityRole="button"
                accessibilityLabel="Pick return date"
              >
                <Ionicons name="calendar-outline" size={16} color={colors.mutedText} />
                <Text
                  style={[
                    styles.selectInputText,
                    !returnDate && { color: colors.subtleText },
                  ]}
                  numberOfLines={2}
                >
                  {returnDate ? formatDateLabel(returnDate) : "Return"}
                </Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.helperText}>
            You can select dates up to 12 months from today.
          </Text>
        </View>

        {/* Max parcel size */}
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
            <Text style={styles.fieldLabelInline}>Max Parcel Size I Can Carry</Text>
          </View>
          <View style={styles.sizeRow}>
            {(
              [
                { val: sizeL, set: setSizeL, label: `Length (${sizeUnit})`, ph: "L" },
                { val: sizeW, set: setSizeW, label: `Width (${sizeUnit})`, ph: "W" },
                { val: sizeH, set: setSizeH, label: `Height (${sizeUnit})`, ph: "H" },
              ] as const
            ).map(({ val, set, label, ph }) => (
              <View key={label} style={styles.sizeCell}>
                <Text style={styles.sizeCellLabel}>{label}</Text>
                <TextInput
                  value={val}
                  onChangeText={(v) => set(sanitizeDecimalInput(v, 4, 1))}
                  placeholder={ph}
                  placeholderTextColor={colors.subtleText}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
            ))}
          </View>
          <Text style={styles.helperText}>
            Optional — helps senders know if their parcel fits.
          </Text>
        </View>

        {/* Max weight */}
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
            <Text style={styles.fieldLabelInline}>Max Weight I Can Carry</Text>
          </View>
          <TextInput
            value={maxWeight}
            onChangeText={(v) => setMaxWeight(sanitizeDecimalInput(v, 4, 2))}
            placeholder={weightUnit === "kg" ? "e.g. 5" : "e.g. 11"}
            placeholderTextColor={colors.subtleText}
            keyboardType="decimal-pad"
            style={styles.input}
          />
        </View>

        {/* Open to buddy opt-in */}
        <Pressable
          onPress={() => setOpenToBuddy((v) => !v)}
          style={styles.buddyOptInRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: openToBuddy }}
        >
          <View style={[styles.checkbox, openToBuddy && styles.checkboxChecked]}>
            {openToBuddy ? (
              <Ionicons name="checkmark" size={14} color={colors.white} />
            ) : null}
          </View>
          <View style={styles.buddyOptInText}>
            <Text style={styles.buddyOptInTitle}>
              I'm also open to being a Travel Buddy on this trip
            </Text>
            <Text style={styles.buddyOptInBody}>
              This will create a separate Travel Buddy listing so other travelers can connect with you for companionship on this route.
            </Text>
          </View>
        </Pressable>

        {/* Buddy companion fields */}
        {openToBuddy ? (
          <View style={styles.buddyPanel}>
            <Text style={styles.buddyPanelHeading}>Travel companion details</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Age <Text style={styles.fieldLabelMuted}>(Optional)</Text>
              </Text>
              <TextInput
                value={buddyAge}
                onChangeText={(v) => setBuddyAge(sanitizeDigitsOnly(v, 3))}
                placeholder="e.g. 28"
                placeholderTextColor={colors.subtleText}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Languages{" "}
                <Text style={styles.fieldLabelMuted}>(Optional, up to 3)</Text>
              </Text>
              {buddyLanguages.length > 0 ? (
                <View style={styles.chipsRow}>
                  {buddyLanguages.map((lang) => (
                    <View key={lang} style={styles.chip}>
                      <Text style={styles.chipText}>{lang}</Text>
                      <Pressable
                        onPress={() => handleRemoveBuddyLanguage(lang)}
                        hitSlop={6}
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
                disabled={buddyLanguages.length >= 3}
                accessibilityRole="button"
                accessibilityLabel="Add a language"
              >
                <Text
                  style={[
                    styles.selectInputText,
                    { color: colors.subtleText },
                  ]}
                >
                  {buddyLanguages.length >= 3 ? "Max 3 selected" : "Add a language"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.mutedText} />
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Interests <Text style={styles.fieldLabelMuted}>(Optional)</Text>
              </Text>
              <TextInput
                value={buddyInterests}
                onChangeText={setBuddyInterests}
                placeholder="e.g. Photography, Hiking, Food"
                placeholderTextColor={colors.subtleText}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Layover <Text style={styles.fieldLabelMuted}>(Optional)</Text>
              </Text>
              <TextInput
                value={buddyLayover}
                onChangeText={setBuddyLayover}
                placeholder="e.g. New York — 4h layover"
                placeholderTextColor={colors.subtleText}
                style={styles.input}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.submitRow}>
          <AppButton
            label={submitting ? "Finding matches…" : "Submit & find matches"}
            onPress={() => void handleSubmit()}
            disabled={submitting}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            leftIcon={
              submitting ? <ActivityIndicator size="small" color={colors.white} /> : undefined
            }
          />
        </View>
      </View>

      {/* Airline picker modal */}
      <ListPickerModal
        open={airlineOpen}
        title="Select airline"
        options={AIRLINES}
        selected={airline}
        onSelect={(a) => {
          setAirline(a);
          setAirlineOpen(false);
        }}
        onClose={() => setAirlineOpen(false)}
      />

      {/* Language picker modal */}
      <ListPickerModal
        open={languagePickerOpen}
        title="Add a language"
        options={LANGUAGE_OPTIONS.filter((l) => !buddyLanguages.includes(l))}
        selected=""
        onSelect={(l) => {
          handleAddBuddyLanguage(l);
          setLanguagePickerOpen(false);
        }}
        onClose={() => setLanguagePickerOpen(false)}
      />

      {/* Calendar */}
      <CalendarModal
        open={calendarOpen !== null}
        title={calendarOpen === "return" ? "Pick return date" : "Pick travel date"}
        selected={calendarOpen === "return" ? returnDate : departDate}
        visibleMonth={visibleMonth}
        today={calendarOpen === "return" && departDate ? departDate : today}
        maxDate={maxDate}
        onSelect={(d) => {
          if (calendarOpen === "return") setReturnDate(d);
          else setDepartDate(d);
          setCalendarOpen(null);
        }}
        onChangeMonth={setVisibleMonth}
        onClose={() => setCalendarOpen(null)}
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

interface ListPickerModalProps {
  open: boolean;
  title: string;
  options: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

function ListPickerModal({
  open,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: Readonly<ListPickerModalProps>) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.pickerSheet}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Ionicons name="close" size={20} color={colors.mutedText} />
          </Pressable>
        </View>
        <FlatList
          data={options}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const isSel = item === selected;
            return (
              <Pressable
                onPress={() => onSelect(item)}
                style={[styles.pickerRow, isSel && styles.pickerRowSelected]}
                accessibilityRole="button"
              >
                <Text style={[styles.pickerRowText, isSel && styles.pickerRowTextSelected]}>
                  {item}
                </Text>
                {isSel ? (
                  <Ionicons name="checkmark" size={16} color={colors.wordmark} />
                ) : null}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.pickerSeparator} />}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
  );
}

interface CalendarModalProps {
  open: boolean;
  title: string;
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
  title,
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
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.calendarSheet}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Ionicons name="close" size={20} color={colors.mutedText} />
          </Pressable>
        </View>
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
      </View>
    </Modal>
  );
}

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 34,
    marginTop: 16,
    marginBottom: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 14, lineHeight: 20, fontWeight: "500", marginBottom: 22 },
  bannerSlot: { marginBottom: 14 },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 16,
    gap: 18,
  },

  field: { gap: 8 },
  fieldLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
  fieldLabelInline: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
  fieldLabelMuted: { color: colors.subtleText, fontWeight: "500" },

  countryChipRow: { flexDirection: "row" },
  countryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.surfaceTintPrimary,
    marginBottom: 6,
  },
  countryChipText: { color: colors.wordmark, fontSize: 12, lineHeight: 16, fontWeight: "700" },

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
  swapButtonText: { color: colors.wordmark, fontSize: 13, lineHeight: 18, fontWeight: "700" },

  // Match AppInput's visual recipe: input bg + 1px wordmark-tinted border,
  // 12 radius, paddingVertical 12, fontSize 15.
  input: {
    backgroundColor: colors.input,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: colors.text,
    fontSize: 15,
  },
  selectInput: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  selectInputText: { color: colors.text, fontSize: 15, lineHeight: 22, flex: 1 },

  rangeRow: { flexDirection: "row", gap: 8 },
  rangeCell: { flex: 1 },

  unitToggleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  unitToggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  unitToggleButton: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  unitToggleButtonActive: { backgroundColor: colors.wordmark },
  unitToggleText: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  unitToggleTextActive: { color: colors.white },

  sizeRow: { flexDirection: "row", gap: 10 },
  sizeCell: { flex: 1, gap: 6 },
  sizeCellLabel: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "600" },

  helperText: { color: colors.mutedText, fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: 6 },

  // Buddy opt-in
  buddyOptInRow: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "flex-start",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.ctaAccent,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.ctaAccent, borderColor: colors.ctaAccent },
  buddyOptInText: { flex: 1, gap: 4 },
  buddyOptInTitle: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  buddyOptInBody: { color: colors.mutedText, fontSize: 13, lineHeight: 19, fontWeight: "500" },

  buddyPanel: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.surfaceTintPrimary,
    borderWidth: 1,
    borderColor: primaryTint.stroke35,
    gap: 16,
  },
  buddyPanelHeading: {
    color: colors.wordmark,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: "700" },

  submitRow: { marginTop: 4 },

  // Success
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
  successTitle: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  successBody: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 320,
  },
  successButtons: { flexDirection: "row", alignSelf: "stretch", gap: 10, marginTop: 18 },
  successButtonFlex: { flex: 1 },

  // Modal sheets shared
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.4)" },
  pickerSheet: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    maxHeight: "70%",
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerTitle: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  pickerRowSelected: { backgroundColor: colors.surfaceTintPrimary, borderRadius: 8 },
  pickerRowText: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  pickerRowTextSelected: { color: colors.wordmark, fontWeight: "800" },
  pickerSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  // Calendar
  calendarSheet: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "12%",
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
    marginVertical: 8,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  calendarTitle: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  calendarWeekRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  calendarWeekday: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: colors.subtleText,
    fontSize: 10,
    lineHeight: 14,
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
  calendarCellSelected: { backgroundColor: colors.wordmark },
  calendarCellToday: { borderWidth: 1, borderColor: colors.wordmark },
  calendarCellText: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  calendarCellTextMuted: { color: colors.subtleText },
  calendarCellTextDisabled: { color: colors.subtleText, opacity: 0.4 },
  calendarCellTextSelected: { color: colors.white, fontWeight: "800" },
});
