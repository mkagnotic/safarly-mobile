import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "@/theme/colors";

/** Sentinel value the API recognizes for "any city". Web uses the same. */
export const ANY_CITY = "ANY";

interface Props {
  value: string;
  onChange: (city: string) => void;
  cities: readonly string[];
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * Cross-platform city picker for the Search screen. Modeled on the existing
 * CountryPicker — Modal + FlatList + searchable. Includes the "ANY" sentinel
 * row so users can search "from anywhere" or "to anywhere".
 */
export function CityPicker({
  value,
  onChange,
  cities,
  placeholder,
  disabled,
  invalid,
}: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.toLowerCase().includes(q));
  }, [cities, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const handleSelect = useCallback(
    (next: string) => {
      onChange(next);
      close();
    },
    [onChange, close],
  );

  const displayLabel = value === ANY_CITY ? "🌍 Any City" : value || "";

  return (
    <View style={styles.flex}>
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
        accessibilityLabel={displayLabel || placeholder}
      >
        <Text
          style={[styles.fieldText, !displayLabel && styles.fieldPlaceholder]}
          numberOfLines={1}
        >
          {displayLabel || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.mutedText} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={close}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select city</Text>
            <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.mutedText} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search cities"
              placeholderTextColor={colors.mutedText}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="words"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Pressable
                onPress={() => handleSelect(ANY_CITY)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                  value === ANY_CITY && styles.rowSelected,
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.anyText}>🌍 Any City</Text>
                {value === ANY_CITY ? (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
            }
            renderItem={({ item }) => {
              const selected = item === value;
              return (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                    selected && styles.rowSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={styles.rowName}>{item}</Text>
                  {selected ? (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No matches</Text>}
            contentContainerStyle={styles.listContent}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.input,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  fieldError: { borderWidth: 1, borderColor: colors.danger },
  fieldPressed: { opacity: 0.85 },
  fieldDisabled: { opacity: 0.5 },
  fieldText: { color: colors.text, fontSize: 14, fontWeight: "500", flex: 1 },
  fieldPlaceholder: { color: colors.mutedText, fontWeight: "400" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 15, 25, 0.4)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "78%",
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 16,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 8,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.input,
    borderRadius: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 0 },
  listContent: { paddingHorizontal: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  rowPressed: { backgroundColor: "rgba(0,0,0,0.04)" },
  rowSelected: { backgroundColor: "rgba(255, 122, 38, 0.08)" },
  rowName: { color: colors.text, fontSize: 14, fontWeight: "500" },
  anyText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  empty: { textAlign: "center", color: colors.mutedText, paddingVertical: 24 },
});
