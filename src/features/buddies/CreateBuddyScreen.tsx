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
import { DateField, LocationCard, SectionCard } from "@/components/ui/FormSection";
import { FormBanner } from "@/components/ui/FormBanner";
import { ListPickerModal } from "@/components/ui/ListPickerModal";
import { Screen } from "@/components/ui/Screen";
import {
  AIRLINES,
  LANGUAGE_OPTIONS,
  MAX_LANGUAGES,
  SAME_ROUTE_MESSAGE,
  getAgeError,
  isSameRoute as computeSameRoute,
} from "@/features/buddies/buddyOptions";
import { ANY_CITY, CityPicker } from "@/features/search/CityPicker";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { buddiesApi, getErrorMessage } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { sanitizeDigitsOnly } from "@/utils/inputSanitizers";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "CreateBuddyTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

type Country = "IN" | "US";

/** Keys for fields that can carry an inline validation error. */
type FieldKey = "fromCity" | "toCity" | "travelDate" | "age";

/** Content-based section keys, so reordering can't invalidate scroll-to-error. */
type SectionKey = "route" | "dates" | "flight" | "about";

const FIELD_TO_SECTION: Record<FieldKey, SectionKey> = {
  fromCity: "route",
  toCity: "route",
  travelDate: "dates",
  age: "about",
};

/** Surfaced in scroll-to-first-error order. */
const FIELD_ORDER: readonly FieldKey[] = ["fromCity", "toCity", "travelDate", "age"];

function formatYmd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function CreateBuddyScreen() {
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

  // Single travel date only — web parity. `CustomerCreateBuddy.tsx` keeps its
  // "Date range" button commented out ("temporarily disabled for Find a Travel
  // Buddy"), so a range created here could never be edited or reproduced on web.
  const [travelDate, setTravelDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

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

  // Live checks — these surface the moment the value goes bad, rather than
  // waiting for submit. Web does the same for both.
  const isSameRoute = computeSameRoute(fromCountry, fromCity, toCountry, toCity);
  const toCityError = isSameRoute ? SAME_ROUTE_MESSAGE : fieldErrors.toCity;
  const ageError = getAgeError(age) ?? fieldErrors.age;

  // Section Y offsets tracked via `onLayout` on the section wrappers.
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionYs = useRef<Record<SectionKey, number>>({
    route: 0,
    dates: 0,
    flight: 0,
    about: 0,
  });

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
    const y = sectionYs.current[FIELD_TO_SECTION[key]];
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  }, []);

  const routeComplete = !!fromCity && !!toCity && !isSameRoute;
  const datesComplete = !!travelDate;
  const flightComplete = !!airline || !!layover;
  const aboutComplete = !!age || languages.length > 0 || !!interests || !!bio;

  const requiredTotal = 3;
  const requiredCompleted = (fromCity ? 1 : 0) + (toCity ? 1 : 0) + (travelDate ? 1 : 0);
  const progressPct = Math.round((requiredCompleted / requiredTotal) * 100);

  const handleAddLanguage = useCallback((lang: string) => {
    setLanguages((prev) => {
      // The picker button is disabled at the cap, but guard anyway.
      if (prev.length >= MAX_LANGUAGES || prev.includes(lang)) return prev;
      return [...prev, lang];
    });
  }, []);

  const handleRemoveLanguage = useCallback((lang: string) => {
    setLanguages((prev) => prev.filter((l) => l !== lang));
  }, []);

  const handleSubmit = useCallback(async () => {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (!fromCity) errors.fromCity = "Select a departure city";
    if (!toCity) errors.toCity = "Select a destination city";
    if (isSameRoute) errors.toCity = SAME_ROUTE_MESSAGE;

    if (!travelDate) {
      errors.travelDate = "Pick a travel date";
    } else if (travelDate < today) {
      errors.travelDate = "Can't be in the past";
    } else if (travelDate > maxDate) {
      errors.travelDate = "Must be within 12 months";
    }

    const ageRangeError = getAgeError(age);
    if (ageRangeError) errors.age = ageRangeError;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Please fix the highlighted fields before continuing.");
      const firstKey = FIELD_ORDER.find((k) => errors[k]);
      if (firstKey) scrollToField(firstKey);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    if (!travelDate) return; // narrowing — guarded above

    const ymd = formatYmd(travelDate);
    const payload = {
      from_city: fromCity === ANY_CITY ? "Any" : fromCity,
      to_city: toCity === ANY_CITY ? "Any" : toCity,
      // No `travel_date_mode` column exists on buddy_listings, so a single-date
      // listing is expressed as from === to.
      travel_date: ymd,
      travel_date_from: ymd,
      travel_date_to: ymd,
      bio: bio.trim() || undefined,
      airline: airline || undefined,
      age: age ? Number.parseInt(age, 10) : undefined,
      languages: languages.length > 0 ? languages : undefined,
      interests: interests.trim() || undefined,
      layover: layover.trim() || undefined,
    };

    setSubmitting(true);
    try {
      await buddiesApi.create(payload);
      setSubmitted(true);
    } catch (err) {
      setFormError(`Couldn't save buddy listing. ${getErrorMessage(err)}`);
    } finally {
      setSubmitting(false);
    }
  }, [
    fromCity,
    toCity,
    isSameRoute,
    travelDate,
    today,
    maxDate,
    age,
    bio,
    airline,
    languages,
    interests,
    layover,
    scrollToField,
  ]);

  const resetForm = useCallback(() => {
    setFromCountry("IN");
    setToCountry("US");
    setFromCity("");
    setToCity("");
    setAirline("");
    setAirlineOpen(false);
    setTravelDate(null);
    setCalendarOpen(false);
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
      // `Screen`'s content style has no flexGrow, so a centred child needs both
      // this and `flex: 1` below — otherwise the block sits at the top.
      <Screen contentContainerStyle={styles.successScroll}>
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
          <Text style={styles.title}>Find a travel buddy</Text>
        </View>
        <Text style={styles.subtitle}>
          Share your travel plans and connect with fellow travelers on your route.
        </Text>

        {/* Progress bar — % of the 3 required fields complete. */}
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

        {/* ───────── Where are you going? ───────── */}
        <View
          onLayout={(e) => {
            sectionYs.current.route = e.nativeEvent.layout.y;
          }}
        >
          <SectionCard
            index={1}
            title="Where are you going?"
            subtitle="Set your departure and destination"
            complete={routeComplete}
            hasError={!!fieldErrors.fromCity || !!toCityError}
          >
            <Text style={styles.fieldLabel}>From</Text>
            <LocationCard flag={fromFlag} label={fromCountryName} filled onToggle={toggleFromCountry} />
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
            <LocationCard flag={toFlag} label={toCountryName} filled onToggle={toggleToCountry} />
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
                invalid={!!toCityError}
              />
              {toCityError ? <Text style={styles.inlineError}>{toCityError}</Text> : null}
            </View>
          </SectionCard>
        </View>

        {/* ───────── When are you traveling? ───────── */}
        <View
          onLayout={(e) => {
            sectionYs.current.dates = e.nativeEvent.layout.y;
          }}
        >
          <SectionCard
            index={2}
            title="When are you traveling?"
            subtitle="Pick your travel date"
            complete={datesComplete}
            hasError={!!fieldErrors.travelDate}
          >
            <DateField
              label="Travel date"
              value={travelDate ? formatDateLabel(travelDate) : null}
              placeholder="Select date"
              onPress={() => setCalendarOpen(true)}
              error={fieldErrors.travelDate}
            />
            <Text style={styles.helperText}>
              Select a travel date up to 12 months from today.
            </Text>
          </SectionCard>
        </View>

        {/* ───────── Your flight (optional) ───────── */}
        <View
          onLayout={(e) => {
            sectionYs.current.flight = e.nativeEvent.layout.y;
          }}
        >
          <SectionCard
            index={3}
            title="Your flight"
            subtitle="Optional flight info to find buddies on the same plane"
            complete={flightComplete}
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
              <Text style={[styles.selectInputText, !airline && styles.selectInputPlaceholder]}>
                {airline || "Select airline"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.mutedText} />
            </Pressable>
            <Text style={styles.helperText}>Helps match with buddies on the same flight.</Text>

            <View style={[styles.labelRow, styles.labelRowTopGap]}>
              <Text style={styles.fieldLabel}>Layover</Text>
              <View style={styles.optionalPill}>
                <Text style={styles.optionalPillText}>Optional</Text>
              </View>
            </View>
            <TextInput
              value={layover}
              onChangeText={setLayover}
              placeholder="e.g. London Heathrow — 3h layover"
              placeholderTextColor={colors.placeholderText}
              style={styles.input}
            />
            <Text style={styles.helperText}>
              Share layover details to find buddies with the same connection.
            </Text>
          </SectionCard>
        </View>

        {/* ───────── About you (optional) ───────── */}
        <View
          onLayout={(e) => {
            sectionYs.current.about = e.nativeEvent.layout.y;
          }}
        >
          <SectionCard
            index={4}
            title="About you"
            subtitle="Optional — help travelers get to know you"
            complete={aboutComplete}
            hasError={!!ageError}
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
                placeholderTextColor={colors.placeholderText}
                keyboardType="number-pad"
                style={[styles.input, !!ageError && styles.inputError]}
              />
              {ageError ? <Text style={styles.inlineError}>{ageError}</Text> : null}
            </View>

            <View style={[styles.labelRow, styles.labelRowTopGap]}>
              <Text style={styles.fieldLabel}>Languages</Text>
              <View style={styles.optionalPill}>
                <Text style={styles.optionalPillText}>Up to {MAX_LANGUAGES}</Text>
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
              disabled={languages.length >= MAX_LANGUAGES}
              accessibilityRole="button"
              accessibilityLabel="Add a language"
            >
              <Text style={[styles.selectInputText, styles.selectInputPlaceholder]}>
                {languages.length >= MAX_LANGUAGES
                  ? `Max ${MAX_LANGUAGES} selected`
                  : "Add a language"}
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
              placeholderTextColor={colors.placeholderText}
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
              placeholderTextColor={colors.placeholderText}
              style={[styles.input, styles.textarea]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </SectionCard>
        </View>

        <View style={styles.submitRow}>
          <AppButton
            label={submitting ? "Creating…" : "Find my travel buddy"}
            onPress={() => void handleSubmit()}
            disabled={submitting}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            leftIcon={
              submitting ? <ActivityIndicator size="small" color={colors.white} /> : undefined
            }
          />
        </View>
      </ScrollView>

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

      <CalendarModal
        open={calendarOpen}
        title="Pick travel date"
        selected={travelDate}
        visibleMonth={visibleMonth}
        today={today}
        maxDate={maxDate}
        onSelect={(d) => {
          setTravelDate(d);
          clearFieldError("travelDate");
          setCalendarOpen(false);
        }}
        onChangeMonth={setVisibleMonth}
        onClose={() => setCalendarOpen(false)}
      />
    </Screen>
  );
}

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
  subtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    marginBottom: 14,
  },
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

  // ───── Common fields ─────
  fieldLabel: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
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
  selectInputPlaceholder: { color: colors.placeholderText },
  textarea: { minHeight: 84, paddingTop: 12 },

  inlineError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 6,
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    marginTop: 6,
  },

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

  // ───── Success ─────
  successScroll: { flexGrow: 1 },
  successWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
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
});
