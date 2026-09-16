import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { KeyboardAwareSheet } from "@/components/ui/KeyboardAwareSheet";
import { colors } from "@/theme/colors";

/** An extra fixed row above the results, e.g. "Any city". Never filtered out. */
export interface PickerLeadingOption {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export interface SearchablePickerSheetProps<T> {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: readonly T[];
  keyExtractor: (item: T) => string;
  /** Text shown for the row. */
  getLabel: (item: T) => string;
  /** Text the search box matches against. Defaults to the label. */
  getSearchText?: (item: T) => string;
  isSelected: (item: T) => boolean;
  onSelect: (item: T) => void;
  /** Shown at the right of an unselected row (a selected row shows a check). */
  renderTrailing?: (item: T) => ReactNode;
  leadingOption?: PickerLeadingOption;
  searchPlaceholder?: string;
  emptyText?: string;
  autoCapitalize?: "none" | "words";
}

/**
 * The app's searchable single-select picker. City and country selection render
 * through this, and any future searchable list should too — it owns the search
 * box, filtering, the list and its rows, and gets keyboard handling from
 * `KeyboardAwareSheet`, so none of that is re-implemented per picker.
 *
 * Selecting a row or closing the sheet dismisses the keyboard and clears the
 * query, so it always reopens on the full list.
 */
export function SearchablePickerSheet<T>({
  visible,
  onClose,
  title,
  items,
  keyExtractor,
  getLabel,
  getSearchText,
  isSelected,
  onSelect,
  renderTrailing,
  leadingOption,
  searchPlaceholder = "Search",
  emptyText = "No matches",
  autoCapitalize = "words",
}: Readonly<SearchablePickerSheetProps<T>>) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const textOf = getSearchText ?? getLabel;
    return items.filter((item) => textOf(item).toLowerCase().includes(q));
  }, [items, query, getSearchText, getLabel]);

  const close = useCallback(() => {
    Keyboard.dismiss();
    setQuery("");
    onClose();
  }, [onClose]);

  const choose = useCallback(
    (select: () => void) => {
      select();
      close();
    },
    [close],
  );

  return (
    <KeyboardAwareSheet visible={visible} onClose={close} title={title}>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.mutedText} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.mutedText}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize={autoCapitalize}
          returnKeyType="search"
          accessibilityLabel={searchPlaceholder}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={16} color={colors.mutedText} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        // Let a tap on a result land even while the keyboard is up.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          leadingOption ? (
            <PickerRow
              label={leadingOption.label}
              selected={leadingOption.selected}
              emphasised
              onPress={() => choose(leadingOption.onPress)}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <PickerRow
            label={getLabel(item)}
            selected={isSelected(item)}
            trailing={renderTrailing?.(item)}
            onPress={() => choose(() => onSelect(item))}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
      />
    </KeyboardAwareSheet>
  );
}

function PickerRow({
  label,
  selected,
  trailing,
  emphasised,
  onPress,
}: Readonly<{
  label: string;
  selected: boolean;
  trailing?: ReactNode;
  emphasised?: boolean;
  onPress: () => void;
}>) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, selected && styles.rowSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.rowLabel, emphasised && styles.rowLabelEmphasised]}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : trailing ?? null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0 },
  listContent: { paddingHorizontal: 12, paddingBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  rowPressed: { backgroundColor: "rgba(0,0,0,0.04)" },
  rowSelected: { backgroundColor: colors.surfaceTintPrimary },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: "500", flexShrink: 1 },
  rowLabelEmphasised: { fontWeight: "700" },
  empty: { textAlign: "center", color: colors.mutedText, paddingVertical: 24 },
});
