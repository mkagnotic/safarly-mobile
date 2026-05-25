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
import { DateField, LocationCard, SectionCard } from "@/components/ui/FormSection";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { ANY_CITY, CityPicker } from "@/features/search/CityPicker";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { getErrorMessage, parcelsApi } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { sanitizeDecimalInput } from "@/utils/inputSanitizers";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "SendParcelTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

type Direction = "IN_TO_US" | "US_TO_IN";
type WeightUnit = "kg" | "lb";
type SizeUnit = "cm" | "in";
type Currency = "USD" | "INR";

/** Keys for fields that can carry an inline validation error. */
type FieldKey = "fromCity" | "toCity" | "weight" | "deliveryBy" | "feeOffered";

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
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-start week

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
  // Online-order pre-declare — unlocks the post-possession return-waiver path
  // server-side; captured here, sent through in PR2.
  const [isOnlineOrder, setIsOnlineOrder] = useState(false);
  const [returnEligible, setReturnEligible] = useState(false);
  const [returnLine1, setReturnLine1] = useState("");
  const [returnCity, setReturnCity] = useState("");
  const [returnRegion, setReturnRegion] = useState("");
  const [returnPostal, setReturnPostal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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
  const fromFlag = direction === "IN_TO_US" ? "🇮🇳" : "🇺🇸";
  const toFlag = direction === "IN_TO_US" ? "🇺🇸" : "🇮🇳";
  const fromCountryName = direction === "IN_TO_US" ? "India" : "United States";
  const toCountryName = direction === "IN_TO_US" ? "United States" : "India";
  const fromCities = direction === "IN_TO_US" ? INDIA_CITIES : USA_CITIES;
  const toCities = direction === "IN_TO_US" ? USA_CITIES : INDIA_CITIES;

  const handleSwapDirection = useCallback(() => {
    setDirection((d) => (d === "IN_TO_US" ? "US_TO_IN" : "IN_TO_US"));
    setFromCity("");
    setToCity("");
  }, []);

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
    weight: "section2",
    deliveryBy: "section3",
    feeOffered: "section4",
  };

  const clearFieldError = useCallback((key: FieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const scrollToField = useCallback((key: FieldKey) => {
    const sectionKey = fieldToSection[key];
    const y = sectionYs.current[sectionKey];
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  }, [fieldToSection]);

  const section1Complete = !!fromCity && !!toCity;
  const section2Complete = Number(weight) > 0;
  const section3Complete = !!deliveryBy;
  const section4Complete = Number(feeOffered) > 0;

  const requiredTotal = 5;
  const requiredCompleted =
    (fromCity ? 1 : 0) +
    (toCity ? 1 : 0) +
    (Number(weight) > 0 ? 1 : 0) +
    (deliveryBy ? 1 : 0) +
    (Number(feeOffered) > 0 ? 1 : 0);
  const progressPct = Math.round((requiredCompleted / requiredTotal) * 100);

  const maxLimits = sizeUnit === "cm" ? MAX_SIZE_CM : MAX_SIZE_IN;
  const sizeErrors = {
    l: !!sizeL && parseFloat(sizeL) > maxLimits.l,
    w: !!sizeW && parseFloat(sizeW) > maxLimits.w,
    h: !!sizeH && parseFloat(sizeH) > maxLimits.h,
  };
  const hasSizeError = sizeErrors.l || sizeErrors.w || sizeErrors.h;

  const handleSubmit = useCallback(async () => {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (!fromCity) errors.fromCity = "Select an origin city";
    if (!toCity) errors.toCity = "Select a destination city";
    const w = parseFloat(weight);
    if (!w || w <= 0) errors.weight = "Enter a valid weight";
    if (!deliveryBy) {
      errors.deliveryBy = "Pick a delivery date";
    } else if (deliveryBy < today) {
      errors.deliveryBy = "Can't be in the past";
    } else if (deliveryBy > maxDate) {
      errors.deliveryBy = "Must be within 12 months";
    }
    const fee = parseFloat(feeOffered);
    if (!fee || fee <= 0) errors.feeOffered = "Enter a valid amount";

    if (Object.keys(errors).length > 0 || hasSizeError) {
      setFieldErrors(errors);
      setFormError(
        hasSizeError
          ? `Size exceeds airline carry-on limit (max ${maxLimits.l}×${maxLimits.w}×${maxLimits.h} ${sizeUnit}). Fix the highlighted fields.`
          : "Please fix the highlighted fields before continuing.",
      );
      const order: FieldKey[] = ["fromCity", "toCity", "weight", "deliveryBy", "feeOffered"];
      const firstKey = order.find((k) => errors[k]);
      if (firstKey) scrollToField(firstKey);
      else if (hasSizeError) scrollToField("weight"); // size lives in same section
      return;
    }

    if (!deliveryBy) return; // narrow for TS — guarded above


    setFieldErrors({});
    setFormError(null);

    // Server stores weight in kg; convert lb on the way in.
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
      setFormError(`Couldn't post request. ${getErrorMessage(err)}`);
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
    scrollToField,
  ]);

  const resetForm = useCallback(() => {
    setDirection("IN_TO_US");
    setFromCity("");
    setToCity("");
    setParcelType("");
    setWeightUnit("kg");
    setWeight("");
    setSizeUnit("cm");
    setSizeL("");
    setSizeW("");
    setSizeH("");
    setDescription("");
    setDeliveryBy(null);
    setFeeOffered("");
    setCurrency("USD");
    setIsOnlineOrder(false);
    setReturnEligible(false);
    setReturnLine1("");
    setReturnCity("");
    setReturnRegion("");
    setReturnPostal("");
    setSubmitting(false);
    setSubmitted(false);
    setFormError(null);
    setFieldErrors({});
    setCalendarOpen(false);
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
          <Text style={styles.title}>Request posted</Text>
        </View>
        <View style={styles.successWrap}>
          <View style={styles.successIconBubble}>
            <Ionicons name="checkmark" size={40} color={colors.safe} />
          </View>
          <Text style={styles.successTitle}>Request posted</Text>
          <Text style={styles.successBody}>
            Carriers on matching routes will be notified. Sit tight!
          </Text>
          <View style={styles.successButtons}>
            <AppButton
              label="View my parcels"
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
          <Text style={styles.title}>Your parcel details</Text>
        </View>
        <Text style={styles.subtitle}>
          Tell us where your parcel needs to go and we'll find the perfect carrier.
        </Text>

        {/* Progress bar — % of required fields complete (5 required). */}
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

        {/* ───────── Section 1 — Where is it going? ───────── */}
        <View
          onLayout={(e) => {
            sectionYs.current.section1 = e.nativeEvent.layout.y;
          }}
        >
          <SectionCard
            index={1}
            title="Where is it going?"
            subtitle="Set the pickup and drop-off"
            complete={section1Complete}
          >
            <Text style={styles.fieldLabel}>From</Text>
            <LocationCard flag={fromFlag} label={fromCountryName} filled />
            <View>
              <CityPicker
                value={fromCity}
                onChange={(v) => {
                  setFromCity(v);
                  clearFieldError("fromCity");
                }}
                cities={fromCities}
                placeholder="Select origin city"
                variant="card"
                invalid={!!fieldErrors.fromCity}
              />
              {fieldErrors.fromCity ? (
                <Text style={styles.inlineError}>{fieldErrors.fromCity}</Text>
              ) : null}
            </View>

            <View style={styles.swapRow}>
              <View style={styles.swapDividerLine} />
              <Pressable
                style={styles.swapCircleButton}
                onPress={handleSwapDirection}
                accessibilityRole="button"
                accessibilityLabel="Swap direction"
              >
                <Ionicons name="swap-vertical-outline" size={18} color={colors.wordmark} />
              </Pressable>
              <View style={styles.swapDividerLine} />
            </View>

            <Text style={styles.fieldLabel}>To</Text>
            <LocationCard flag={toFlag} label={toCountryName} filled />
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

        {/* ───────── Section 2 — Parcel details ───────── */}
        <View
          onLayout={(e) => {
            sectionYs.current.section2 = e.nativeEvent.layout.y;
          }}
        >
          <SectionCard
            index={2}
            title="What's in the parcel?"
            subtitle="Help carriers understand what you're sending"
            complete={section2Complete}
          >
            <Text style={styles.fieldLabel}>Type of parcel</Text>
            <TextInput
              value={parcelType}
              onChangeText={setParcelType}
              placeholder="e.g. Documents, Electronics, Clothing, Food"
              placeholderTextColor={colors.subtleText}
              style={styles.input}
              autoCapitalize="words"
            />

            <View style={styles.labelToggleRow}>
              <Text style={styles.fieldLabel}>Parcel size</Text>
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
                : `Airline carry-on max: ${maxLimits.l}×${maxLimits.w}×${maxLimits.h} ${sizeUnit}`}
            </Text>

            <View style={[styles.labelToggleRow, styles.labelToggleRowGap]}>
              <Text style={styles.fieldLabel}>Parcel weight</Text>
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
                value={weight}
                onChangeText={(v) => {
                  setWeight(sanitizeDecimalInput(v, 4, 2));
                  clearFieldError("weight");
                }}
                placeholder={weightUnit === "kg" ? "0 kg" : "0 lb"}
                placeholderTextColor={colors.subtleText}
                keyboardType="decimal-pad"
                style={[styles.input, fieldErrors.weight && styles.inputError]}
              />
              {fieldErrors.weight ? (
                <Text style={styles.inlineError}>{fieldErrors.weight}</Text>
              ) : null}
            </View>

            <Text style={[styles.fieldLabel, styles.labelTopGap]}>
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
          </SectionCard>
        </View>

        {/* ───────── Section 3 — When does it need to arrive? ───────── */}
        <View
          onLayout={(e) => {
            sectionYs.current.section3 = e.nativeEvent.layout.y;
          }}
        >
          <SectionCard
            index={3}
            title="When does it need to arrive?"
            subtitle="Pick a delivery deadline"
            complete={section3Complete}
          >
            <DateField
              label="Deliver by"
              value={deliveryBy ? formatDateLabel(deliveryBy) : null}
              placeholder="Select date"
              onPress={() => setCalendarOpen(true)}
              error={fieldErrors.deliveryBy}
            />
            <Text style={styles.helperText}>
              Select the latest date you need this delivered by.
            </Text>
          </SectionCard>
        </View>

        {/* ───────── Section 4 — How much will you pay? ───────── */}
        <View
          onLayout={(e) => {
            sectionYs.current.section4 = e.nativeEvent.layout.y;
          }}
        >
          <SectionCard
            index={4}
            title="How much will you pay?"
            subtitle="Set a fair carrier fee"
            complete={section4Complete}
          >
            <View style={styles.costRow}>
              <CurrencyToggle value={currency} onChange={setCurrency} />
              <View style={styles.costInputWrap}>
                <Text style={styles.costSymbol}>
                  {currency === "USD" ? "$" : "₹"}
                </Text>
                <TextInput
                  value={feeOffered}
                  onChangeText={(v) => {
                    setFeeOffered(sanitizeDecimalInput(v, 6, 2));
                    clearFieldError("feeOffered");
                  }}
                  placeholder="e.g. 45"
                  placeholderTextColor={colors.subtleText}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.costInput, fieldErrors.feeOffered && styles.inputError]}
                />
              </View>
            </View>
            {fieldErrors.feeOffered ? (
              <Text style={styles.inlineError}>{fieldErrors.feeOffered}</Text>
            ) : (
              <Text style={styles.helperText}>
                The amount you're willing to pay the carrier for delivery.
              </Text>
            )}
          </SectionCard>
        </View>

        {/* Online-order pre-declare — optional. When on, the sender flags the
            parcel as an online order, which unlocks the carrier's return-eligibility
            waiver path if they cancel mid-trip. */}
        <View style={styles.onlineOrderCard}>
          <Pressable
            onPress={() => setIsOnlineOrder((v) => !v)}
            style={styles.onlineOrderHeader}
            accessibilityRole="switch"
            accessibilityState={{ checked: isOnlineOrder }}
            accessibilityLabel="This is an online order"
          >
            <View style={styles.onlineOrderHeaderText}>
              <Text style={styles.onlineOrderTitle}>This is an online order</Text>
              <Text style={styles.onlineOrderSubtitle}>
                If a carrier cancels mid-trip and the seller will accept the parcel back,
                you can waive their penalty later. Optional.
              </Text>
            </View>
            <View style={[styles.toggleTrack, isOnlineOrder && styles.toggleTrackOn]}>
              <View style={[styles.toggleThumb, isOnlineOrder && styles.toggleThumbOn]} />
            </View>
          </Pressable>

          {isOnlineOrder ? (
            <View style={styles.onlineOrderBody}>
              <Pressable
                onPress={() => setReturnEligible((v) => !v)}
                style={styles.checkRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: returnEligible }}
                accessibilityLabel="Eligible for return to seller"
              >
                <View
                  style={[
                    styles.checkBox,
                    returnEligible && styles.checkBoxOn,
                  ]}
                >
                  {returnEligible ? (
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  ) : null}
                </View>
                <Text style={styles.checkLabel}>
                  Eligible for return to the seller within their return window
                </Text>
              </Pressable>

              {returnEligible ? (
                <View style={styles.returnAddressBlock}>
                  <Text style={styles.fieldLabel}>Return address</Text>
                  <TextInput
                    value={returnLine1}
                    onChangeText={setReturnLine1}
                    placeholder="Street address"
                    placeholderTextColor={colors.subtleText}
                    style={styles.input}
                    autoCapitalize="words"
                  />
                  <View style={styles.returnAddressRow}>
                    <TextInput
                      value={returnCity}
                      onChangeText={setReturnCity}
                      placeholder="City"
                      placeholderTextColor={colors.subtleText}
                      style={[styles.input, styles.returnAddressCell]}
                      autoCapitalize="words"
                    />
                    <TextInput
                      value={returnRegion}
                      onChangeText={setReturnRegion}
                      placeholder="State / region"
                      placeholderTextColor={colors.subtleText}
                      style={[styles.input, styles.returnAddressCell]}
                      autoCapitalize="words"
                    />
                  </View>
                  <TextInput
                    value={returnPostal}
                    onChangeText={setReturnPostal}
                    placeholder="ZIP / postal code"
                    placeholderTextColor={colors.subtleText}
                    style={styles.input}
                    autoCapitalize="characters"
                  />
                  <Text style={styles.helperText}>
                    The carrier will only see this address if they need to return the parcel
                    after cancelling mid-trip.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Restricted items notice — non-field disclosure shown right before submit. */}
        <View style={styles.warningBox}>
          <Ionicons
            name="warning"
            size={16}
            color={colors.warning}
            style={styles.warningIcon}
          />
          <View style={styles.warningBody}>
            <Text style={styles.warningTitle}>Restricted items notice</Text>
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

        <View style={styles.submitRow}>
          <AppButton
            label={submitting ? "Posting…" : "Submit & find carriers"}
            onPress={() => void handleSubmit()}
            disabled={submitting}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            leftIcon={
              submitting ? <ActivityIndicator size="small" color={colors.white} /> : undefined
            }
          />
        </View>
      </ScrollView>

      {/* Inline calendar modal */}
      <CalendarModal
        open={calendarOpen}
        selected={deliveryBy}
        visibleMonth={visibleMonth}
        today={today}
        maxDate={maxDate}
        onSelect={(d) => {
          setDeliveryBy(d);
          clearFieldError("deliveryBy");
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
      <View style={styles.calendarCenterWrap} pointerEvents="box-none">
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
          <AppButton label="Cancel" variant="secondary" onPress={onClose} />
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

  // ───── Common fields ─────
  fieldLabel: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  fieldLabelMuted: { color: colors.subtleText, fontWeight: "500" },
  labelTopGap: { marginTop: 8 },

  flexSpacer: { flex: 1 },
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

  // ───── Section 1: swap divider + circle button ─────
  swapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 4,
  },
  swapDividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  swapCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: primaryTint.stroke25,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
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
  textarea: { minHeight: 84, paddingTop: 12 },

  inlineError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 6,
  },

  // ───── Per-row label + unit toggle ─────
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

  costRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  currencyToggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 2,
    gap: 2,
  },
  currencyButton: { paddingHorizontal: 10, paddingVertical: Platform.OS === "ios" ? 11 : 9, borderRadius: 10 },
  currencyButtonActive: { backgroundColor: colors.wordmark },
  currencyText: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  currencyTextActive: { color: colors.white },
  costInputWrap: { flex: 1, position: "relative" },
  costSymbol: {
    position: "absolute",
    left: 12,
    top: Platform.OS === "ios" ? 12 : 10,
    color: colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    zIndex: 1,
  },
  costInput: { paddingLeft: 28 },

  onlineOrderCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  onlineOrderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  onlineOrderHeaderText: { flex: 1, gap: 2 },
  onlineOrderTitle: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  onlineOrderSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  onlineOrderBody: { gap: 12, marginTop: 4 },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
    padding: 2,
  },
  toggleTrackOn: { backgroundColor: colors.wordmark },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1.5,
    elevation: 2,
  },
  toggleThumbOn: { transform: [{ translateX: 18 }] },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.controlOutline,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkBoxOn: { backgroundColor: colors.wordmark, borderColor: colors.wordmark },
  checkLabel: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    flex: 1,
  },
  returnAddressBlock: { gap: 8 },
  returnAddressRow: { flexDirection: "row", gap: 8 },
  returnAddressCell: { flex: 1 },

  warningBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(245, 159, 10, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(245, 159, 10, 0.36)",
  },
  warningIcon: { marginTop: 2 },
  warningBody: { flex: 1, gap: 4 },
  warningTitle: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  warningText: { color: colors.mutedText, fontSize: 13, lineHeight: 19, fontWeight: "500" },
  warningStrong: { color: colors.text, fontWeight: "800" },

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

  calendarBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.4)" },
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
  calendarFooter: { alignItems: "flex-end", marginTop: 4 },
});
