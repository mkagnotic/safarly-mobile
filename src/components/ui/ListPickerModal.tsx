import { Ionicons } from "@expo/vector-icons";
import { FlatList, Modal, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

export interface ListPickerModalProps {
  open: boolean;
  title: string;
  options: readonly string[];
  /** Currently-chosen value; pass "" for pickers that only add (e.g. languages). */
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet single-select list.
 *
 * Extracted from `CreateBuddyScreen` so the buddy edit modal can offer the same
 * curated airline/language lists the create form does — it previously fell back
 * to a free-text airline input, which let edits write values that could never
 * match another listing's airline.
 */
export function ListPickerModal({
  open,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: Readonly<ListPickerModalProps>) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={colors.mutedText} />
          </Pressable>
        </View>
        <FlatList
          data={options}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const isSelected = item === selected;
            return (
              <Pressable
                onPress={() => onSelect(item)}
                style={[styles.row, isSelected && styles.rowSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>{item}</Text>
                {isSelected ? <Ionicons name="checkmark" size={16} color={colors.wordmark} /> : null}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.4)" },
  sheet: {
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  rowSelected: { backgroundColor: colors.surfaceTintPrimary, borderRadius: 8 },
  rowText: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  rowTextSelected: { color: colors.wordmark, fontWeight: "800" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
