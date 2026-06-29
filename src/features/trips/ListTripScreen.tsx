import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  CompositeNavigationProp,
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { DateField, DateModeToggle, LocationCard, SectionCard } from "@/components/ui/FormSection";
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

type Country = "IN" | "US";
type DateMode = "single" | "range";
type WeightUnit = "kg" | "lb";
type SizeUnit = "cm" | "in";

/** Keys for fields that can carry an inline validation error. */
type FieldKey = "fromCity" | "toCity" | "departDate" | "returnDate" | "maxWeight" | "age";

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

/** Airline carry-on limits — same numbers web uses (`airlineLimits.ts`). */
const MAX_SIZE_CM = { l: 55, w: 40, h: 20 } as const;
const MAX_SIZE_IN = { l: 22, w: 16, h: 8 } as const;
const MAX_WEIGHT_KG = 23;
const MAX_WEIGHT_LB = 50;
const WEIGHT_LIMIT_LABEL = `${MAX_WEIGHT_KG} kg (${MAX_WEIGHT_LB} lb)`;

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

  const [fromCountry, setFromCountry] = useState<Country>("IN");
  const [toCountry, setToCountry] = useState<Country>("US");
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

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  // Section Y offsets tracked via `onLayout` on the section wrappers (direct
  // children of the ScrollView) — avoids the Fabric measureLayout pitfall.
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionYs = useRef<{
    section1: number;
    section2: number;
    section3: number;
    section4: number;
  }>({
    section1: 0,
    section2: 0,
    section3: 0,
    section4: 0,
  });
  const fieldToSection: Record<FieldKey, "section1" | "section2" | "section3" | "section4"> = {
    fromCity: "section1",
    toCity: "section1",
    departDate: "section2",
    returnDate: "section2",
    maxWeight: "section3",
    age: "section4",
  };

  const clearFieldError = useCallback((key: FieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const resetForm = useCallback(() => {
    setFromCountry("IN");
    setToCountry("US");
    setFromCity("");
    setToCity("");
    setAirline("");
    setAirlineOpen(false);
    setDateMode("single");
    setDepartDate(null);
    setReturnDate(null);
    setCalendarOpen(null);
    setSizeUnit("cm");
    setSizeL("");
    setSizeW("");
    setSizeH("");
    setWeightUnit("kg");
    setMaxWeight("");
    setOpenToBuddy(false);
    setBuddyAge("");
    setBuddyLanguages([]);
    setLanguagePickerOpen(false);
    setBuddyInterests("");
    setBuddyLayover("");
    setSubmitting(false);
    setSubmitted(false);
    setFormError(null);
    setFieldErrors({});
  }, []);

  // Ref so the focus cleanup reads the latest `submitted` without re-binding.
  const submittedRef = useRef(submitted);
  submittedRef.current = submitted;
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Validation feedback is transient; field values are preserved so
        // drafts survive a tab switch. A completed submission wipes everything.
        setFormError(null);
        setFieldErrors({});
        if (submittedRef.current) resetForm();
      };
    }, [resetForm]),
  );

  const scrollToField = useCallback((key: FieldKey) => {
    const sectionKey = fieldToSection[key];
    const y = sectionYs.current[sectionKey];
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    // fieldToSection is module-scope-stable but TS demands ref/value deps
    // here; including it adds no real cost.
  }, [fieldToSection]);

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

  const fromFlag = fromCountry === "IN" ? "🇮🇳" : "🇺🇸";
  const toFlag = toCountry === "IN" ? "🇮🇳" : "🇺🇸";
  const fromCountryName = fromCountry === "IN" ? "India" : "United States";
  const toCountryName = toCountry === "IN" ? "India" : "United States";
  const fromCities = fromCountry === "IN" ? INDIA_CITIES : USA_CITIES;
  const toCities = toCountry === "IN" ? INDIA_CITIES : USA_CITIES;

  const toggleFromCountry = useCallback(() => {
    setFromCountry((c) => (c === "IN" ? "US" : "IN"));
    setFromCity("");
    clearFieldError("fromCity");
  }, [clearFieldError]);

  const toggleToCountry = useCallback(() => {
    setToCountry((c) => (c === "IN" ? "US" : "IN"));
    setToCity("");
    clearFieldError("toCity");
  }, [clearFieldError]);

  const handleAddBuddyLanguage = useCallback(
    (lang: string) => {
      if (buddyLanguages.length >= 3) return; // picker button is disabled at the cap, but guard anyway

      if (!buddyLanguages.includes(lang)) {
        setBuddyLanguages([...buddyLanguages, lang]);
      }
    },
    [buddyLanguages],
  );
  const handleRemoveBuddyLanguage = useCallback((lang: string) => {
    setBuddyLanguages((prev) => prev.filter((l) => l !== lang));
  }, []);

  // Live size check — flags any over-limit dimension and blocks submit (web §3.2).
  const maxLimits = sizeUnit === "cm" ? MAX_SIZE_CM : MAX_SIZE_IN;
  const sizeErrors = {
    l: !!sizeL && parseFloat(sizeL) > maxLimits.l,
    w: !!sizeW && parseFloat(sizeW) > maxLimits.w,
    h: !!sizeH && parseFloat(sizeH) > maxLimits.h,
  };
  const hasSizeError = sizeErrors.l || sizeErrors.w || sizeErrors.h;

  const handleSubmit = useCallback(async () => {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (!fromCity) errors.fromCity = "Select a departure city";
    if (!toCity) errors.toCity = "Select an arrival city";
    if (!departDate) {
      errors.departDate = "Pick a travel date";
    } else if (departDate < today) {
      errors.departDate = "Can't be in the past";
    } else if (departDate > maxDate) {
      errors.departDate = "Must be within 12 months";
    }
    if (dateMode === "range" && returnDate) {
      if (returnDate > maxDate) {
        errors.returnDate = "Must be within 12 months";
      } else if (departDate && returnDate < departDate) {
        errors.returnDate = "Must be after departure";
      }
    }
    const w = parseFloat(maxWeight);
    if (!w || w <= 0) {
      errors.maxWeight = "Enter a valid weight";
    } else if (w > (weightUnit === "kg" ? MAX_WEIGHT_KG : MAX_WEIGHT_LB)) {
      errors.maxWeight = `Exceeds airline limit of ${WEIGHT_LIMIT_LABEL} per item`;
    }

    if (openToBuddy && buddyAge !== "") {
      const n = Number(buddyAge);
      if (!Number.isInteger(n) || n < 18 || n > 120) {
        errors.age = "Age must be between 18 and 120";
      }
    }

    if (Object.keys(errors).length > 0 || hasSizeError) {
      setFieldErrors(errors);
      setFormError(
        hasSizeError
          ? `Size exceeds airline carry-on limit (max ${maxLimits.l}×${maxLimits.w}×${maxLimits.h} ${sizeUnit}). Fix the highlighted fields.`
          : "Please fix the highlighted fields before continuing.",
      );
      const order: FieldKey[] = [
        "fromCity",
        "toCity",
        "departDate",
        "returnDate",
        "maxWeight",
        "age",
      ];
      const firstKey = order.find((k) => errors[k]);
      if (firstKey) scrollToField(firstKey);
      else if (hasSizeError) scrollToField("maxWeight"); // size lives in same section
      return;
    }

    if (!departDate) return; // narrow for TS — guarded above


    setFieldErrors({});
    setFormError(null);

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
        travel_date_from: formatYmd(departDate),
        travel_date_to: endDateStr ?? formatYmd(departDate),
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
    hasSizeError,
    maxLimits,
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
    scrollToField,
  ]);

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
          <Text style={styles.title}>Trip posted</Text>
        </View>
        <View style={styles.successWrap}>
          <View style={styles.successIconBubble}>
            <Ionicons name="checkmark" size={36} color={colors.safe} />
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

  const section1Complete = !!fromCity && !!toCity;
  const section2Complete = !!departDate && (dateMode === "single" || !!returnDate);
  const section3Complete = Number(maxWeight) > 0;
  const section4Complete = openToBuddy;

  // 4 required fields; date-range adds the return date as the 5th.
  const requiredTotal = dateMode === "range" ? 5 : 4;
  const requiredCompleted =
    (fromCity ? 1 : 0) +
    (toCity ? 1 : 0) +
    (departDate ? 1 : 0) +
    (dateMode === "range" && returnDate ? 1 : 0) +
    (Number(maxWeight) > 0 ? 1 : 0);
  const progressPct = Math.round((requiredCompleted / requiredTotal) * 100);

  return (
    <Screen scroll={false}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Your travel details</Text>
        </View>
        <Text style={styles.subtitle}>
          Share your travel plans and we'll find the best parcel matches for you.
        </Text>

      {/* Progress bar — % of required fields complete (4 required, 5 in date-range mode). */}
      <View style={styles.progressBlock}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {requiredCompleted} of {requiredTotal} required fields complete
        </Text>
      </View>

      {formError ? (
        <View style={styles.bannerSlot}>
          <FormBanner message={formError} onDismiss={() => setFormError(null)} />
        </View>
      ) : null}

      {/* ───────── Section 1 — Where are you going? ───────── */}
      <View
        onLayout={(e) => {
          sectionYs.current.section1 = e.nativeEvent.layout.y;
        }}
      >
        <SectionCard
          index={1}
          title="Where are you going?"
          subtitle="Set your departure and destination"
          complete={section1Complete}
          hasError={!!fieldErrors.fromCity || !!fieldErrors.toCity}
        >
          <Text style={styles.fieldLabel}>From</Text>
          <LocationCard
            flag={fromFlag}
            label={fromCountryName}
            filled
            onToggle={toggleFromCountry}
          />
          <View>
            <CityPicker
              value={fromCity}
              onChange={(v) => {
                setFromCity(v);
                clearFieldError("fromCity");
              }}
              cities={fromCities}
              placeholder="Select departure city"
              variant="card"
              invalid={!!fieldErrors.fromCity}
            />
            {fieldErrors.fromCity ? (
              <Text style={styles.inlineError}>{fieldErrors.fromCity}</Text>
            ) : null}
          </View>

          <Text style={styles.fieldLabel}>To</Text>
          <LocationCard
            flag={toFlag}
            label={toCountryName}
            filled
            onToggle={toggleToCountry}
          />
          <View>
            <CityPicker
              value={toCity}
              onChange={(v) => {
                setToCity(v);
                clearFieldError("toCity");
              }}
              cities={toCities}
              placeholder="Select arrival city"
              variant="card"
              invalid={!!fieldErrors.toCity}
            />
            {fieldErrors.toCity ? (
              <Text style={styles.inlineError}>{fieldErrors.toCity}</Text>
            ) : null}
          </View>
        </SectionCard>
      </View>

      {/* ───────── Section 2 — When are you flying? ───────── */}
      <View
        onLayout={(e) => {
          sectionYs.current.section2 = e.nativeEvent.layout.y;
        }}
      >
        <SectionCard
          index={2}
          title="When are you flying?"
          subtitle="Travel dates and flight info"
          complete={section2Complete}
          hasError={!!fieldErrors.departDate || !!fieldErrors.returnDate}
        >
          <DateModeToggle<DateMode>
            options={[
              { value: "single", label: "Single Date" },
              { value: "range", label: "Date Range" },
            ]}
            value={dateMode}
            onChange={(next) => {
              setDateMode(next);
              if (next === "single") setReturnDate(null);
            }}
          />

          <View style={styles.dateRow}>
            <View style={styles.dateRowCell}>
              <DateField
                label="Departure"
                value={departDate ? formatDateLabel(departDate) : null}
                placeholder="Select date"
                onPress={() => setCalendarOpen("depart")}
                error={fieldErrors.departDate}
              />
            </View>
            <View style={styles.dateRowCell}>
              <DateField
                label="Return"
                value={returnDate ? formatDateLabel(returnDate) : null}
                placeholder="Select date"
                onPress={() => setCalendarOpen("return")}
                disabled={dateMode === "single"}
                error={fieldErrors.returnDate}
              />
            </View>
          </View>
        <Text style={styles.helperText}>You can book up to 12 months ahead.</Text>

        <View style={styles.airlineLabelRow}>
          <Text style={styles.fieldLabel}>Airline</Text>
          <View style={styles.optionalPill}>
            <Text style={styles.optionalPillText}>Optional</Text>
          </View>
          <View style={styles.flexSpacer} />
          <Ionicons name="help-circle-outline" size={16} color={colors.mutedText} />
        </View>
        <Pressable
          style={[styles.input, styles.selectInput, styles.airlineSelect]}
          onPress={() => setAirlineOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Pick airline"
        >
          <Ionicons name="airplane-outline" size={16} color={colors.wordmark} />
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
          We'll match you with Travel Buddies on the same flight.
        </Text>
        </SectionCard>
      </View>

      {/* ───────── Section 3 — What can you carry? ───────── */}
      <View
        onLayout={(e) => {
          sectionYs.current.section3 = e.nativeEvent.layout.y;
        }}
      >
        <SectionCard
          index={3}
          title="What can you carry?"
          subtitle="Help senders find the right match"
          complete={section3Complete}
          hasError={!!fieldErrors.maxWeight || hasSizeError}
        >
        <View style={styles.labelToggleRow}>
          <Text style={styles.fieldLabel}>Max Parcel Size</Text>
          <View style={styles.optionalPill}>
            <Text style={styles.optionalPillText}>Optional</Text>
          </View>
          <View style={styles.flexSpacer} />
          <UnitToggle<SizeUnit>
            options={[
              { value: "cm", label: "CM" },
              { value: "in", label: "Inches" },
            ]}
            value={sizeUnit}
            onChange={setSizeUnit}
          />
        </View>
        <View style={styles.sizeRow}>
          {(
            [
              { val: sizeL, set: setSizeL, label: "Length", ph: `0 ${sizeUnit}`, err: sizeErrors.l },
              { val: sizeW, set: setSizeW, label: "Width", ph: `0 ${sizeUnit}`, err: sizeErrors.w },
              { val: sizeH, set: setSizeH, label: "Height", ph: `0 ${sizeUnit}`, err: sizeErrors.h },
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
            ? `Exceeds airline carry-on limit (${maxLimits.l}×${maxLimits.w}×${maxLimits.h} ${sizeUnit}). Consider checked baggage.`
            : "Optional — helps senders know if their parcel will fit."}
        </Text>

        <View style={[styles.labelToggleRow, styles.labelToggleRowGap]}>
          <Text style={styles.fieldLabel}>Max Weight You Can Carry</Text>
          <View style={styles.flexSpacer} />
          <UnitToggle<WeightUnit>
            options={[
              { value: "kg", label: "KG" },
              { value: "lb", label: "LBS" },
            ]}
            value={weightUnit}
            onChange={setWeightUnit}
          />
        </View>
        <View>
          <TextInput
            value={maxWeight}
            onChangeText={(v) => {
              setMaxWeight(sanitizeDecimalInput(v, 4, 2));
              clearFieldError("maxWeight");
            }}
            placeholder={weightUnit === "kg" ? "0 kg" : "0 lb"}
            placeholderTextColor={colors.subtleText}
            keyboardType="decimal-pad"
            style={[styles.input, fieldErrors.maxWeight && styles.inputError]}
          />
          {fieldErrors.maxWeight ? (
            <Text style={styles.inlineError}>{fieldErrors.maxWeight}</Text>
          ) : null}
        </View>
        <Text style={styles.helperText}>
          Most travelers can carry 5–15 kg comfortably.
        </Text>
        </SectionCard>
      </View>

      {/* ───────── Section 4 — Looking for company? ───────── */}
      <View
        onLayout={(e) => {
          sectionYs.current.section4 = e.nativeEvent.layout.y;
        }}
      >
      <SectionCard
        index={4}
        title="Looking for company?"
        subtitle="Travel Buddies are travelers going your way"
        complete={section4Complete}
        hasError={!!fieldErrors.age}
      >
        <View style={styles.buddyToggleCard}>
          <View style={styles.buddyToggleText}>
            <Text style={styles.buddyOptInTitle}>I'm open to being a Travel Buddy</Text>
            <Text style={styles.buddyOptInBody}>
              Connect with travelers on the same route for companionship.
            </Text>
          </View>
          <Switch
            value={openToBuddy}
            onValueChange={setOpenToBuddy}
            trackColor={{ false: colors.border, true: colors.wordmark }}
            thumbColor={colors.white}
            ios_backgroundColor={colors.border}
            accessibilityLabel="Open to being a Travel Buddy"
          />
        </View>
        <Text style={styles.helperText}>
          You'll only see parcel-carrying matches.
        </Text>

        {openToBuddy ? (
          <View style={styles.buddyPanel}>
            <Text style={styles.buddyPanelHeading}>Travel companion details</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Age <Text style={styles.fieldLabelMuted}>(Optional)</Text>
              </Text>
              <TextInput
                value={buddyAge}
                onChangeText={(v) => {
                  setBuddyAge(sanitizeDigitsOnly(v, 3));
                  clearFieldError("age");
                }}
                placeholder="e.g. 28"
                placeholderTextColor={colors.subtleText}
                keyboardType="number-pad"
                style={[styles.input, fieldErrors.age && styles.inputError]}
              />
              {fieldErrors.age ? (
                <Text style={styles.inlineError}>{fieldErrors.age}</Text>
              ) : null}
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
      </SectionCard>
      </View>

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
      </ScrollView>

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
          if (calendarOpen === "return") {
            setReturnDate(d);
            clearFieldError("returnDate");
          } else {
            setDepartDate(d);
            clearFieldError("departDate");
          }
          setCalendarOpen(null);
        }}
        onChangeMonth={setVisibleMonth}
        onClose={() => setCalendarOpen(null)}
      />
    </Screen>
  );
}

// ───────────────────────── Section primitives ─────────────────────────


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
      {/* `pointerEvents="box-none"` lets taps outside the sheet fall through to
          the backdrop above, while the centered sheet itself stays interactive. */}
      <View style={styles.calendarCenterWrap} pointerEvents="box-none">
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
      </View>
    </Modal>
  );
}

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
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
  subtitle: { color: colors.mutedText, fontSize: 14, lineHeight: 20, fontWeight: "500", marginBottom: 14 },
  bannerSlot: { marginBottom: 14 },

  progressBlock: { gap: 8, marginBottom: 18 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.wordmark,
  },
  progressLabel: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "right",
  },

  field: { gap: 8 },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  fieldLabelMuted: { color: colors.subtleText, fontWeight: "500" },

  flexSpacer: { flex: 1 },
  optionalPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  optionalPillText: { color: colors.subtleText, fontSize: 10, lineHeight: 14, fontWeight: "700", letterSpacing: 0.3 },

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
  inputError: { borderColor: colors.danger, backgroundColor: "rgba(220, 40, 40, 0.06)" },
  selectInput: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  selectInputText: { color: colors.text, fontSize: 15, lineHeight: 22, flex: 1 },

  inlineError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 6,
  },

  rangeRow: { flexDirection: "row", gap: 8 },
  rangeCell: { flex: 1 },

  dateRow: { flexDirection: "row", gap: 10 },
  dateRowCell: { flex: 1 },

  airlineLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  airlineSelect: { paddingVertical: 14 },

  labelToggleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  labelToggleRowGap: { marginTop: 12 },
  unitToggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  unitToggleButton: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  unitToggleButtonActive: { backgroundColor: colors.wordmark },
  unitToggleText: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  unitToggleTextActive: { color: colors.white },

  sizeRow: { flexDirection: "row", gap: 10 },
  sizeCell: { flex: 1, gap: 6 },
  sizeCellLabel: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "600" },

  helperText: { color: colors.mutedText, fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: 6 },
  helperError: { color: colors.danger, fontWeight: "700" },

  buddyToggleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceTintPrimary,
  },
  buddyToggleText: { flex: 1, minWidth: 0, gap: 4 },
  buddyOptInTitle: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  buddyOptInBody: { color: colors.mutedText, fontSize: 12, lineHeight: 17, fontWeight: "500" },

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

  // Wrapper centers the sheet; sheet width is capped so it nests inside.
  calendarCenterWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  calendarSheet: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
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
