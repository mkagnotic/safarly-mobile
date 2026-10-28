import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { CountryPicker } from "@/components/ui/CountryPicker";
import { colors } from "@/theme/colors";
import {
  EMPTY_RETURN_FORM,
  RETURN_COUNTRIES,
  RETURN_REFERENCE_MAX,
  RETURN_STREET_MAX,
  postalHint,
  sanitisePostal,
  statesFor,
  type ReturnAddressErrors,
  type ReturnFormValues,
} from "@/utils/addressOptions";

type AddressKey = keyof ReturnAddressErrors;

interface Props {
  value: ReturnFormValues;
  onChange: (patch: Partial<ReturnFormValues>) => void;
  errors?: ReturnAddressErrors;
  /** Called when a field with an error is edited, so the caller can clear it. */
  onFieldEdited?: (key: AddressKey) => void;
  disabled?: boolean;
}

const COUNTRY_OPTIONS = RETURN_COUNTRIES.map((c) => ({ code: c.value, name: c.label }));

/**
 * "This is an online order" / "It can be returned to the seller" plus the
 * seller's return address. One block for the send form and the edit modal, so
 * the two can't drift (27 Oct 2026).
 */
export function ReturnAddressFields({ value, onChange, errors = {}, onFieldEdited, disabled }: Readonly<Props>) {
  const stateOptions = useMemo(
    () => statesFor(value.country).map((s) => ({ code: s.value, name: s.label })),
    [value.country],
  );
  const edited = (key: AddressKey) => onFieldEdited?.(key);
  const isIndia = value.country === "IN";
  const postalLabel = isIndia ? "PIN code" : "Postal code";

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() =>
          // Unticking clears everything under it: option 2, address, order number.
          onChange(value.isOnlineOrder ? { ...EMPTY_RETURN_FORM } : { isOnlineOrder: true })
        }
        disabled={disabled}
        style={styles.header}
        accessibilityRole="switch"
        accessibilityState={{ checked: value.isOnlineOrder, disabled }}
        accessibilityLabel="This is an online order"
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>This is an online order</Text>
          <Text style={styles.subtitle}>A shop purchase rather than a personal item. Optional.</Text>
        </View>
        <View style={[styles.toggleTrack, value.isOnlineOrder && styles.toggleTrackOn]}>
          <View style={[styles.toggleThumb, value.isOnlineOrder && styles.toggleThumbOn]} />
        </View>
      </Pressable>

      {value.isOnlineOrder ? (
        <View style={styles.body}>
          <Pressable
            onPress={() => onChange({ returnEligible: !value.returnEligible })}
            disabled={disabled}
            style={styles.checkRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: value.returnEligible, disabled }}
            accessibilityLabel="It can be returned to the seller"
          >
            <View style={[styles.checkBox, value.returnEligible && styles.checkBoxOn]}>
              {value.returnEligible ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
            </View>
            <View style={styles.checkText}>
              <Text style={styles.checkLabel}>It can be returned to the seller</Text>
              <Text style={styles.subtitle}>
                If the carrier declines it at handoff or cancels after collecting it, you can have it
                sent back to the seller. If they cancel mid-trip and confirm the return, you can also
                choose to waive their penalty.
              </Text>
            </View>
          </Pressable>

          {value.returnEligible ? (
            <View style={styles.addressBlock}>
              <View style={styles.addressHeading}>
                <Text style={styles.blockTitle}>Seller's return address</Text>
                <Text style={styles.subtitle}>Where should the parcel go if the delivery falls through?</Text>
              </View>

              <AppInput
                label="Street address *"
                accessibilityLabel="Street address"
                value={value.line1}
                onChangeText={(v) => { onChange({ line1: v }); edited("line1"); }}
                placeholder="123 Market Street"
                autoCapitalize="words"
                maxLength={RETURN_STREET_MAX}
                editable={!disabled}
                error={errors.line1}
              />

              {/* Country first: it decides which states are offered and how
                  the postal code is validated. */}
              <View style={styles.pickerField}>
                <Text style={styles.label}>Country *</Text>
                <CountryPicker
                  value={value.country}
                  onChange={(v) => {
                    // A state from the previous country would no longer be valid.
                    onChange({ country: v, state: "" });
                    edited("country");
                    edited("state");
                  }}
                  placeholder="Select a country"
                  options={COUNTRY_OPTIONS}
                  disabled={disabled}
                  invalid={!!errors.country}
                />
                {errors.country ? <Text style={styles.error}>{errors.country}</Text> : null}
              </View>

              <View style={styles.pickerField}>
                <Text style={styles.label}>State / region *</Text>
                <CountryPicker
                  value={value.state}
                  onChange={(v) => { onChange({ state: v }); edited("state"); }}
                  placeholder={value.country ? "Select a state" : "Select a country first"}
                  disabled={disabled || !value.country}
                  options={stateOptions}
                  invalid={!!errors.state}
                />
                {errors.state ? <Text style={styles.error}>{errors.state}</Text> : null}
              </View>

              <AppInput
                label="City *"
                accessibilityLabel="City"
                value={value.city}
                // Digits are stripped as you type - a city is never a number.
                onChangeText={(v) => { onChange({ city: v.replace(/[0-9]/g, "") }); edited("city"); }}
                placeholder="San Francisco"
                autoCapitalize="words"
                editable={!disabled}
                error={errors.city}
              />
              <AppInput
                label={`${postalLabel} *`}
                accessibilityLabel={postalLabel}
                value={value.postal}
                // Letters can never be part of a postal code.
                onChangeText={(v) => { onChange({ postal: sanitisePostal(v) }); edited("postal"); }}
                placeholder={isIndia ? "560001" : "94105"}
                keyboardType="number-pad"
                maxLength={10}
                editable={!disabled}
                error={errors.postal}
                hint={postalHint(value.country) ?? undefined}
              />

              <AppInput
                label="Order or RMA number (optional)"
                value={value.reference}
                onChangeText={(v) => onChange({ reference: v })}
                placeholder="e.g. 112-3456789-1234567"
                maxLength={RETURN_REFERENCE_MAX}
                autoCapitalize="characters"
                editable={!disabled}
                hint="Shown only if the parcel has to go back — if the carrier declines it at handoff or cancels mid-trip. The order number lets them file the return against the right purchase."
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  body: { gap: 12, marginTop: 4 },
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
  checkText: { flex: 1, gap: 2 },
  checkLabel: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  addressBlock: { gap: 2 },
  addressHeading: { gap: 2, marginBottom: 10 },
  blockTitle: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  pickerField: { marginBottom: 14 },
  // Same look as AppInput's label so every field in the block matches.
  label: { color: colors.mutedText, marginBottom: 8, fontSize: 12, fontWeight: "600" },
  error: { color: colors.danger, fontSize: 12, fontWeight: "500", marginTop: 4 },
});
