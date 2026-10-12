import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

import { chatStyles } from "../chatStyles";

interface ChatHeaderProps {
  goBack: () => void;
  handleOpenProfile: () => void;
  setActionMenuOpen: (open: boolean) => void;
  participantId: string | null;
  participantName: string;
  participantInitials: string;
  participantAvatarUrl: string | null;
  matchStatus: string;
  isBlocked: boolean;
  matchedByOther: boolean;
  matchedByMe: boolean;
  isDeclined: boolean;
  typing: boolean;
  online: boolean;
}

/** ───────── Header ───────── */
export function ChatHeader({
  goBack,
  handleOpenProfile,
  setActionMenuOpen,
  participantId,
  participantName,
  participantInitials,
  participantAvatarUrl,
  matchStatus,
  isBlocked,
  matchedByOther,
  matchedByMe,
  isDeclined,
  typing,
  online,
}: Readonly<ChatHeaderProps>) {
  // Title-row pill: persistent match-state badge (Matched / Match request /
  // Waiting / Declined / Blocked). Lives next to the name so the subtitle
  // line is free for transient state (typing / online).
  const titleStatus: { label: string; bg: string; fg: string } | null = (() => {
    if (matchStatus === "matched")
      return { label: "Matched", bg: "rgba(34, 195, 93, 0.14)", fg: colors.safe };
    if (isBlocked)
      return { label: "Blocked", bg: "rgba(220, 40, 40, 0.14)", fg: colors.danger };
    if (matchedByOther)
      return { label: "Match request", bg: "rgba(245, 159, 10, 0.16)", fg: colors.warning };
    if (matchedByMe)
      return { label: "Waiting", bg: colors.surfaceMuted, fg: colors.mutedText };
    if (isDeclined)
      return { label: "Declined", bg: "rgba(220, 40, 40, 0.14)", fg: colors.danger };
    return null;
  })();

  // Subtitle: live state only — typing > online > nothing.
  const renderSubtitle = () => {
    if (typing) {
      return (
        <Text style={[styles.headerSubtitle, { color: colors.primary }]}>
          {participantName.split(" ")[0]} is typing…
        </Text>
      );
    }
    if (online) {
      return <Text style={[styles.headerSubtitle, { color: colors.safe }]}>● Online</Text>;
    }
    return null;
  };

  return (
    <View style={styles.headerRow}>
      <Pressable
        onPress={goBack}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <Pressable
        onPress={handleOpenProfile}
        disabled={!participantId}
        style={styles.headerIdentity}
        accessibilityRole="button"
        accessibilityLabel={`View ${participantName}'s profile`}
      >
        {participantAvatarUrl ? (
          <Image source={{ uri: participantAvatarUrl }} style={styles.headerAvatarImage} />
        ) : (
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{participantInitials}</Text>
          </View>
        )}
        <View style={styles.headerTextWrap}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {participantName}
            </Text>
            {titleStatus ? (
              <View style={[styles.headerStatusPill, { backgroundColor: titleStatus.bg }]}>
                <Text style={[styles.headerStatusText, { color: titleStatus.fg }]}>
                  {titleStatus.label}
                </Text>
              </View>
            ) : null}
          </View>
          {renderSubtitle()}
        </View>
      </Pressable>
      <Pressable
        onPress={() => setActionMenuOpen(true)}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="Chat actions"
      >
        <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  // Avatar + name/subtitle — one tap target that opens the profile, sitting
  // between the back button and the kebab.
  headerIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarImage: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  headerTextWrap: { flex: 1, minWidth: 0 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  headerStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  headerStatusText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  headerSubtitle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  subtitleRow: { flexDirection: "row", alignItems: "center" },
});

const styles = { ...chatStyles, ...headerStyles };
