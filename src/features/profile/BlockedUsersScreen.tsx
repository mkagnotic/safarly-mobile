import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { AppButton } from "@/components/ui/AppButton";
import { Avatar } from "@/components/ui/Avatar";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/feedback/appFeedback";
import { useBlockedUsers } from "@/hooks/api/useBlockedUsers";
import { usePublicProfile } from "@/hooks/api/usePublicProfile";
import { getErrorMessage } from "@/services/api";
import { MainTabParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList>;

/**
 * Security → Blocked users: the people I blocked, each with Unblock (web's
 * BlockedUsersSection). 27 Oct 2026: mobile had no list, and a blocked person is
 * hidden everywhere and their chat closes, so there was no way back to unblock.
 * People who blocked ME are never listed.
 */
export function BlockedUsersScreen() {
  const navigation = useNavigation<Nav>();
  const { blockedByMeIds, isLoaded, loadFailed, refetch } = useBlockedUsers();
  const [retrying, setRetrying] = useState(false);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      await refetch();
    } finally {
      setRetrying(false);
    }
  }, [refetch]);

  return (
    <Screen contentContainerStyle={styles.content} refreshEnabled onRefresh={refetch}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backButton}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("SecurityTab"))}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle} accessibilityRole="header">Blocked users</Text>
      </View>
      <Text style={styles.intro}>
        People you block can't message you or see your listings, and you won't see theirs.
      </Text>

      <View style={styles.card}>
        {!isLoaded && !loadFailed ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} accessibilityLabel="Loading blocked users" />
          </View>
        ) : !isLoaded && loadFailed ? (
          <View style={styles.center}>
            <Text style={styles.centerText}>Couldn't load your blocked users.</Text>
            <AppButton label="Try again" onPress={() => void retry()} loading={retrying} disabled={retrying} variant="secondary" />
          </View>
        ) : blockedByMeIds.length === 0 ? (
          <View style={styles.emptyRow}>
            <Ionicons name="ban-outline" size={18} color={colors.mutedText} />
            <Text style={styles.emptyText}>You haven't blocked anyone. Block someone from their profile.</Text>
          </View>
        ) : (
          blockedByMeIds.map((id, i) => (
            <BlockedUserRow key={id} userId={id} isLast={i === blockedByMeIds.length - 1} />
          ))
        )}
      </View>
    </Screen>
  );
}

function BlockedUserRow({ userId, isLast }: Readonly<{ userId: string; isLast: boolean }>) {
  const navigation = useNavigation<Nav>();
  const { profile } = usePublicProfile(userId);
  const { unblock } = useBlockedUsers();
  const [pending, setPending] = useState(false);
  const name = profile?.name?.trim() || "Safarly user";

  const handleUnblock = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      await unblock(userId);
      showToast({ title: `${name} unblocked`, variant: "success" });
    } catch (err) {
      showToast({ title: "Couldn't unblock", message: getErrorMessage(err), variant: "error" });
      setPending(false);
    }
  }, [pending, unblock, userId, name]);

  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <Pressable
        style={styles.person}
        onPress={() => navigation.navigate("PublicProfileTab", { userId, name })}
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}'s profile`}
      >
        <Avatar name={name} uri={profile?.avatar_url ?? undefined} size={40} />
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
      </Pressable>
      <AppButton
        label="Unblock"
        onPress={() => void handleUnblock()}
        loading={pending}
        disabled={pending}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 24 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 14, minHeight: 34 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },
  intro: { color: colors.mutedText, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: "hidden" },
  center: { paddingVertical: 24, paddingHorizontal: 16, alignItems: "center", gap: 12 },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  emptyText: { flex: 1, color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  centerText: { color: colors.mutedText, fontSize: 14, lineHeight: 20, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  name: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
});
