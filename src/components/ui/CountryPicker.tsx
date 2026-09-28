import { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SearchablePickerSheet } from "@/components/ui/SearchablePickerSheet";
import { COUNTRIES, countryLabel, type CountryOption } from "@/features/profile/countries";
import { colors } from "@/theme/colors";

interface Props {
  value: string | null;
  onChange: (code: string) => void;
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
  disabled?: boolean;
  /** Optional override list — defaults to the shared COUNTRIES constant. */
  options?: readonly CountryOption[];
  /** When true, renders the field with the danger border. Caller owns the message. */
  invalid?: boolean;
}

/**
 * Country field plus the shared searchable picker sheet. Fully cross-platform
 * (no native iOS/Android picker dependency); search matches the country name or
 * its ISO code.
 */
export function CountryPicker({
  value,
  onChange,
  placeholder = "Select country",
  disabled,
  options = COUNTRIES,
  invalid,
}: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const selectedLabel = countryLabel(value);

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.field,
          invalid ? styles.fieldError : null,
          pressed && !disabled ? styles.fieldPressed : null,
          disabled ? styles.fieldDisabled : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={selectedLabel || placeholder}
      >
        {/* Plain Text, not TextInput — Android renders non-editable inputs with
            disabled metrics that can't be overridden. fieldText below uses
            explicit metrics to align with AppInput's editable TextInput. */}
        <Text
          style={[styles.fieldText, !selectedLabel ? styles.fieldPlaceholder : null]}
          numberOfLines={1}
        >
          {selectedLabel || placeholder}
        </Text>
        <View style={styles.chevronWrap} pointerEvents="none">
          <Ionicons name="chevron-down" size={18} color={colors.mutedText} />
        </View>
      </Pressable>

      <SearchablePickerSheet
        visible={open}
        onClose={close}
        title="Select country"
        searchPlaceholder="Search countries"
        autoCapitalize="none"
        items={options}
        keyExtractor={(c) => c.code}
        getLabel={(c) => c.name}
        // Match on the ISO code too, so "US" or "IN" finds the country.
        getSearchText={(c) => `${c.name} ${c.code}`}
        isSelected={(c) => c.code === value}
        onSelect={(c) => onChange(c.code)}
        renderTrailing={(c) => <Text style={styles.rowCode}>{c.code}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Mirrors AppInput.input so the picker reads the same height as text inputs.
  field: {
    backgroundColor: colors.input,
    borderRadius: 12,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 38,
    minHeight: 48,
    justifyContent: "center",
  },
  fieldError: { borderColor: colors.danger },
  fieldPressed: { opacity: 0.85 },
  fieldDisabled: { opacity: 0.5 },
  fieldText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  fieldPlaceholder: { color: colors.mutedText },
  chevronWrap: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  rowCode: { color: colors.mutedText, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
});
