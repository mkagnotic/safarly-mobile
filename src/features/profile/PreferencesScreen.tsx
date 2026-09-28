import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { ActivityIndicator, StyleSheet, Switch, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { ListSkeleton } from "@/components/ui/Skeletons";
import { showToast } from "@/feedback/appFeedback";
import { useMyPreferences } from "@/hooks/api/useMyPreferences";
import { MainTabParamList } from "@/navigation/types";
import { getErrorMessage, type UserPreferences } from "@/services/api";
import {
  getPushAvailability,
  getPushPermission,
  requestAndRegisterPushToken,
  unregisterPushToken,
} from "@/services/notifications/push";
import { colors } from "@/theme/colors";
import { openAppSettings } from "@/utils/permissionBanner";

type Nav = BottomTabNavigationProp<MainTabParamList, "PreferencesTab">;

interface ToggleConfig {
  field: "email_notifications" | "push_enabled";
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
}

/**
 * Notification preferences — exact parity with web's `CustomerPreferences`
 * (the customer "Preferences" screen is notification toggles only; language /
 * timezone / currency are not customer-facing on web). SMS was removed (dead
 * feature). Push toggles the server-authoritative `push_enabled`, but turning
 * it ON must also secure the OS permission + register a device token (web gates
 * its toggle on the browser Notification permission the same way).
 */
const TOGGLES: readonly ToggleConfig[] = [
  {
    field: "email_notifications",
    icon: "mail-outline",
    label: "Email Notifications",
    desc: "Matches, offers, reminders and reviews via email",
  },
  {
    field: "push_enabled",
    icon: "notifications-outline",
    label: "Push Notifications",
    desc: "Mobile push notifications",
  },
] as const;

type PushNotice = { kind: "blocked"; canAskAgain: boolean } | { kind: "failed" };

/** Replaces the push toggle's description when push cannot work here at all. */
const PUSH_UNAVAILABLE_COPY: Record<"unsupported" | "not-configured", string> = {
  unsupported: "Push notifications aren't available on this device.",
  "not-configured": "Push notifications aren't available in this version of the app yet.",
};

export function PreferencesScreen() {
  const navigation = useNavigation<Nav>();
  const { preferences, loading, error, refetch, update } = useMyPreferences();

  const [savingField, setSavingField] = useState<keyof UserPreferences | null>(null);

  // Push depends on more than the saved preference: the build must support it
  // and the OS must allow it. Both are checked before the toggle is shown, and
  // the OS permission again whenever the screen regains focus — e.g. on return
  // from the Settings app.
  const pushAvailability = useMemo(() => getPushAvailability(), []);
  const [pushPermission, setPushPermission] = useState<{ granted: boolean; canAskAgain: boolean } | null>(null);
  const [pushNotice, setPushNotice] = useState<PushNotice | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (pushAvailability !== "available") return;
      let active = true;
      void getPushPermission().then((p) => {
        if (active) setPushPermission(p);
      });
      return () => {
        active = false;
      };
    }, [pushAvailability]),
  );

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

  // Turning push ON must secure the OS permission and register a device token
  // before the server flag is set (web parity — web gates its toggle on the
  // browser Notification permission). When that fails the switch stays off AND
  // says why, inline, until dismissed: it never quietly flips back. Turning push
  // OFF clears the server flag, which stops delivery, and deregisters this
  // device's token.
  const handlePushToggle = useCallback(
    async (next: boolean) => {
      setPushNotice(null);
      if (next) {
        setSavingField("push_enabled");
        const result = await requestAndRegisterPushToken();
        const permission = await getPushPermission();
        setPushPermission(permission);
        setSavingField(null);
        if (!result.ok) {
          setPushNotice(
            result.reason === "denied"
              ? { kind: "blocked", canAskAgain: permission.canAskAgain }
              : { kind: "failed" },
          );
          return;
        }
      }
      await handleUpdate({ push_enabled: next });
      if (!next) void unregisterPushToken();
    },
    [handleUpdate],
  );

  // What the push switch shows. Saved-on but blocked by the OS is shown OFF —
  // pushes cannot arrive, and claiming otherwise is the confusion this avoids.
  const pushBlockedByOs =
    pushAvailability === "available" &&
    Boolean(preferences?.push_enabled) &&
    pushPermission !== null &&
    !pushPermission.granted;
  const pushValue =
    pushAvailability === "available" &&
    Boolean(preferences?.push_enabled) &&
    (pushPermission?.granted ?? true);
  const shownPushNotice: PushNotice | null =
    pushNotice ?? (pushBlockedByOs ? { kind: "blocked", canAskAgain: pushPermission.canAskAgain } : null);

  // ───────── Loading state ─────────
  if (loading && !preferences) {
    return (
      <Screen contentContainerStyle={styles.contentContainer} refreshEnabled={false}>
        <PreferencesHeader onBack={goBack} />
        <ListSkeleton rows={2} />
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
      <Text style={styles.subtitle}>Manage how you receive notifications.</Text>

      <View style={styles.list}>
        {TOGGLES.map((toggle) => {
          const isPush = toggle.field === "push_enabled";
          const pushUnavailable = isPush && pushAvailability !== "available";
          return (
            <ToggleCard
              key={toggle.field}
              icon={toggle.icon}
              label={toggle.label}
              desc={pushUnavailable ? PUSH_UNAVAILABLE_COPY[pushAvailability] : toggle.desc}
              value={isPush ? pushValue : Boolean(preferences?.[toggle.field])}
              disabled={pushUnavailable}
              saving={savingField === toggle.field}
              onChange={(nextValue) =>
                isPush
                  ? void handlePushToggle(nextValue)
                  : void handleUpdate({ [toggle.field]: nextValue } as Partial<UserPreferences>)
              }
            />
          );
        })}
      </View>

      {shownPushNotice ? (
        <View style={styles.pushNotice}>
          {shownPushNotice.kind === "blocked" ? (
            <FormBanner
              variant="warning"
              title="Notifications are turned off"
              message={
                shownPushNotice.canAskAgain
                  ? "Allow notifications for Safarly to turn on push."
                  : "Notifications are turned off for Safarly. Turn them on in Settings to receive push notifications."
              }
              actionLabel={shownPushNotice.canAskAgain ? undefined : "Open Settings"}
              onAction={shownPushNotice.canAskAgain ? undefined : openAppSettings}
              onDismiss={pushNotice ? () => setPushNotice(null) : undefined}
            />
          ) : (
            <FormBanner
              variant="error"
              title="Couldn't turn on push notifications"
              message="Something went wrong setting up push on this device. Please try again."
              onDismiss={() => setPushNotice(null)}
            />
          )}
        </View>
      ) : null}

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={16} color={colors.mutedText} />
        <Text style={styles.noteText}>
          Some essential emails — security alerts and payment receipts — are always sent.
        </Text>
      </View>
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

interface ToggleCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  value: boolean;
  disabled?: boolean;
  saving?: boolean;
  onChange: (next: boolean) => void;
}

function ToggleCard({ icon, label, desc, value, disabled, saving, onChange }: Readonly<ToggleCardProps>) {
  return (
    <Card style={styles.toggleCard}>
      <View style={styles.toggleLeft}>
        <View style={styles.toggleIcon}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={styles.toggleTextBlock}>
          <Text style={styles.toggleLabel}>{label}</Text>
          <Text style={styles.toggleDesc}>{desc}</Text>
        </View>
      </View>
      {saving ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={label}
          accessibilityState={{ disabled: !!disabled, checked: value }}
          trackColor={{ false: "#E5DCF8", true: colors.primary }}
          thumbColor={value ? "#FFFFFF" : "#F4F2FB"}
          ios_backgroundColor="#E5DCF8"
        />
      )}
    </Card>
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
    marginBottom: 8,
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
  subtitle: { color: colors.mutedText, fontSize: 14, lineHeight: 20, marginBottom: 18 },

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

  // Toggle cards (one card per toggle — web parity)
  list: { gap: 12 },
  toggleCard: {
    minHeight: 68,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  toggleIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleTextBlock: { flex: 1 },
  toggleLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  toggleDesc: { color: colors.mutedText, fontSize: 12, lineHeight: 17, marginTop: 2 },

  pushNotice: { marginTop: 12 },

  // Footer note
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 4,
  },
  noteText: { flex: 1, color: colors.mutedText, fontSize: 12, lineHeight: 18 },
});
