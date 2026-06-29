import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  CompositeNavigationProp,
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  FlatList,
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
import { DateField, DateModeToggle, LocationCard, SectionCard } from "@/components/ui/FormSection";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { ANY_CITY, CityPicker } from "@/features/search/CityPicker";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import { useBuddyListings } from "@/hooks/api/useBuddyListings";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { buddiesApi, getErrorMessage } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { sanitizeDigitsOnly } from "@/utils/inputSanitizers";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "CreateBuddyTab">,
  NativeStackNavigationProp<RootStackParamList>
>;
type Route = RouteProp<MainTabParamList, "CreateBuddyTab">;

type Country = "IN" | "US";
type DateMode = "single" | "range";

/** Keys for fields that can carry an inline validation error. */
type FieldKey = "fromCity" | "toCity" | "departDate" | "returnDate" | "age";

/** Web parity (`CustomerCreateBuddy.tsx:34-39`). */
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

/** Web parity (`CustomerCreateBuddy.tsx:41-45`). */
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

export function CreateBuddyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editId = route.params?.editId ?? null;
  const isEditMode = !!editId;

  const { listings, loading: listingsLoading } = useBuddyListings({
    filter: isEditMode ? "my_listings" : undefined,
    perPage: 100,
  });
  const editListing = useMemo(
    () => (isEditMode ? listings.find((l) => l.id === editId) : null),
    [isEditMode, listings, editId],
  );
  const [hydratedFromEdit, setHydratedFromEdit] = useState(false);

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

  const [age, setAge] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [interests, setInterests] = useState("");
  const [layover, setLayover] = useState("");
  const [bio, setBio] = useState("");

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

  useEffect(() => {
    if (!isEditMode || hydratedFromEdit || !editListing) return;
    setFromCity(editListing.from_city);
    setToCity(editListing.to_city);
    setFromCountry(INDIA_CITIES.includes(editListing.from_city) ? "IN" : "US");
    setToCountry(INDIA_CITIES.includes(editListing.to_city) ? "IN" : "US");
    setAirline(editListing.airline ?? "");
    const persistedFrom = editListing.travel_date_from || editListing.travel_date;
    const persistedTo = editListing.travel_date_to || editListing.travel_date;
    if (persistedFrom && persistedTo && persistedFrom !== persistedTo) {
      setDateMode("range");
      setDepartDate(new Date(persistedFrom));
      setReturnDate(new Date(persistedTo));
    } else if (persistedFrom) {
      setDateMode("single");
      setDepartDate(new Date(persistedFrom));
      setReturnDate(null);
    }
    setBio(editListing.bio ?? "");
    setAge(editListing.age != null ? String(editListing.age) : "");
    setLanguages(editListing.languages ?? []);
    setInterests(editListing.interests ?? "");
    setLayover(editListing.layover ?? "");
    setHydratedFromEdit(true);
  }, [isEditMode, hydratedFromEdit, editListing]);

  const fromFlag = fromCountry === "IN" ? "🇮🇳" : "🇺🇸";
  const toFlag = toCountry === "IN" ? "🇮🇳" : "🇺🇸";
  const fromCountryName = fromCountry === "IN" ? "India" : "United States";
  const toCountryName = toCountry === "IN" ? "India" : "United States";
  const fromCities = fromCountry === "IN" ? INDIA_CITIES : USA_CITIES;
  const toCities = toCountry === "IN" ? INDIA_CITIES : USA_CITIES;

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  // Section Y offsets tracked via `onLayout` on the section wrappers.
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionYs = useRef<{
    section1: number;
    section2: number;
    section3: number;
    section4: number;
  }>({ section1: 0, section2: 0, section3: 0, section4: 0 });
  const fieldToSection: Record<FieldKey, "section1" | "section2" | "section3" | "section4"> = {
    fromCity: "section1",
    toCity: "section1",
    departDate: "section2",
    returnDate: "section2",
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

  const scrollToField = useCallback((key: FieldKey) => {
    const sectionKey = fieldToSection[key];
    const y = sectionYs.current[sectionKey];
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  }, [fieldToSection]);

  const section1Complete = !!fromCity && !!toCity;
  const section2Complete = !!departDate && (dateMode === "single" || !!returnDate);
  const section3Complete = !!airline || !!layover;
  const section4Complete = !!age || languages.length > 0 || !!interests || !!bio;

  // 3 required fields; date-range adds the return date as the 4th.
  const requiredTotal = dateMode === "range" ? 4 : 3;
  const requiredCompleted =
    (fromCity ? 1 : 0) +
    (toCity ? 1 : 0) +
    (departDate ? 1 : 0) +
    (dateMode === "range" && returnDate ? 1 : 0);
  const progressPct = Math.round((requiredCompleted / requiredTotal) * 100);

  const handleAddLanguage = useCallback(
    (lang: string) => {
      if (languages.length >= 3) return; // picker button is disabled at the cap, but guard anyway

      if (!languages.includes(lang)) {
        setLanguages([...languages, lang]);
      }
    },
    [languages],
  );
  const handleRemoveLanguage = useCallback((lang: string) => {
    setLanguages((prev) => prev.filter((l) => l !== lang));
  }, []);

  const handleSubmit = useCallback(async () => {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (!fromCity) errors.fromCity = "Select a departure city";
    if (!toCity) errors.toCity = "Select a destination city";
    if (!departDate) {
      errors.departDate = dateMode === "range" ? "Pick a start date" : "Pick a travel date";
    } else if (departDate < today) {
      errors.departDate = "Can't be in the past";
    } else if (departDate > maxDate) {
      errors.departDate = "Must be within 12 months";
    }
    if (dateMode === "range") {
      if (!returnDate) {
        errors.returnDate = "Pick an end date";
      } else if (departDate && returnDate < departDate) {
        errors.returnDate = "Must be after start date";
      } else if (returnDate > maxDate) {
        errors.returnDate = "Must be within 12 months";
      }
    }
    const ageNum = age ? parseInt(age, 10) : undefined;
    if (ageNum !== undefined && (ageNum < 18 || ageNum > 120)) {
      errors.age = "Age must be between 18 and 120";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Please fix the highlighted fields before continuing.");
      const order: FieldKey[] = ["fromCity", "toCity", "departDate", "returnDate", "age"];
      const firstKey = order.find((k) => errors[k]);
      if (firstKey) scrollToField(firstKey);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    const effectiveFrom = departDate;
    const effectiveTo = dateMode === "range" ? returnDate : departDate;
    if (!effectiveFrom || !effectiveTo) return; // guarded by checks above

    const isAnyFrom = fromCity === ANY_CITY;
    const isAnyTo = toCity === ANY_CITY;
    const payload = {
      from_city: isAnyFrom ? "Any" : fromCity,
      to_city: isAnyTo ? "Any" : toCity,
      travel_date: formatYmd(effectiveFrom),
      travel_date_from: formatYmd(effectiveFrom),
      travel_date_to: formatYmd(effectiveTo),
      bio: bio.trim() || undefined,
      airline: airline || undefined,
      age: ageNum,
      languages: languages.length > 0 ? languages : undefined,
      interests: interests.trim() || undefined,
      layover: layover.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (isEditMode && editId) {
        await buddiesApi.update(editId, payload);
        navigation.navigate("Parcels");
      } else {
        await buddiesApi.create(payload);
        setSubmitted(true);
      }
    } catch (err) {
      setFormError(`Couldn't save buddy listing. ${getErrorMessage(err)}`);
    } finally {
      setSubmitting(false);
    }
  }, [
    fromCity,
    toCity,
    dateMode,
    departDate,
    returnDate,
    today,
    maxDate,
    age,
    bio,
    airline,
    languages,
    interests,
    layover,
    isEditMode,
    editId,
    navigation,
    scrollToField,
  ]);

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
    setAge("");
    setLanguages([]);
    setLanguagePickerOpen(false);
    setInterests("");
    setLayover("");
    setBio("");
    setSubmitting(false);
    setSubmitted(false);
    setFormError(null);
    setFieldErrors({});
  }, []);

  const submittedRef = useRef(submitted);
  submittedRef.current = submitted;
  useFocusEffect(
    useCallback(() => {
      return () => {
        setFormError(null);
        setFieldErrors({});
        if (submittedRef.current) resetForm();
      };
    }, [resetForm]),
  );

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
          <Text style={styles.title}>Buddy listing created</Text>
        </View>
        <View style={styles.successWrap}>
          <View style={styles.successIconBubble}>
            <Ionicons name="checkmark" size={36} color={colors.safe} />
          </View>
          <Text style={styles.successTitle}>Buddy listing created</Text>
          <Text style={styles.successBody}>
            Travelers on your route can now find you and send connection requests.
          </Text>
          <View style={styles.successButtons}>
            <AppButton
              label="View in my travels"
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
  const editLoadingError = isEditMode && !listingsLoading && !editListing;

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
          <Text style={styles.title}>
            {isEditMode ? "Edit travel buddy" : "Find a travel buddy"}
          </Text>
        </View>
        <Text style={styles.subtitle}>
          {isEditMode
            ? "Update your travel partner request so other travelers can find the latest details."
            : "Share your travel plans and connect with fellow travelers on your route."}
        </Text>

        {/* Progress bar — % of required fields complete (3 required, 4 in date-range mode). */}
        <View style={styles.progressBlock}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {requiredCompleted} of {requiredTotal} required fields complete
          </Text>
        </View>

        {isEditMode && listingsLoading ? (
          <View style={styles.editLoadingRow}>
            <ActivityIndicator size="small" color={colors.wordmark} />
            <Text style={styles.editLoadingText}>Loading your existing buddy request…</Text>
          </View>
        ) : null}
        {editLoadingError ? (
          <View style={styles.bannerSlot}>
            <FormBanner
              message="Buddy request not found. It may have been removed already."
            />
          </View>
        ) : null}
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
                placeholder="Select destination city"
                variant="card"
                invalid={!!fieldErrors.toCity}
              />
              {fieldErrors.toCity ? (
                <Text style={styles.inlineError}>{fieldErrors.toCity}</Text>
              ) : null}
            </View>
          </SectionCard>
        </View>

        {/* ───────── Section 2 — When are you traveling? ───────── */}
        <View
          onLayout={(e) => {
            sectionYs.current.section2 = e.nativeEvent.layout.y;
          }}
        >
          <SectionCard
            index={2}
            title="When are you traveling?"
            subtitle="Single date or a flexible range"
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
                if (next === "single") {
                  setReturnDate(null);
                  clearFieldError("returnDate");
                }
              }}
            />

            <View style={styles.dateRow}>
              <View style={styles.dateRowCell}>
                <DateField
                  label={dateMode === "range" ? "Start" : "Travel date"}
                  value={departDate ? formatDateLabel(departDate) : null}
                  placeholder="Select date"
                  onPress={() => setCalendarOpen("depart")}
                  error={fieldErrors.departDate}
                />
              </View>
              <View style={styles.dateRowCell}>
                <DateField
                  label="End"
                  value={returnDate ? formatDateLabel(returnDate) : null}
                  placeholder="Select date"
                  onPress={() => setCalendarOpen("return")}
                  disabled={dateMode === "single"}
                  error={fieldErrors.returnDate}
                />
              </View>
            </View>
            <Text style={styles.helperText}>
              Select a single date or a date range up to 12 months from today.
            </Text>
          </SectionCard>
        </View>

        {/* ───────── Section 3 — Your flight (optional) ───────── */}
        <View
          onLayout={(e) => {
            sectionYs.current.section3 = e.nativeEvent.layout.y;
          }}
        >
          <SectionCard
            index={3}
            title="Your flight"
            subtitle="Optional flight info to find buddies on the same plane"
            complete={section3Complete}
          >
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Airline</Text>
              <View style={styles.optionalPill}>
                <Text style={styles.optionalPillText}>Optional</Text>
              </View>
            </View>
            <Pressable
              style={[styles.input, styles.selectInput]}
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
              Helps match with buddies on the same flight.
            </Text>

            <View style={[styles.labelRow, styles.labelRowTopGap]}>
              <Text style={styles.fieldLabel}>Layover</Text>
              <View style={styles.optionalPill}>
                <Text style={styles.optionalPillText}>Optional</Text>
              </View>
            </View>
            <TextInput
              value={layover}
              onChangeText={setLayover}
              placeholder="e.g. New York — 4h layover"
              placeholderTextColor={colors.subtleText}
              style={styles.input}
            />
            <Text style={styles.helperText}>
              Share layover details to find buddies with the same connection.
            </Text>
          </SectionCard>
        </View>

        {/* ───────── Section 4 — About you (optional) ───────── */}
        <View
          onLayout={(e) => {
            sectionYs.current.section4 = e.nativeEvent.layout.y;
          }}
        >
          <SectionCard
            index={4}
            title="About you"
            subtitle="Optional — help travelers get to know you"
            complete={section4Complete}
            hasError={!!fieldErrors.age}
          >
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Age</Text>
              <View style={styles.optionalPill}>
                <Text style={styles.optionalPillText}>Optional</Text>
              </View>
            </View>
            <View>
              <TextInput
                value={age}
                onChangeText={(v) => {
                  setAge(sanitizeDigitsOnly(v, 3));
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

            <View style={[styles.labelRow, styles.labelRowTopGap]}>
              <Text style={styles.fieldLabel}>Languages</Text>
              <View style={styles.optionalPill}>
                <Text style={styles.optionalPillText}>Up to 3</Text>
              </View>
            </View>
            {languages.length > 0 ? (
              <View style={styles.chipsRow}>
                {languages.map((lang) => (
                  <View key={lang} style={styles.chip}>
                    <Text style={styles.chipText}>{lang}</Text>
                    <Pressable
                      onPress={() => handleRemoveLanguage(lang)}
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
              disabled={languages.length >= 3}
              accessibilityRole="button"
              accessibilityLabel="Add a language"
            >
              <Text
                style={[styles.selectInputText, { color: colors.subtleText }]}
              >
                {languages.length >= 3 ? "Max 3 selected" : "Add a language"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.mutedText} />
            </Pressable>

            <View style={[styles.labelRow, styles.labelRowTopGap]}>
              <Text style={styles.fieldLabel}>Interests</Text>
              <View style={styles.optionalPill}>
                <Text style={styles.optionalPillText}>Optional</Text>
              </View>
            </View>
            <TextInput
              value={interests}
              onChangeText={setInterests}
              placeholder="e.g. Photography, Hiking, Food, Tech"
              placeholderTextColor={colors.subtleText}
              style={styles.input}
            />
            <Text style={styles.helperText}>
              Comma-separated interests help find like-minded travelers.
            </Text>

            <View style={[styles.labelRow, styles.labelRowTopGap]}>
              <Text style={styles.fieldLabel}>About you</Text>
              <View style={styles.optionalPill}>
                <Text style={styles.optionalPillText}>Optional</Text>
              </View>
            </View>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell potential buddies about yourself — travel style, what you're looking for…"
              placeholderTextColor={colors.subtleText}
              style={[styles.input, styles.textarea]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </SectionCard>
        </View>

        <View style={styles.submitRow}>
          <AppButton
            label={
              submitting
                ? isEditMode
                  ? "Saving…"
                  : "Creating…"
                : isEditMode
                  ? "Save buddy request"
                  : "Find my travel buddy"
            }
            onPress={() => void handleSubmit()}
            disabled={submitting || (isEditMode && (listingsLoading || !editListing))}
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
        options={LANGUAGE_OPTIONS.filter((l) => !languages.includes(l))}
        selected=""
        onSelect={(l) => {
          handleAddLanguage(l);
          setLanguagePickerOpen(false);
        }}
        onClose={() => setLanguagePickerOpen(false)}
      />

      {/* Calendar */}
      <CalendarModal
        open={calendarOpen !== null}
        title={calendarOpen === "return" ? "Pick end date" : "Pick travel date"}
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

// ───────────────────────── Sub-components ─────────────────────────

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
                <Text
                  style={[
                    styles.pickerRowText,
                    isSel && styles.pickerRowTextSelected,
                  ]}
                >
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

  // ───── Progress bar ─────
  progressBlock: { gap: 8, marginBottom: 18 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.wordmark },
  progressLabel: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "right",
  },

  editLoadingRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  editLoadingText: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },

  // ───── Common fields ─────
  fieldLabel: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  fieldLabelMuted: { color: colors.subtleText, fontWeight: "500" },

  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  labelRowTopGap: { marginTop: 8 },
  optionalPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  optionalPillText: {
    color: colors.subtleText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // ───── Section 2: date row ─────
  dateRow: { flexDirection: "row", gap: 10 },
  dateRowCell: { flex: 1 },

  // ───── Inputs ─────
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
  selectInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectInputText: { color: colors.text, fontSize: 15, lineHeight: 22, flex: 1 },
  textarea: { minHeight: 84, paddingTop: 12 },

  inlineError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 6,
  },

  helperText: { color: colors.mutedText, fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: 6 },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
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

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,25,0.4)",
  },
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
  calendarWeekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
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
