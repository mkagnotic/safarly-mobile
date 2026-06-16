import { type ReactNode, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

interface SectionCardProps {
  index: number;
  title: string;
  subtitle: string;
  complete: boolean;
  /** Defaults to collapsed so long forms read less overwhelming on first paint. */
  defaultExpanded?: boolean;
  /** Force-expands the card when an error lands in it, so the highlight is visible. */
  hasError?: boolean;
  children: ReactNode;
}

export function SectionCard({
  index,
  title,
  subtitle,
  complete,
  defaultExpanded = false,
  hasError = false,
  children,
}: Readonly<SectionCardProps>) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (hasError) setExpanded(true);
  }, [hasError]);
  return (
    <View style={styles.sectionCard}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={styles.sectionHeader}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${expanded ? "expanded" : "collapsed"}`}
        accessibilityState={{ expanded }}
      >
        <View style={[styles.sectionBadge, complete && styles.sectionBadgeComplete]}>
          {complete ? (
            <Ionicons name="checkmark" size={16} color={colors.white} />
          ) : (
            <Text style={styles.sectionBadgeText}>{index}</Text>
          )}
        </View>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.mutedText}
        />
      </Pressable>
      {expanded ? (
        <>
          <View style={styles.sectionDivider} />
          <View style={styles.sectionBody}>{children}</View>
        </>
      ) : null}
    </View>
  );
}

export function LocationCard({
  flag,
  label,
  filled,
}: Readonly<{ flag: string; label: string; filled: boolean }>) {
  return (
    <View style={styles.locationCard}>
      <Text style={styles.locationFlag}>{flag}</Text>
      <Text style={styles.locationLabel} numberOfLines={1}>
        {label}
      </Text>
      {filled ? (
        <Ionicons name="checkmark-circle" size={20} color={colors.safe} />
      ) : null}
    </View>
  );
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.wordmark,
    backgroundColor: colors.card,
  },
  sectionBadgeComplete: { backgroundColor: colors.wordmark, borderColor: colors.wordmark },
  sectionBadgeText: { color: colors.wordmark, fontSize: 14, lineHeight: 18, fontWeight: "800" },
  sectionTitleWrap: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: "800" },
  sectionSubtitle: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 14,
    marginBottom: 14,
  },
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
