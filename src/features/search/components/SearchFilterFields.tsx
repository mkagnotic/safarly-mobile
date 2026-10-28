import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { CityPicker } from "@/features/search/CityPicker";
import { DatePicker } from "@/features/search/DatePicker";
import type { LookingForType, SearchCountry } from "@/features/search/searchPersistence";
import { colors } from "@/theme/colors";
import { COUNTRY_FLAG, LOOKING_FOR_OPTIONS } from "@/features/search/lib/searchConfig";

interface SearchFilterFieldsProps {
  /** A search the user started with Apply is running: the button reads "Searching…". */
  applyRunning: boolean;
  fromCountry: SearchCountry;
  toCountry: SearchCountry;
  fromCountryLabel: string;
  toCountryLabel: string;
  toggleFromCountry: () => void;
  toggleToCountry: () => void;
  fromCity: string;
  setFromCity: (value: string) => void;
  toCity: string;
  setToCity: (value: string) => void;
  fromCities: readonly string[];
  toCities: readonly string[];
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  dateBounds: { todayIso: string; maxIso: string };
  lookingFor: LookingForType[];
  toggleLookingFor: (value: LookingForType) => void;
  hasActiveFilters: boolean;
  handleClear: () => void;
  searchBusy: boolean;
  handleApply: () => Promise<void>;
}

/**
 * Route, date range, "looking for" and Clear / Apply: the top of the filters
 * card. The browse / match-my-routes toggle beneath them stays in SearchScreen.
 */
export function SearchFilterFields({
  applyRunning,
  fromCountry,
  toCountry,
  fromCountryLabel,
  toCountryLabel,
  toggleFromCountry,
  toggleToCountry,
  fromCity,
  setFromCity,
  toCity,
  setToCity,
  fromCities,
  toCities,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  dateBounds,
  lookingFor,
  toggleLookingFor,
  hasActiveFilters,
  handleClear,
  searchBusy,
  handleApply,
}: Readonly<SearchFilterFieldsProps>) {
  return (
    <>
      {/* 28 Oct 2026: the fields stay editable while results load (web); only
          Apply waits. Labels are words, shown in capitals by the style. */}
      <Text style={styles.fieldLabel}>Route</Text>
      {/* Each side owns its country, so a domestic route (IN -> IN) is
          reachable. No swap control: with both sides independently
          switchable it would be a redundant third way to do the same thing,
          and the create forms don't have one either. */}
      <View style={styles.routeRow}>
        <View style={styles.routeCol}>
          <Pressable
            style={styles.countryChip}
            onPress={toggleFromCountry}
            accessibilityRole="button"
            accessibilityLabel={`Departure country: ${fromCountryLabel}. Tap to switch.`}
          >
            <Text style={styles.countryChipText} numberOfLines={1} textBreakStrategy="simple">
              {COUNTRY_FLAG[fromCountry]} {fromCountryLabel}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.mutedText} />
          </Pressable>
          <CityPicker
            value={fromCity}
            onChange={setFromCity}
            cities={fromCities}
            placeholder="From city"
          />
        </View>

        <View style={styles.routeCol}>
          <Pressable
            style={styles.countryChip}
            onPress={toggleToCountry}
            accessibilityRole="button"
            accessibilityLabel={`Arrival country: ${toCountryLabel}. Tap to switch.`}
          >
            <Text style={styles.countryChipText} numberOfLines={1} textBreakStrategy="simple">
              {COUNTRY_FLAG[toCountry]} {toCountryLabel}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.mutedText} />
          </Pressable>
          <CityPicker
            value={toCity}
            onChange={setToCity}
            cities={toCities}
            placeholder="To city"
          />
        </View>
      </View>

      {/* Date Range — tappable fields that open a calendar sheet. Bounded to
          today … +12 months (web parity); "To" can't precede "From". */}
      <Text style={[styles.fieldLabel, styles.fieldLabelTopGap]}>Date range</Text>
      <View style={styles.dateRow}>
        <DatePicker
          value={dateFrom}
          onChange={setDateFrom}
          placeholder="From date"
          minDate={dateBounds.todayIso}
          maxDate={dateBounds.maxIso}
        />
        <DatePicker
          value={dateTo}
          onChange={setDateTo}
          placeholder="To date"
          // As web's range picker: pick the start first.
          disabled={!dateFrom}
          minDate={dateFrom || dateBounds.todayIso}
          maxDate={dateBounds.maxIso}
        />
      </View>

      {/* Looking For */}
      <Text style={[styles.fieldLabel, styles.fieldLabelTopGap]}>Looking for</Text>
      <View style={styles.lookingForCol}>
        {LOOKING_FOR_OPTIONS.map((opt) => {
          const checked = lookingFor.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() => toggleLookingFor(opt.value)}
              style={styles.checkboxRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked ? (
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                ) : null}
              </View>
              {/* The row stretches and the label fills it (flex: 1): a shrink-wrapped row
                  let Android under-measure the bold label and draw only "Travel" of
                  "Travel buddy" (23 Oct 2026). */}
              <Text style={styles.checkboxLabel} textBreakStrategy="simple">{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.applyRow}>
        {hasActiveFilters ? (
          <AppButton
            label="Clear"
            variant="secondary"
            onPress={handleClear}
            style={styles.applyButtonFlex}
          />
        ) : null}
        <AppButton
          label={applyRunning ? "Searching…" : "Apply filters"}
          onPress={() => void handleApply()}
          disabled={searchBusy}
          gradientColors={[colors.ctaAccent, colors.ctaAccent]}
          style={styles.applyButtonFlex}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  fieldLabelTopGap: { marginTop: 6 },
  routeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  routeCol: { flex: 1, minWidth: 0, gap: 8 },
  countryChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  // One line that may shrink: Android under-measured the bold "🇺🇸 USA" in this
  // centred row at larger text and drew only the flag (same quirk as the
  // "Travel Buddy" label below).
  countryChipText: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700", flexShrink: 1 },
  dateRow: { flexDirection: "row", gap: 8 },
  lookingForCol: { gap: 14, marginTop: 4 },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "stretch" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.controlOutline,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.wordmark, borderColor: colors.wordmark },
  checkboxLabel: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  applyRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  applyButtonFlex: { flex: 1 },
});
