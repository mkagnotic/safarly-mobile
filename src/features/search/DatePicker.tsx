import { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, primaryTint } from "@/theme/colors";

interface Props {
  /** ISO date string "YYYY-MM-DD" or empty. */
  value: string;
  onChange: (date: string) => void;
  placeholder: string;
  disabled?: boolean;
  /** Earliest selectable day (ISO "YYYY-MM-DD"). Days before it are disabled. */
  minDate?: string;
  /** Latest selectable day (ISO "YYYY-MM-DD"). Days after it are disabled. */
  maxDate?: string;
}

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromIso(s: string): Date | null {
  if (!s) return null;
  // Local midnight — avoids a UTC offset shifting the date by one day.
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function buildGrid(month: Date): { date: Date; inMonth: boolean }[] {
  const first = startOfMonth(month);
  const leading = first.getDay(); // 0=Sun
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() - leading + i);
    cells.push({ date: d, inMonth: d.getMonth() === month.getMonth() });
  }
  return cells;
}

function formatDisplay(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DatePicker({ value, onChange, placeholder, disabled, minDate, maxDate }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const initialMonth = useMemo(() => startOfMonth(fromIso(value) ?? new Date()), [value]);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  // Re-anchor to the selected month each time the sheet opens.
  useEffect(() => {
    if (open) setViewMonth(initialMonth);
  }, [open, initialMonth]);

  const selectedIso = value;
  const todayIso = toIso(new Date());

  const cells = useMemo(() => buildGrid(viewMonth), [viewMonth]);

  // Month-level bounds so the ‹ › nav can't leave the allowed [min, max] window.
  const minMonth = useMemo(() => {
    const d = minDate ? fromIso(minDate) : null;
    return d ? startOfMonth(d) : null;
  }, [minDate]);
  const maxMonth = useMemo(() => {
    const d = maxDate ? fromIso(maxDate) : null;
    return d ? startOfMonth(d) : null;
  }, [maxDate]);
  const prevDisabled = !!minMonth && startOfMonth(viewMonth).getTime() <= minMonth.getTime();
  const nextDisabled = !!maxMonth && startOfMonth(viewMonth).getTime() >= maxMonth.getTime();

  const close = useCallback(() => setOpen(false), []);
  const goPrev = useCallback(() => setViewMonth((m) => addMonths(m, -1)), []);
  const goNext = useCallback(() => setViewMonth((m) => addMonths(m, 1)), []);

  const handlePick = useCallback(
    (d: Date) => {
      onChange(toIso(d));
      setOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange("");
    setOpen(false);
  }, [onChange]);

  const selectedDate = fromIso(value);
  const displayLabel = selectedDate ? formatDisplay(selectedDate) : "";

  return (
    <View style={styles.flex}>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.field,
          pressed && !disabled ? styles.fieldPressed : null,
          disabled ? styles.fieldDisabled : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={displayLabel || placeholder}
      >
        <Ionicons name="calendar-outline" size={16} color={colors.mutedText} />
        <Text
          style={[styles.fieldText, !displayLabel && styles.fieldPlaceholder]}
          numberOfLines={1}
        >
          {displayLabel || placeholder}
        </Text>
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

          <View style={styles.headerRow}>
            <Pressable
              onPress={goPrev}
              disabled={prevDisabled}
              hitSlop={8}
              style={[styles.navButton, prevDisabled && styles.navButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              accessibilityState={{ disabled: prevDisabled }}
            >
              <Ionicons name="chevron-back" size={20} color={prevDisabled ? colors.subtleText : colors.text} />
            </Pressable>
            <Text style={styles.monthLabel}>
              {viewMonth.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <Pressable
              onPress={goNext}
              disabled={nextDisabled}
              hitSlop={8}
              style={[styles.navButton, nextDisabled && styles.navButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              accessibilityState={{ disabled: nextDisabled }}
            >
              <Ionicons name="chevron-forward" size={20} color={nextDisabled ? colors.subtleText : colors.text} />
            </Pressable>
          </View>

          <View style={styles.dowRow}>
            {DOW.map((d) => (
              <Text key={d} style={styles.dowText}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map(({ date, inMonth }) => {
              const iso = toIso(date);
              const isSelected = iso === selectedIso;
              const isToday = iso === todayIso;
              const outOfRange = (!!minDate && iso < minDate) || (!!maxDate && iso > maxDate);
              return (
                <Pressable
                  key={iso}
                  onPress={() => handlePick(date)}
                  disabled={outOfRange}
                  style={({ pressed }) => [
                    styles.cell,
                    pressed && !outOfRange && styles.cellPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: outOfRange }}
                  accessibilityLabel={formatDisplay(date)}
                >
                  <View
                    style={[
                      styles.cellInner,
                      isToday && !isSelected && !outOfRange && styles.cellToday,
                      isSelected && styles.cellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        !inMonth && styles.cellTextOut,
                        isToday && !isSelected && !outOfRange && styles.cellTextToday,
                        isSelected && styles.cellTextSelected,
                        outOfRange && styles.cellTextDisabled,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={handleClear}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="Clear date"
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={close}
              style={styles.doneButton}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
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
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
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
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 8,
    marginBottom: 4,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  monthLabel: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonDisabled: { opacity: 0.4 },

  dowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  dowText: {
    width: 40,
    textAlign: "center",
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellPressed: { opacity: 0.7 },
  cellInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  cellToday: {
    borderWidth: 1,
    borderColor: primaryTint.stroke25,
  },
  cellSelected: {
    backgroundColor: colors.wordmark,
  },
  cellText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  cellTextOut: { color: colors.subtleText, opacity: 0.4 },
  cellTextDisabled: { color: colors.subtleText, opacity: 0.28 },
  cellTextToday: { color: colors.wordmark, fontWeight: "800" },
  cellTextSelected: { color: colors.white, fontWeight: "800" },

  footer: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 14,
  },
  clearButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  doneButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.wordmark,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { color: colors.white, fontSize: 14, fontWeight: "700" },
});
