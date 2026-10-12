import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { CityPicker } from "@/features/search/CityPicker";
import { DatePicker } from "@/features/search/DatePicker";
import type { LookingForType, SearchCountry } from "@/features/search/searchPersistence";
import { colors } from "@/theme/colors";
import { COUNTRY_FLAG, ISO_DATE, LOOKING_FOR_OPTIONS } from "@/features/search/lib/searchConfig";

interface SearchFilterFieldsProps {
  loading: boolean;
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
  loading,
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
      <Text style={styles.fieldLabel}>ROUTE</Text>
      {/* Each side owns its country, so a domestic route (IN -> IN) is
          reachable. No swap control: with both sides independently
          switchable it would be a redundant third way to do the same thing,
          and the create forms don't have one either. */}
      <View style={styles.routeRow}>
        <View style={styles.routeCol}>
          <Pressable
            style={styles.countryChip}
            onPress={toggleFromCountry}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={`Departure country: ${fromCountryLabel}. Tap to switch.`}
          >
            <Text style={styles.countryChipText}>
              {COUNTRY_FLAG[fromCountry]} {fromCountryLabel}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.mutedText} />
          </Pressable>
          <CityPicker
            value={fromCity}
            onChange={setFromCity}
            cities={fromCities}
            placeholder="From city"
            disabled={loading}
          />
        </View>

        <View style={styles.routeCol}>
          <Pressable
            style={styles.countryChip}
            onPress={toggleToCountry}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={`Arrival country: ${toCountryLabel}. Tap to switch.`}
          >
            <Text style={styles.countryChipText}>
              {COUNTRY_FLAG[toCountry]} {toCountryLabel}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.mutedText} />
          </Pressable>
          <CityPicker
            value={toCity}
            onChange={setToCity}
            cities={toCities}
            placeholder="To city"
            disabled={loading}
          />
        </View>
      </View>

      {/* Date Range — tappable fields that open a calendar sheet. Bounded to
          today … +12 months (web parity); "To" can't precede "From". */}
      <Text style={[styles.fieldLabel, styles.fieldLabelTopGap]}>DATE RANGE</Text>
      <View style={styles.dateRow}>
        <DatePicker
          value={dateFrom}
          onChange={setDateFrom}
          placeholder="From date"
          disabled={loading}
          minDate={dateBounds.todayIso}
          maxDate={dateBounds.maxIso}
        />
        <DatePicker
          value={dateTo}
          onChange={setDateTo}
          placeholder="To date"
          disabled={loading}
          minDate={dateFrom && ISO_DATE.test(dateFrom) ? dateFrom : dateBounds.todayIso}
          maxDate={dateBounds.maxIso}
        />
      </View>

      {/* Looking For */}
      <Text style={[styles.fieldLabel, styles.fieldLabelTopGap]}>LOOKING FOR</Text>
      <View style={styles.lookingForCol}>
        {LOOKING_FOR_OPTIONS.map((opt) => {
          const checked = lookingFor.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() => toggleLookingFor(opt.value)}
              style={styles.checkboxRow}
              disabled={loading}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked ? (
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                ) : null}
              </View>
              <Text style={styles.checkboxLabel}>{opt.label}</Text>
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
            disabled={searchBusy}
            style={styles.applyButtonFlex}
          />
        ) : null}
        <AppButton
          label={loading ? "Searching…" : "Apply Filters & Search"}
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
  countryChipText: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  dateRow: { flexDirection: "row", gap: 8 },
  lookingForCol: { gap: 14, marginTop: 4 },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 12 },
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
  checkboxLabel: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  applyRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  applyButtonFlex: { flex: 1 },
});
