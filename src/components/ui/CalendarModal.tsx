import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

interface CalendarCell {
  date: Date;
  inMonth: boolean;
}

/** Six-week Monday-start grid, padded from the neighbouring months. */
function buildCalendar(monthDate: Date): CalendarCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
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

export function isSameDay(a: Date | null, b: Date): boolean {
  return (
    !!a &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export interface CalendarModalProps {
  open: boolean;
  /** Optional heading, e.g. "Pick a delivery deadline". */
  title?: string;
  selected: Date | null;
  visibleMonth: Date;
  /** Earliest selectable day — anything before this is disabled. */
  today: Date;
  /** Latest selectable day. */
  maxDate: Date;
  onSelect: (date: Date) => void;
  onChangeMonth: (month: Date) => void;
  onClose: () => void;
}

/**
 * Shared month-grid date picker.
 *
 * Extracted because near-identical copies had already accumulated in
 * SendParcelScreen, ListTripScreen and CreateBuddyScreen (plus a fourth inline
 * calendar in EditTripModal). New callers should use this one; the existing
 * copies are candidates for migration but were left alone to keep that a
 * separate, reviewable change.
 */
export function CalendarModal({
  open,
  title,
  selected,
  visibleMonth,
  today,
  maxDate,
  onSelect,
  onChangeMonth,
  onClose,
}: Readonly<CalendarModalProps>) {
  const cells = useMemo(() => buildCalendar(visibleMonth), [visibleMonth]);
  const monthLabel = visibleMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (delta: number) => {
    const next = new Date(visibleMonth);
    next.setMonth(next.getMonth() + delta);
    onChangeMonth(next);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={styles.sheet}>
          {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}

          <View style={styles.header}>
            <Pressable
              onPress={() => shiftMonth(-1)}
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable
              onPress={() => shiftMonth(1)}
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((cell) => {
              const disabled = cell.date < today || cell.date > maxDate;
              const isSelected = isSameDay(selected, cell.date);
              const isToday = isSameDay(today, cell.date);
              return (
                <Pressable
                  key={cell.date.toISOString()}
                  disabled={disabled}
                  onPress={() => onSelect(cell.date)}
                  style={[
                    styles.cell,
                    isSelected && styles.cellSelected,
                    isToday && !isSelected && styles.cellToday,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled, selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.cellText,
                      !cell.inMonth && styles.cellTextMuted,
                      disabled && styles.cellTextDisabled,
                      isSelected && styles.cellTextSelected,
                    ]}
                  >
                    {cell.date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.4)" },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  sheet: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  monthLabel: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  weekRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "700",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  cellSelected: { backgroundColor: colors.wordmark },
  cellToday: { borderWidth: 1, borderColor: colors.wordmark },
  cellText: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  cellTextMuted: { color: colors.subtleText },
  cellTextDisabled: { color: colors.subtleText, opacity: 0.4 },
  cellTextSelected: { color: colors.white, fontWeight: "800" },
});
