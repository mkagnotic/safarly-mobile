import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useShallow } from "zustand/react/shallow";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/feedback/appFeedback";
import { LANGUAGE_OPTIONS } from "@/features/profile/preferencesConfig";
import { useMyPreferences } from "@/hooks/api/useMyPreferences";
import { type AppLanguage } from "@/i18n/translations";
import { MainTabParamList } from "@/navigation/types";
import { getErrorMessage, type UserPreferences } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "PreferencesTab">;

interface CurrencyOption {
  value: string;
  label: string;
}

/** Mirrors web's `<select>` options on CustomerPreferences. */
const CURRENCIES: readonly CurrencyOption[] = [
  { value: "USD", label: "USD ($)" },
  { value: "INR", label: "INR (₹)" },
] as const;

interface ToggleConfig {
  field: "email_notifications" | "push_notifications" | "notifications_enabled";
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
}

/**
 * Three notification toggles, mirroring web's CustomerPreferences exactly.
 * The third row maps the `notifications_enabled` API field to the user-facing
 * "SMS Alerts" label — a legacy naming choice we preserve for cross-platform
 * consistency.
 */
const TOGGLES: readonly ToggleConfig[] = [
  {
    field: "email_notifications",
    icon: "mail-outline",
    label: "Email Notifications",
    desc: "Receive updates via email",
  },
  {
    field: "push_notifications",
    icon: "notifications-outline",
    label: "Push Notifications",
    desc: "Mobile push notifications",
  },
  {
    field: "notifications_enabled",
    icon: "phone-portrait",
    label: "SMS Alerts",
    desc: "Critical alerts via SMS",
  },
] as const;

export function PreferencesScreen() {
  const navigation = useNavigation<Nav>();
  const { preferences, loading, error, refetch, update } = useMyPreferences();

  const { storeLanguage, setStoreLanguage } = useAppStore(
    useShallow((s) => ({
      storeLanguage: s.language,
      setStoreLanguage: s.setLanguage,
    })),
  );

  const [savingField, setSavingField] = useState<keyof UserPreferences | null>(null);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Profile");
  }, [navigation]);

  const handleUpdate = useCallback(
    async (patch: Partial<UserPreferences>) => {
      const fieldName = Object.keys(patch)[0] as keyof UserPreferences;
      setSavingField(fieldName);
      try {
        await update(patch);
      } catch (err) {
        showToast({
          title: "Couldn't save preference",
          message: getErrorMessage(err),
          variant: "error",
        });
      } finally {
        setSavingField(null);
      }
    },
    [update],
  );

  const handleLanguageChange = useCallback(
    async (next: AppLanguage) => {
      // Local update is instant — translations.t() reads from the store, so the
      // UI flips before the server round-trip.
      setStoreLanguage(next);
      await handleUpdate({ language: next });
    },
    [setStoreLanguage, handleUpdate],
  );

  // ───────── Loading state ─────────
  if (loading && !preferences) {
    return (
      <Screen contentContainerStyle={styles.contentContainer} refreshEnabled={false}>
        <PreferencesHeader onBack={goBack} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centeredText}>Loading preferences…</Text>
        </View>
      </Screen>
    );
  }

  // ───────── Error state (only when there's nothing to render) ─────────
  if (error && !preferences) {
    return (
      <Screen contentContainerStyle={styles.contentContainer} refreshEnabled={false}>
        <PreferencesHeader onBack={goBack} />
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedText} />
          <Text style={styles.errorTitle}>Couldn't load preferences</Text>
          <Text style={styles.errorBody}>{getErrorMessage(error)}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.contentContainer} refreshEnabled onRefresh={refetch}>
      <PreferencesHeader onBack={goBack} />

      {/* ───────── Notification toggles (web parity) ───────── */}
      <SectionLabel>NOTIFICATIONS</SectionLabel>
      <Card style={styles.toggleCard}>
        {TOGGLES.map((toggle, index) => (
          <ToggleRow
            key={toggle.field}
            icon={toggle.icon}
            label={toggle.label}
            desc={toggle.desc}
            value={Boolean(preferences?.[toggle.field])}
            disabled={savingField === toggle.field}
            isLast={index === TOGGLES.length - 1}
            onChange={(next) => void handleUpdate({ [toggle.field]: next } as Partial<UserPreferences>)}
          />
        ))}
      </Card>

      {/* ───────── Currency (web parity) ───────── */}
      <SectionLabel topGap>CURRENCY</SectionLabel>
      <Card style={styles.currencyCard}>
        <View style={styles.currencyHeader}>
          <View style={styles.currencyLeft}>
            <Ionicons name="cash-outline" size={18} color={colors.mutedText} />
            <Text style={styles.currencyLabel}>Display Currency</Text>
          </View>
          {savingField === "currency" ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : null}
        </View>
        <View style={styles.currencyRow}>
          {CURRENCIES.map((currency) => {
            const active = preferences?.currency === currency.value;
            return (
              <Pressable
                key={currency.value}
                onPress={() => {
                  if (active) return;
                  void handleUpdate({ currency: currency.value });
                }}
                style={[styles.currencyButton, active && styles.currencyButtonActive]}
                accessibilityRole="button"
                accessibilityLabel={`Use ${currency.value}`}
                accessibilityState={{ selected: active }}
                disabled={savingField === "currency"}
              >
                <Text style={[styles.currencyButtonText, active && styles.currencyButtonTextActive]}>
                  {currency.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* ───────── Language (mobile retains; also syncs to API) ───────── */}
      <SectionLabel topGap>LANGUAGE</SectionLabel>
      <LanguagePicker
        value={storeLanguage}
        onChange={(next) => void handleLanguageChange(next)}
        saving={savingField === "language"}
      />
    </Screen>
  );
}

// ───────────────────────── Sub-components ─────────────────────────

function PreferencesHeader({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <View style={styles.headerRow}>
      <Pressable
        style={styles.backButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.screenTitle}>Preferences</Text>
    </View>
  );
}

function SectionLabel({ children, topGap }: Readonly<{ children: string; topGap?: boolean }>) {
  return <Text style={[styles.sectionLabel, topGap && styles.sectionLabelTopGap]}>{children}</Text>;
}

interface ToggleRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  value: boolean;
  disabled?: boolean;
  isLast?: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ icon, label, desc, value, disabled, isLast, onChange }: Readonly<ToggleRowProps>) {
  return (
    <View style={[styles.toggleRow, isLast && styles.toggleRowLast]}>
      <View style={styles.toggleLeft}>
        <Ionicons name={icon} size={18} color={colors.mutedText} />
        <View style={styles.toggleTextBlock}>
          <Text style={styles.toggleLabel}>{label}</Text>
          <Text style={styles.toggleDesc}>{desc}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: "#E5DCF8", true: colors.primary }}
        thumbColor={value ? "#FFFFFF" : "#F4F2FB"}
        ios_backgroundColor="#E5DCF8"
      />
    </View>
  );
}

interface LanguagePickerProps {
  value: AppLanguage;
  onChange: (next: AppLanguage) => void;
  saving: boolean;
}

function LanguagePicker({ value, onChange, saving }: Readonly<LanguagePickerProps>) {
  const [open, setOpen] = useState(false);
  const selectedLabel = useMemo(
    () => LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ?? "English (US)",
    [value],
  );

  return (
    <View style={styles.languageWrap}>
      <Pressable
        style={styles.languagePicker}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Choose language"
      >
        <Text style={styles.languageValue}>{selectedLabel}</Text>
        {saving ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.text} />
        )}
      </Pressable>
      {open ? (
        <View style={styles.languageDropdown}>
          {LANGUAGE_OPTIONS.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                style={[styles.languageOption, active && styles.languageOptionActive]}
                onPress={() => {
                  setOpen(false);
                  if (!active) onChange(option.value);
                }}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    active && styles.languageOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  contentContainer: { paddingTop: 16, paddingBottom: 32 },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    marginBottom: 18,
    minHeight: 34,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },

  // Loading / error
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  centeredText: { color: colors.mutedText, fontSize: 14, fontWeight: "500" },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  errorBody: { color: colors.mutedText, fontSize: 13, textAlign: "center", maxWidth: 280 },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  retryButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },

  // Section labels
  sectionLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionLabelTopGap: { marginTop: 18 },

  // Toggle card
  toggleCard: { paddingVertical: 0, paddingHorizontal: 0 },
  toggleRow: {
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  toggleRowLast: { borderBottomWidth: 0 },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  toggleTextBlock: { flex: 1 },
  toggleLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  toggleDesc: { color: colors.mutedText, fontSize: 12, marginTop: 2 },

  // Currency card
  currencyCard: { paddingVertical: 14, paddingHorizontal: 14, gap: 12 },
  currencyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  currencyLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  currencyLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  currencyRow: { flexDirection: "row", gap: 8 },
  currencyButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  currencyButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  currencyButtonText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  currencyButtonTextActive: { color: colors.white },

  // Language picker
  languageWrap: { position: "relative" },
  languagePicker: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  languageValue: { color: colors.text, fontSize: 15, fontWeight: "600" },
  languageDropdown: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: "hidden",
    zIndex: 30,
  },
  languageOption: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  languageOptionActive: { backgroundColor: "rgba(255, 122, 38, 0.08)" },
  languageOptionText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  languageOptionTextActive: { color: colors.primary, fontWeight: "800" },
});
