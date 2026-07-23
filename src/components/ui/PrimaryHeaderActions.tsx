import { useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Animated, Image, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { useMyProfile } from "@/hooks/api/useMyProfile";
import { useUnreadNotificationsCount } from "@/hooks/api/useUnreadNotificationsCount";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import { shadowSoft } from "@/theme/elevation";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

function getInitials(name?: string | null): string | null {
  if (!name) return null;
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return initials || null;
}

function SkeletonCircle() {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [opacity]);
  return <Animated.View style={[styles.skeletonInner, { opacity }]} />;
}

/**
 * Notification bell + profile avatar shown on every primary tab.
 * Fallback ladder: skeleton → avatar_url → initials → person glyph.
 */
export function PrimaryHeaderActions() {
  const navigation = useNavigation<Nav>();
  const { profile, loading: profileLoading } = useMyProfile();
  const { count: notificationsUnread } = useUnreadNotificationsCount();

  // Skeleton only on first load — refetches keep the avatar stable.
  const showSkeleton = profileLoading && !profile;
  const initials = getInitials(profile?.name);

  return (
    <View style={styles.actions}>
      <Pressable
        style={styles.iconBadge}
        onPress={() => navigation.navigate("Notifications")}
        accessibilityRole="button"
        accessibilityLabel={
          notificationsUnread > 0
            ? `Notifications, ${notificationsUnread} unread`
            : "Notifications"
        }
      >
        <Ionicons name="notifications-outline" size={18} color={colors.text} />
        {notificationsUnread > 0 ? (
          <View style={styles.badgeCount}>
            <Text style={styles.badgeCountText}>
              {notificationsUnread > 9 ? "9+" : notificationsUnread}
            </Text>
          </View>
        ) : null}
      </Pressable>
      <Pressable
        style={styles.avatarBadge}
        onPress={() => navigation.navigate("Profile")}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        disabled={showSkeleton}
      >
        {showSkeleton ? (
          <SkeletonCircle />
        ) : profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
        ) : initials ? (
          <View style={[styles.avatarImage, styles.avatarFallback]}>
            <Text style={styles.avatarInitialsText}>{initials}</Text>
          </View>
        ) : (
          <View style={[styles.avatarImage, styles.avatarFallback]}>
            <Ionicons name="person" size={18} color={colors.wordmark} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 8 },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...shadowSoft(),
  },
  avatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadowSoft(),
  },
  avatarImage: { width: "100%", height: "100%", borderRadius: 21 },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTintPrimary,
  },
  avatarInitialsText: { color: colors.wordmark, fontSize: 13, fontWeight: "800" },
  skeletonInner: {
    width: "100%",
    height: "100%",
    borderRadius: 21,
    backgroundColor: colors.border,
  },
  // Numeric unread badge (web parity: count capped at "9+"), ringed with the
  // header background so it reads clearly over the bell.
  badgeCount: {
    position: "absolute",
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    right: 3,
    top: 2,
  },
  badgeCountText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
  },
});
