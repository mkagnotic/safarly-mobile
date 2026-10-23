import { type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";
import { COMPACT_CONTROL_MAX_FONT_SCALE } from "@/theme/typography";

interface SectionCardProps {
  /** First group of the form: rounds the card's top corners. */
  first?: boolean;
  /** Last group of the form: rounds the card's bottom corners. */
  last?: boolean;
  children: ReactNode;
}

/**
 * One group of fields in a long create form. Consecutive groups render as a
 * single continuous card, like the web forms (one `bg-card rounded-2xl` panel,
 * no section headings). The groups stay separate components only so screens
 * can still measure each one for scroll-to-error.
 */
export function SectionCard({ first = false, last = false, children }: Readonly<SectionCardProps>) {
  return (
    <View
      style={[
        styles.sectionCard,
        first ? styles.sectionCardFirst : styles.sectionCardJoined,
        last && styles.sectionCardLast,
      ]}
    >
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function LocationCard({
  flag,
  label,
  filled,
  onToggle,
}: Readonly<{
  flag: string;
  label: string;
  filled: boolean;
  /** When provided the card becomes a tappable country switch (IN ⇄ US). */
  onToggle?: () => void;
}>) {
  const content = (
    <>
      <Text style={styles.locationFlag}>{flag}</Text>
      {/* "United States" read "Unite..." beside Switch at 320pt + larger text
          (23 Oct 2026): the name shrinks a little before it is ever cut. */}
      <Text style={styles.locationLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {label}
      </Text>
      {onToggle ? (
        <View style={styles.locationToggleHint}>
          <Ionicons name="swap-horizontal" size={16} color={colors.wordmark} />
          <Text style={styles.locationToggleHintText} maxFontSizeMultiplier={COMPACT_CONTROL_MAX_FONT_SCALE}>Switch</Text>
        </View>
      ) : filled ? (
        <Ionicons name="checkmark-circle" size={20} color={colors.safe} />
      ) : null}
    </>
  );

  if (onToggle) {
    return (
      <Pressable
        style={styles.locationCard}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`Country: ${label}. Tap to switch.`}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.locationCard}>{content}</View>;
}

export function DateModeToggle<T extends string>({
  options,
  value,
  onChange,
}: Readonly<{
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}>) {
  return (
    <View style={styles.dateModeToggle}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.dateModeButton, active && styles.dateModeButtonActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.dateModeText, active && styles.dateModeTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DateField({
  label,
  value,
  placeholder,
  onPress,
  disabled,
  error,
}: Readonly<{
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  error?: string;
}>) {
  return (
    <View>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[
          styles.dateCard,
          disabled && styles.dateCardDisabled,
          error && styles.dateCardError,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.wordmark} />
        <View style={styles.dateCardTextWrap}>
          <Text style={styles.dateCardLabel}>{label}</Text>
          <Text
            style={[styles.dateCardValue, !value && styles.dateCardValueEmpty]}
            numberOfLines={2}
          >
            {value ?? placeholder}
          </Text>
        </View>
      </Pressable>
      {error ? <Text style={styles.inlineError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: colors.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // Overlap by a pixel so sub-pixel layout can't leave a hairline seam.
  sectionCardJoined: { marginTop: -1 },
  sectionCardFirst: { borderTopWidth: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 18 },
  sectionCardLast: { borderBottomWidth: 1, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, paddingBottom: 18, marginBottom: 14 },
  sectionBody: { gap: 12 },

  locationCard: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.surfaceTintPrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  locationFlag: { fontSize: 20, lineHeight: 24 },
  locationLabel: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "700", flex: 1 },
  locationToggleHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.card,
  },
  locationToggleHintText: {
    color: colors.wordmark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  dateModeToggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  dateModeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dateModeButtonActive: { backgroundColor: colors.wordmark },
  dateModeText: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  dateModeTextActive: { color: colors.white },

  dateCard: {
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: colors.surfaceTintPrimary,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateCardDisabled: { opacity: 0.45 },
  dateCardError: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: "rgba(220, 40, 40, 0.06)",
  },
  dateCardTextWrap: { flex: 1, minWidth: 0, gap: 2 },
  dateCardLabel: { color: colors.mutedText, fontSize: 11, lineHeight: 14, fontWeight: "700", letterSpacing: 0.4 },
  dateCardValue: { color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: "800" },
  dateCardValueEmpty: { color: colors.subtleText, fontWeight: "600" },

  inlineError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 6,
  },
});
