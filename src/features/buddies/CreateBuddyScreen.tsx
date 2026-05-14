import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  CompositeNavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
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

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/feedback/appFeedback";
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

type Direction = "IN_TO_US" | "US_TO_IN";
type DateMode = "single" | "range";

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

  // Edit-mode hydrate: load this user's listings, find the one being edited.
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

  const [age, setAge] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [interests, setInterests] = useState("");
  const [layover, setLayover] = useState("");
  const [bio, setBio] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  // Hydrate form once when the listing arrives in edit mode.
  useEffect(() => {
    if (!isEditMode || hydratedFromEdit || !editListing) return;
    setFromCity(editListing.from_city);
    setToCity(editListing.to_city);
    setDirection(
      INDIA_CITIES.includes(editListing.from_city) ? "IN_TO_US" : "US_TO_IN",
    );
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

  const fromLabel = direction === "IN_TO_US" ? "🇮🇳 IN, India" : "🇺🇸 US, USA";
  const toLabel = direction === "IN_TO_US" ? "🇺🇸 US, USA" : "🇮🇳 IN, India";
  const fromCities = direction === "IN_TO_US" ? INDIA_CITIES : USA_CITIES;
  const toCities = direction === "IN_TO_US" ? USA_CITIES : INDIA_CITIES;

  const handleSwapDirection = useCallback(() => {
    setDirection((d) => (d === "IN_TO_US" ? "US_TO_IN" : "IN_TO_US"));
    setFromCity("");
    setToCity("");
  }, []);

  const handleAddLanguage = useCallback(
    (lang: string) => {
      if (languages.length >= 3) {
        showToast({ title: "Up to 3 languages", variant: "warning" });
        return;
      }
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
    if (!fromCity) {
      showToast({ title: "Departure city required", variant: "error" });
      return;
    }
    if (!toCity) {
      showToast({ title: "Destination city required", variant: "error" });
      return;
    }
    if (dateMode === "single" && !departDate) {
      showToast({ title: "Pick a travel date", variant: "error" });
      return;
    }
    if (dateMode === "range" && !departDate) {
      showToast({ title: "Pick a start date", variant: "error" });
      return;
    }
    if (dateMode === "range" && !returnDate) {
      showToast({ title: "Pick an end date", variant: "error" });
      return;
    }
    const effectiveFrom = departDate;
    const effectiveTo = dateMode === "range" ? returnDate : departDate;
    if (!effectiveFrom || !effectiveTo) {
      showToast({ title: "Pick your travel dates", variant: "error" });
      return;
    }
    if (effectiveFrom < today) {
      showToast({ title: "Travel date can't be in the past", variant: "error" });
      return;
    }
    if (effectiveTo > maxDate) {
      showToast({
        title: "Travel dates must be within 12 months",
        variant: "error",
      });
      return;
    }
    const ageNum = age ? parseInt(age, 10) : undefined;
    if (ageNum !== undefined && (ageNum < 18 || ageNum > 120)) {
      showToast({ title: "Age must be between 18 and 120", variant: "error" });
      return;
    }

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
        showToast({ title: "Buddy request updated", variant: "success" });
        navigation.navigate("Parcels");
      } else {
        await buddiesApi.create(payload);
        setSubmitted(true);
      }
    } catch (err) {
      showToast({
        title: "Couldn't save buddy listing",
        message: getErrorMessage(err),
        variant: "error",
      });
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
            <Ionicons name="people-outline" size={40} color={colors.safe} />
          </View>
          <Text style={styles.successTitle}>Buddy Listing Created! 🤝</Text>
          <Text style={styles.successBody}>
            Travelers on your route can now find you and send connection
            requests.
          </Text>
          <View style={styles.successButtons}>
            <Pressable
              onPress={() => navigation.navigate("Parcels")}
              style={[styles.button, styles.buttonPrimary]}
              accessibilityRole="button"
            >
              <Text style={styles.buttonPrimaryText}>View in My Travels</Text>
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
  const editLoadingError = isEditMode && !listingsLoading && !editListing;

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
          <Text style={styles.title}>
            {isEditMode ? "Edit Travel Buddy Request" : "Find a Travel Buddy"}
          </Text>
          <Text style={styles.subtitle}>
            {isEditMode
              ? "Update your travel partner request so other travelers can find the latest details."
              : "Share your travel plans and connect with fellow travelers on your route."}
          </Text>
        </View>
      </View>

      {isEditMode && listingsLoading ? (
        <View style={styles.editLoadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.editLoadingText}>Loading your existing buddy request…</Text>
        </View>
      ) : null}
      {editLoadingError ? (
        <View style={styles.editErrorBox}>
          <Text style={styles.editErrorText}>
            Buddy request not found. It may have been removed already.
          </Text>
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
            <Ionicons name="swap-vertical-outline" size={16} color={colors.primary} />
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
            placeholder="Select destination city"
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
            Helps match with buddies on the same flight.
          </Text>
        </View>

        {/* Travel Date */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Travel Date / Date Range</Text>
          <View style={styles.unitToggle}>
            <Pressable
              onPress={() => {
                setDateMode("single");
                setReturnDate(null);
              }}
              style={[
                styles.unitToggleButton,
                dateMode === "single" && styles.unitToggleButtonActive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: dateMode === "single" }}
            >
              <Text
                style={[
                  styles.unitToggleText,
                  dateMode === "single" && styles.unitToggleTextActive,
                ]}
              >
                Single date
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDateMode("range")}
              style={[
                styles.unitToggleButton,
                dateMode === "range" && styles.unitToggleButtonActive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: dateMode === "range" }}
            >
              <Text
                style={[
                  styles.unitToggleText,
                  dateMode === "range" && styles.unitToggleTextActive,
                ]}
              >
                Date range
              </Text>
            </Pressable>
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
                {departDate ? formatDateLabel(departDate) : "Pick your travel date"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.rangeRow}>
              <Pressable
                style={[styles.input, styles.selectInput, styles.rangeCell]}
                onPress={() => setCalendarOpen("depart")}
                accessibilityRole="button"
                accessibilityLabel="Pick start date"
              >
                <Ionicons name="calendar-outline" size={16} color={colors.mutedText} />
                <Text
                  style={[
                    styles.selectInputText,
                    !departDate && { color: colors.subtleText },
                  ]}
                  numberOfLines={2}
                >
                  {departDate ? formatDateLabel(departDate) : "Start"}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.input, styles.selectInput, styles.rangeCell]}
                onPress={() => setCalendarOpen("return")}
                accessibilityRole="button"
                accessibilityLabel="Pick end date"
              >
                <Ionicons name="calendar-outline" size={16} color={colors.mutedText} />
                <Text
                  style={[
                    styles.selectInputText,
                    !returnDate && { color: colors.subtleText },
                  ]}
                  numberOfLines={2}
                >
                  {returnDate ? formatDateLabel(returnDate) : "End"}
                </Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.helperText}>
            Select a single date or a date range up to 12 months from today.
          </Text>
        </View>

        {/* Age */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Age <Text style={styles.fieldLabelMuted}>(Optional)</Text>
          </Text>
          <TextInput
            value={age}
            onChangeText={(v) => setAge(sanitizeDigitsOnly(v, 3))}
            placeholder="e.g. 28"
            placeholderTextColor={colors.subtleText}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>

        {/* Languages */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Languages{" "}
            <Text style={styles.fieldLabelMuted}>(Optional, up to 3)</Text>
          </Text>
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
              style={[
                styles.selectInputText,
                { color: colors.subtleText },
              ]}
            >
              {languages.length >= 3 ? "Max 3 selected" : "Add a language"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.mutedText} />
          </Pressable>
        </View>

        {/* Interests */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Interests <Text style={styles.fieldLabelMuted}>(Optional)</Text>
          </Text>
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
        </View>

        {/* Layover */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Layover <Text style={styles.fieldLabelMuted}>(Optional)</Text>
          </Text>
          <TextInput
            value={layover}
            onChangeText={setLayover}
            placeholder="e.g. Dubai — 4h layover"
            placeholderTextColor={colors.subtleText}
            style={styles.input}
          />
          <Text style={styles.helperText}>
            Share layover details to find buddies with the same connection.
          </Text>
        </View>

        {/* Bio */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            About You <Text style={styles.fieldLabelMuted}>(Optional)</Text>
          </Text>
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
        </View>

        {/* Submit */}
        <View style={styles.submitRow}>
          <Pressable
            onPress={() => void handleSubmit()}
            disabled={submitting || (isEditMode && (listingsLoading || !editListing))}
            style={[
              styles.submitButton,
              (submitting || (isEditMode && (listingsLoading || !editListing))) &&
                styles.buttonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isEditMode ? "Save buddy request" : "Find my travel buddy"}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="people-outline" size={16} color={colors.white} />
            )}
            <Text style={styles.submitButtonText}>
              {submitting
                ? isEditMode
                  ? "Saving…"
                  : "Creating…"
                : isEditMode
                  ? "Save Buddy Request"
                  : "Find My Travel Buddy"}
            </Text>
          </Pressable>
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
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
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

  editLoadingRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  editLoadingText: { color: colors.mutedText, fontSize: 13 },
  editErrorBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(220, 40, 40, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(220, 40, 40, 0.30)",
  },
  editErrorText: { color: colors.danger, fontSize: 13, fontWeight: "600" },

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
  fieldLabelMuted: {
    color: colors.mutedText,
    fontWeight: "500",
    textTransform: "none",
  },

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
  selectInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectInputText: { color: colors.text, fontSize: 14, flex: 1 },
  textarea: { minHeight: 84, paddingTop: 12 },

  rangeRow: { flexDirection: "row", gap: 8 },
  rangeCell: { flex: 1 },

  unitToggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: 2,
    gap: 2,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  unitToggleButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  unitToggleButtonActive: { backgroundColor: colors.primary },
  unitToggleText: { color: colors.mutedText, fontSize: 12, fontWeight: "700" },
  unitToggleTextActive: { color: colors.white },

  helperText: { color: colors.mutedText, fontSize: 11, marginTop: 4 },

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
  chipText: { color: colors.primary, fontSize: 12, fontWeight: "700" },

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
  buttonDisabled: { opacity: 0.6 },

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
    minWidth: 140,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  buttonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonSecondaryText: { color: colors.text, fontSize: 13, fontWeight: "700" },

  // Modal sheets shared
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
  pickerTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  pickerRowSelected: { backgroundColor: colors.surfaceTintPrimary, borderRadius: 8 },
  pickerRowText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  pickerRowTextSelected: { color: colors.primary, fontWeight: "800" },
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
  calendarTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
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
});
