import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { colors } from "@/theme/colors";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

interface CalendarCell {
  date: Date;
  inMonth: boolean;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseYmd(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function buildCalendar(monthDate: Date): CalendarCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    cells.push({ date: new Date(year, month - 1, daysInPrev - i), inMonth: false });
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

function sameDate(a: Date | null, b: Date): boolean {
  return (
    !!a &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export interface EditTripFormValues {
  travel_date: string;
  luggage_capacity_kg: string;
  notes: string;
}

interface EditTripModalProps {
  open: boolean;
  initial: EditTripFormValues;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: EditTripFormValues) => void;
}

export function EditTripModal({
  open,
  initial,
  pending,
  onCancel,
  onSubmit,
}: Readonly<EditTripModalProps>) {
  const [form, setForm] = useState<EditTripFormValues>(initial);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const initialDate = parseYmd(initial.travel_date) ?? new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });

  // Re-seed when the modal re-opens with a different trip.
  useEffect(() => {
    if (open) {
      setForm(initial);
      const d = parseYmd(initial.travel_date) ?? new Date();
      setVisibleMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [open, initial]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }, [today]);

  const selectedDate = useMemo(() => parseYmd(form.travel_date), [form.travel_date]);

  const handleSelectDate = (d: Date) => {
    setForm((prev) => ({ ...prev, travel_date: formatYmd(d) }));
    setCalendarOpen(false);
  };

  const handleSubmit = () => onSubmit(form);

  const dateLabel = selectedDate ? formatDateLabel(selectedDate) : "Select date";
  const calendarCells = buildCalendar(visibleMonth);

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!pending) onCancel();
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (!pending) onCancel();
        }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit trip</Text>
            <Pressable
              onPress={onCancel}
              hitSlop={8}
              disabled={pending}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Travel date</Text>
            <Pressable
              onPress={() => setCalendarOpen(true)}
              style={styles.input}
              accessibilityRole="button"
              accessibilityLabel="Pick travel date"
              disabled={pending}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.wordmark} />
              <Text
                style={[
                  styles.inputText,
                  !selectedDate && styles.inputPlaceholder,
                ]}
              >
                {dateLabel}
              </Text>
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Luggage capacity (kg)</Text>
            <TextInput
              value={form.luggage_capacity_kg}
              onChangeText={(t) => setForm((prev) => ({ ...prev, luggage_capacity_kg: t }))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.subtleText}
              style={styles.textInput}
              editable={!pending}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Notes <Text style={styles.fieldLabelMuted}>(Optional)</Text>
            </Text>
            <TextInput
              value={form.notes}
              onChangeText={(t) => setForm((prev) => ({ ...prev, notes: t }))}
              placeholder="Any notes for carriers…"
              placeholderTextColor={colors.subtleText}
              style={[styles.textInput, styles.multiline]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!pending}
            />
          </View>

          <View style={styles.footer}>
            <AppButton
              label="Cancel"
              variant="secondary"
              onPress={onCancel}
              disabled={pending}
              style={styles.footerButton}
            />
            <AppButton
              label={pending ? "Saving…" : "Save changes"}
              onPress={handleSubmit}
              disabled={pending}
              gradientColors={[colors.ctaAccent, colors.ctaAccent]}
              leftIcon={
                pending ? <ActivityIndicator size="small" color={colors.white} /> : undefined
              }
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>

      {/* Calendar sub-modal */}
      <Modal
        visible={calendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setCalendarOpen(false)} />
        <View style={styles.calendarCenter} pointerEvents="box-none">
          <View style={styles.calendarSheet}>
            <View style={styles.calendarHeaderRow}>
              <Pressable
                onPress={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1),
                  )
                }
                style={styles.calendarNavButton}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>
              <Text style={styles.calendarTitle}>{formatMonthLabel(visibleMonth)}</Text>
              <Pressable
                onPress={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
                  )
                }
                style={styles.calendarNavButton}
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
              {calendarCells.map((cell, i) => {
                const isPast = cell.date < today;
                const isFuture = cell.date > maxDate;
                const disabled = isPast || isFuture;
                const isSelected = sameDate(selectedDate, cell.date);
                return (
                  <Pressable
                    key={i}
                    disabled={disabled}
                    onPress={() => handleSelectDate(cell.date)}
                    style={[
                      styles.cell,
                      isSelected && styles.cellSelected,
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,25,0.4)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 22,
    backgroundColor: colors.card,
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: "800" },

  field: { gap: 8 },
  fieldLabel: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  fieldLabelMuted: { color: colors.subtleText, fontWeight: "500" },

  input: {
    backgroundColor: colors.input,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputText: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "500", flex: 1 },
  inputPlaceholder: { color: colors.subtleText },
  textInput: {
    backgroundColor: colors.input,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
  },
  multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },

  footer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  footerButton: { flex: 1 },

  // Calendar
  calendarCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  calendarSheet: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 14,
    gap: 10,
  },
  calendarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  weekday: {
    flex: 1,
    textAlign: "center",
    color: colors.subtleText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellSelected: { borderRadius: 999 },
  cellText: { color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: "600" },
  cellTextMuted: { color: colors.subtleText, opacity: 0.45 },
  cellTextDisabled: { color: colors.subtleText, opacity: 0.35 },
  cellTextSelected: {
    color: colors.white,
    backgroundColor: colors.wordmark,
    width: 36,
    height: 36,
    lineHeight: 36,
    textAlign: "center",
    borderRadius: 18,
    overflow: "hidden",
    fontWeight: "800",
  },
});
