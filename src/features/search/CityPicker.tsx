import { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SearchablePickerSheet } from "@/components/ui/SearchablePickerSheet";
import { colors } from "@/theme/colors";

/** Sentinel value the API recognizes for "any city". Web uses the same. */
export const ANY_CITY = "ANY";

const ANY_CITY_LABEL = "🌍 Any City";

interface Props {
  value: string;
  onChange: (city: string) => void;
  cities: readonly string[];
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
  /** `compact` = slim pill (search filters); `card` = taller card (form layouts). */
  variant?: "compact" | "card";
}

/** City field plus the shared searchable picker sheet, with an "Any City" row on top. */
export function CityPicker({
  value,
  onChange,
  cities,
  placeholder,
  disabled,
  invalid,
  variant = "compact",
}: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const displayLabel = value === ANY_CITY ? ANY_CITY_LABEL : value || "";
  const isCard = variant === "card";
  const isFilled = !!value;

  return (
    <View style={styles.flex}>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [
          isCard ? styles.cardField : styles.field,
          invalid ? (isCard ? styles.cardFieldError : styles.fieldError) : null,
          pressed && !disabled ? styles.fieldPressed : null,
          disabled ? styles.fieldDisabled : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={displayLabel || placeholder}
      >
        <Text
          style={[
            isCard ? styles.cardFieldText : styles.fieldText,
            !displayLabel && (isCard ? styles.cardFieldPlaceholder : styles.fieldPlaceholder),
          ]}
          numberOfLines={1}
        >
          {displayLabel || placeholder}
        </Text>
        {isCard ? (
          <View style={styles.cardRight}>
            {isFilled ? (
              <Ionicons name="checkmark-circle" size={20} color={colors.safe} />
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
          </View>
        ) : (
          <Ionicons name="chevron-down" size={16} color={colors.mutedText} />
        )}
      </Pressable>

      <SearchablePickerSheet
        visible={open}
        onClose={close}
        title="Select city"
        searchPlaceholder="Search cities"
        items={cities}
        keyExtractor={cityKey}
        getLabel={cityKey}
        isSelected={(city) => city === value}
        onSelect={onChange}
        leadingOption={{
          label: ANY_CITY_LABEL,
          selected: value === ANY_CITY,
          onPress: () => onChange(ANY_CITY),
        }}
      />
    </View>
  );
}

const cityKey = (city: string) => city;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  fieldError: { borderColor: colors.danger },
  fieldPressed: { opacity: 0.85 },
  fieldDisabled: { opacity: 0.5 },
  fieldText: { color: colors.text, fontSize: 14, fontWeight: "500", flex: 1 },
  fieldPlaceholder: { color: colors.mutedText, fontWeight: "400" },

  cardField: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.surfaceTintPrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardFieldText: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "700", flex: 1 },
  cardFieldPlaceholder: { color: colors.mutedText, fontWeight: "500" },
  cardFieldError: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: "rgba(220, 40, 40, 0.06)",
  },
  cardRight: { flexDirection: "row", alignItems: "center", gap: 8 },
});
