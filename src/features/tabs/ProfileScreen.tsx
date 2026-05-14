import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { initialsFromFullName } from "@/features/profile/profileUtils";
import { useMyProfile } from "@/hooks/api/useMyProfile";
import { useUnreadInboxCount } from "@/hooks/api/useUnreadInboxCount";
import { useUnreadNotificationsCount } from "@/hooks/api/useUnreadNotificationsCount";
import { t } from "@/i18n/translations";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { getErrorMessage } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";
import { shadowCard } from "@/theme/elevation";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * Subset of tab routes that take no params — required so `navigation.navigate(target)`
 * type-checks without a per-row variadic args dance.
 */
type ProfileMenuTarget =
  | "BookingsTab"
  | "OpportunitiesTab"
  | "DisputesTab"
  | "WalletTab"
  | "KycVerificationTab"
  | "ReviewsTab"
  | "MessagesTab"
  | "ChangePasswordTab"
  | "Notifications"
  | "PreferencesTab";

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  target: ProfileMenuTarget;
  /** Optional unread-count pill rendered to the right of the label. */
  badge?: number;
}

interface MenuSection {
  title: string;
  items: readonly MenuItem[];
}

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { signOut } = useAuth();
  const language = useAppStore((s) => s.language);
  const { profile, loading, error, refetch } = useMyProfile();
  // Live-updating unread counts (subscribed to the realtime bus). Drive the
  // badges next to the Messages + Notifications menu items.
  const { count: messagesUnread } = useUnreadInboxCount();
  const { count: notificationsUnread } = useUnreadNotificationsCount();

  const [signingOut, setSigningOut] = useState(false);

  // Web parity: menu structure mirrors `web app/safarly_web/src/customer/pages/CustomerProfile.tsx`.
  const sections = useMemo<readonly MenuSection[]>(
    () => [
      {
        title: "ACCOUNT",
        items: [
          { icon: "calendar-clear", label: "My Bookings", target: "BookingsTab" },
          { icon: "flash-outline", label: "Delivery Opportunities", target: "OpportunitiesTab" },
          { icon: "alert-circle", label: "My Disputes", target: "DisputesTab" },
          { icon: "wallet-outline", label: "Payment Methods", target: "WalletTab" },
          { icon: "shield-checkmark-outline", label: "KYC Verification", target: "KycVerificationTab" },
          { icon: "star", label: "Reviews", target: "ReviewsTab" },
          {
            icon: "chatbubble-ellipses",
            label: "Messages",
            target: "MessagesTab",
            badge: messagesUnread,
          },
        ],
      },
      {
        title: "SETTINGS",
        items: [
          { icon: "lock-closed-outline", label: "Security", target: "ChangePasswordTab" },
          {
            icon: "notifications-outline",
            label: "Notifications",
            target: "Notifications",
            badge: notificationsUnread,
          },
          { icon: "options-outline", label: "Preferences", target: "PreferencesTab" },
        ],
      },
    ],
    [messagesUnread, notificationsUnread],
  );

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      // RootNavigator transitions back to Login automatically via auth state.
    } catch (err) {
      showToast({ title: "Sign out failed", message: getErrorMessage(err), variant: "error" });
      setSigningOut(false);
    }
  }, [signOut, signingOut]);

  // ───────── Loading state ─────────
  if (loading && !profile) {
    return (
      <Screen contentContainerStyle={styles.contentContainer} refreshEnabled={false}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centeredText}>Loading profile…</Text>
        </View>
      </Screen>
    );
  }

  // ───────── Error state (only when we have nothing to show) ─────────
  if (error && !profile) {
    return (
      <Screen contentContainerStyle={styles.contentContainer} refreshEnabled onRefresh={refetch}>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedText} />
          <Text style={styles.errorTitle}>Couldn't load your profile</Text>
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

  const name = profile?.name ?? "";
  const bio = profile?.bio ?? "";
  const avatarUrl = profile?.avatar_url ?? null;
  const rating = profile?.rating ?? 0;
  const totalTrips = profile?.total_trips ?? 0;
  const totalDeliveries = profile?.total_deliveries ?? 0;
  const kycVerified = profile?.kyc_status === "verified";
  const initials = name ? initialsFromFullName(name) : "??";

  return (
    <Screen contentContainerStyle={styles.contentContainer} refreshEnabled onRefresh={refetch}>
      {/* ───────── Profile card ───────── */}
      <Card style={styles.profileCard}>
        <View style={styles.profileRow}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarLabel}>{initials}</Text>
              </View>
            )}
            <Pressable
              style={styles.cameraBadge}
              onPress={() =>
                showToast({
                  title: "Photo upload coming soon",
                  variant: "info",
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Change photo"
            >
              <Ionicons name="camera-outline" size={14} color={colors.white} />
            </Pressable>
          </View>

          <View style={styles.profileTextWrap}>
            <Text style={styles.profileName} numberOfLines={1}>
              {name || "Your name"}
            </Text>
            {bio ? (
              <Text style={styles.profileBio} numberOfLines={2}>
                {bio}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color={colors.warning} />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              </View>
              <Text style={styles.metaSep}>•</Text>
              <Text style={styles.metaText}>{totalTrips} trips</Text>
              <Text style={styles.metaSep}>•</Text>
              <Text style={styles.metaText}>{totalDeliveries} deliveries</Text>
            </View>
            {kycVerified ? (
              <View style={styles.kycRow}>
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.safe} />
                <Text style={styles.kycText}>{t(language, "profile.kycVerified")}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Pressable
          style={styles.editButton}
          onPress={() => navigation.navigate("EditProfileTab")}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <Text style={styles.editButtonText}>{t(language, "profile.editProfile")}</Text>
        </Pressable>
      </Card>

      {/* ───────── Stats ───────── */}
      <View style={styles.statsRow}>
        <StatCard
          icon="airplane-outline"
          iconColor={colors.primary}
          value={String(totalTrips)}
          label="TRIPS"
          tilt
        />
        <StatCard
          icon="cube-outline"
          iconColor={colors.safe}
          value={String(totalDeliveries)}
          label="DELIVERIES"
        />
        <StatCard
          icon="star"
          iconColor={colors.warning}
          value={rating.toFixed(1)}
          label="RATING"
        />
      </View>

      {/* ───────── Menu sections ───────── */}
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Card style={styles.menuCard}>
            {section.items.map((item, i) => (
              <MenuRow
                key={item.label}
                icon={item.icon}
                label={item.label}
                badge={item.badge}
                onPress={() => navigation.navigate(item.target)}
                isLast={i === section.items.length - 1}
              />
            ))}
          </Card>
        </View>
      ))}

      {/* ───────── Sign out ───────── */}
      <Pressable
        style={[styles.signOutButton, signingOut && styles.signOutButtonDisabled]}
        onPress={handleSignOut}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        {signingOut ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.signOutLabel}>{t(language, "profile.signOut")}</Text>
        )}
      </Pressable>
    </Screen>
  );
}

// ───────────────────────────── Sub-components ─────────────────────────────

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string;
  label: string;
  tilt?: boolean;
}

function StatCard({ icon, iconColor, value, label, tilt }: Readonly<StatCardProps>) {
  return (
    <View style={[styles.statCard, shadowCard()]}>
      <Ionicons
        name={icon}
        size={18}
        color={iconColor}
        style={tilt ? styles.iconTilt : undefined}
      />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface MenuRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Unread-count pill — capped at "9+", suppressed when 0/undefined. */
  badge?: number;
  onPress: () => void;
  isLast?: boolean;
}

function MenuRow({ icon, label, badge, onPress, isLast }: Readonly<MenuRowProps>) {
  const showBadge = typeof badge === "number" && badge > 0;
  return (
    <Pressable
      style={[styles.menuRow, isLast && styles.menuRowLast]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={showBadge ? `${label}, ${badge} unread` : label}
    >
      <View style={styles.menuLeft}>
        <Ionicons name={icon} size={18} color={colors.mutedText} />
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <View style={styles.menuRight}>
        {showBadge ? (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={17} color={colors.mutedText} />
      </View>
    </Pressable>
  );
}

// ───────────────────────────── Styles ─────────────────────────────

const styles = StyleSheet.create({
  contentContainer: { paddingTop: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 120, gap: 12 },
  centeredText: { color: colors.mutedText, fontSize: 14, fontWeight: "500" },

  // Error
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

  // Profile card
  profileCard: { marginBottom: 16, gap: 14 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 76, height: 76, borderRadius: 38 },
  avatarLabel: { color: colors.primary, fontSize: 26, fontWeight: "800" },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.card,
  },
  profileTextWrap: { flex: 1, gap: 4 },
  profileName: { color: colors.text, fontSize: 18, fontWeight: "800" },
  profileBio: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  metaSep: { color: colors.mutedText, fontSize: 12 },
  metaText: { color: colors.mutedText, fontSize: 12, fontWeight: "500" },
  kycRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  kycText: { color: colors.safe, fontSize: 12, fontWeight: "700" },
  editButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: { color: colors.text, fontSize: 14, fontWeight: "800" },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 4,
  },
  iconTilt: { transform: [{ rotate: "-42deg" }] },
  statValue: { color: colors.text, fontSize: 18, lineHeight: 22, fontWeight: "800" },
  statLabel: { color: colors.mutedText, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },

  // Menu
  section: { marginBottom: 18 },
  sectionTitle: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuCard: { paddingVertical: 0, paddingHorizontal: 0 },
  menuRow: {
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuRowLast: { borderBottomWidth: 0 },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuLabel: { color: colors.text, fontSize: 15, fontWeight: "600" },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  menuBadgeText: { color: colors.white, fontSize: 10, fontWeight: "800" },

  // Sign out
  signOutButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#FFF1EC",
    borderWidth: 1,
    borderColor: "#F8D7CD",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutButtonDisabled: { opacity: 0.6 },
  signOutLabel: { color: colors.primary, fontSize: 15, fontWeight: "800" },
});
