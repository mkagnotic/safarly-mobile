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
 * Country picker built on a native `Modal` + `FlatList`. Filterable, fully
 * cross-platform (no native iOS/Android picker dependency), and lazy: the
 * sheet only mounts while open so it adds nothing to the render path of the
 * parent form when closed.
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
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [options, query]);

  const selectedLabel = countryLabel(value);

  const handleSelect = useCallback(
    (code: string) => {
      onChange(code);
      setOpen(false);
      setQuery("");
    },
    [onChange],
  );

  const closeModal = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

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

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={closeModal} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select country</Text>
            <Pressable onPress={closeModal} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.mutedText} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={colors.mutedText}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = item.code === value;
              return (
                <Pressable
                  onPress={() => handleSelect(item.code)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed ? styles.rowPressed : null,
                    selected ? styles.rowSelected : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={styles.rowName}>{item.name}</Text>
                  {selected ? (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  ) : (
                    <Text style={styles.rowCode}>{item.code}</Text>
                  )}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={<Text style={styles.empty}>No matches</Text>}
            contentContainerStyle={styles.listContent}
          />
        </View>
      </Modal>
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
  rowName: { color: colors.text, fontSize: 15, fontWeight: "500" },
  rowCode: { color: colors.mutedText, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  separator: { height: 1, backgroundColor: "transparent" },
  empty: { textAlign: "center", color: colors.mutedText, paddingVertical: 24 },
});
