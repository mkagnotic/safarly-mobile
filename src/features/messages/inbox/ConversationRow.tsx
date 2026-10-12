import { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { type Conversation } from "@/services/api";
import { colors } from "@/theme/colors";

import {
  flagsForConversation,
  formatRowTime,
  getInitials,
  miniStatusForFlags,
} from "./inboxHelpers";

// ───────────────────────── Conversation row ─────────────────────────

interface ConversationRowProps {
  conversation: Conversation;
  currentUserId: string | null;
  mutating: boolean;
  onOpen: (c: Conversation) => void;
  onAccept: (c: Conversation) => void;
  onDecline: (c: Conversation) => void;
  /** Re-match a previously declined or unmatched conversation. */
  onMatchAgain: (c: Conversation) => void;
  /** Present only in the Archived view — shows an Unarchive action in the tail. */
  onUnarchive?: (c: Conversation) => void;
  unarchiving?: boolean;
}

export const ConversationRow = memo(function ConversationRow({
  conversation,
  currentUserId,
  mutating,
  onOpen,
  onAccept,
  onDecline,
  onMatchAgain,
  onUnarchive,
  unarchiving,
}: Readonly<ConversationRowProps>) {
  const flags = flagsForConversation(conversation, currentUserId);
  const miniStatus = miniStatusForFlags(flags);
  const name = conversation.participant?.name ?? "Unknown";
  const initials = getInitials(name);
  const avatarUrl = conversation.participant?.avatar_url ?? null;
  const preview = conversation.last_message ?? conversation.last_message_text ?? "Start the conversation";
  const time = formatRowTime(conversation.last_message_at);

  // Web parity: ring color around avatar communicates match state.
  const ringStyle = flags.isMatched
    ? styles.ringMatched
    : flags.awaitingMine
      ? styles.ringAwaitingMine
      : flags.isBlocked
        ? styles.ringBlocked
        : styles.ringDefault;

  // The row is a plain View with a full-bleed press target BEHIND its content,
  // so the tail actions (Accept / Close / Match again / Unarchive) are siblings
  // rather than children of it.
  //
  // They used to be nested. On react-native-web an accessibilityRole="button"
  // Pressable renders a real <button>, so that produced <button> inside
  // <button> - invalid HTML that React warns about and that breaks hydration.
  // It is an accessibility bug too: nested controls are not reliably reachable
  // and screen readers announce the pair ambiguously.
  //
  // The overlay keeps the whole row tappable (plain Views never become touch
  // responders, so a tap on the text falls through to it) while a tap on an
  // action button hits that button first. Web does the same in
  // CustomerNotifications.
  return (
    <View style={[styles.row, flags.hasUnread && styles.rowUnread]}>
      <Pressable
        onPress={() => onOpen(conversation)}
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={`Open conversation with ${name}`}
      />
      {flags.hasUnread ? <View style={styles.unreadStripe} pointerEvents="none" /> : null}

      {/* pointerEvents is what makes the overlay above reachable on native. A
          touch is hit-tested to the deepest view under the finger and then only
          bubbles to that view's ANCESTORS - never to a sibling - so without it a
          tap on the avatar, name or preview landed on these Views, found no
          responder, and the row did nothing on Android. */}
      <View style={[styles.avatarWrap, ringStyle]} pointerEvents="none">
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>{initials}</Text>
          </View>
        )}
        {flags.hasUnread ? <View style={styles.unreadDot} /> : null}
      </View>

      <View style={styles.body} pointerEvents="none">
        <View style={styles.topRow}>
          <Text
            style={[styles.name, flags.hasUnread && styles.nameUnread]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {miniStatus ? (
            <View style={[styles.miniStatusPill, { backgroundColor: miniStatus.bg }]}>
              <Text style={[styles.miniStatusText, { color: miniStatus.fg }]}>
                {miniStatus.label}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[styles.preview, flags.hasUnread && styles.previewUnread]}
          numberOfLines={1}
        >
          {preview}
        </Text>
      </View>

      {/* box-none: the tail's own buttons stay tappable, everything else in it
          passes the touch through to the row overlay. */}
      <View style={styles.tail} pointerEvents="box-none">
        <View pointerEvents="none">
          <Text style={[styles.timeText, flags.hasUnread && styles.timeUnread]}>{time}</Text>
        </View>
        {/*
         * Tail action precedence (web parity):
         *   1. Awaiting-mine → Accept (green) + Close (outline)
         *   2. Declined or Unmatched → "Match again" (green)
         *   3. Has unread → numeric badge (capped at "9+")
         *   4. Otherwise → time only (already rendered above)
         */}
        {onUnarchive ? (
          <Pressable
            onPress={() => onUnarchive(conversation)}
            disabled={unarchiving}
            style={[styles.actionButton, styles.unarchiveButton]}
            accessibilityRole="button"
            accessibilityLabel="Unarchive chat"
            hitSlop={4}
          >
            <Ionicons name="arrow-undo-outline" size={12} color={colors.primary} />
            <Text style={styles.unarchiveButtonText}>{unarchiving ? "…" : "Unarchive"}</Text>
          </Pressable>
        ) : flags.awaitingMine ? (
          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => onAccept(conversation)}
              disabled={mutating}
              style={[styles.actionButton, styles.acceptButton]}
              accessibilityRole="button"
              accessibilityLabel="Accept match request"
              hitSlop={4}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </Pressable>
            <Pressable
              onPress={() => onDecline(conversation)}
              disabled={mutating}
              style={[styles.actionButton, styles.declineButton]}
              accessibilityRole="button"
              accessibilityLabel="Close match request"
              hitSlop={4}
            >
              <Text style={styles.declineButtonText}>Close</Text>
            </Pressable>
          </View>
        ) : flags.isDeclined || flags.wasUnmatched ? (
          <Pressable
            onPress={() => onMatchAgain(conversation)}
            disabled={mutating}
            style={[styles.actionButton, styles.acceptButton]}
            accessibilityRole="button"
            accessibilityLabel="Match again"
            hitSlop={4}
          >
            <Text style={styles.acceptButtonText}>Match again</Text>
          </Pressable>
        ) : flags.hasUnread ? (
          <View style={styles.unreadCountBadge} pointerEvents="none">
            <Text style={styles.unreadCountText}>
              {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // Row
  row: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 10,
  },
  rowUnread: {
    backgroundColor: "rgba(255, 122, 38, 0.06)",
    borderColor: "rgba(255, 122, 38, 0.20)",
  },
  unreadStripe: {
    position: "absolute",
    left: 4,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  avatarWrap: { position: "relative" },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 46, height: 46, borderRadius: 23 },
  avatarLabel: { color: colors.text, fontSize: 16, fontWeight: "800" },
  ringDefault: { borderRadius: 25, padding: 2, borderWidth: 1, borderColor: colors.border },
  ringMatched: { borderRadius: 25, padding: 2, borderWidth: 2, borderColor: colors.safe },
  ringAwaitingMine: { borderRadius: 25, padding: 2, borderWidth: 2, borderColor: colors.warning },
  ringBlocked: { borderRadius: 25, padding: 2, borderWidth: 2, borderColor: colors.danger },
  unreadDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
  },

  body: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: colors.text, fontSize: 15, fontWeight: "600", flexShrink: 1 },
  nameUnread: { fontWeight: "800" },
  miniStatusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  miniStatusText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  preview: { color: colors.mutedText, fontSize: 13, marginTop: 4 },
  previewUnread: { color: colors.text, fontWeight: "600" },

  tail: { alignItems: "flex-end", gap: 6 },
  timeText: { color: colors.mutedText, fontSize: 11, fontWeight: "500" },
  timeUnread: { color: colors.primary, fontWeight: "800" },
  actionsRow: { flexDirection: "row", gap: 6 },
  actionButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  // Orange CTA (web parity: the inbox row's accept dot and the pinned match
  // prompt both use it). `safe` stays the STATUS colour — the "Matched" pill
  // two lines up in this same row is green, and the button must not read as
  // another status chip.
  acceptButton: { backgroundColor: colors.ctaAccent },
  acceptButtonText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  declineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  declineButtonText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  unarchiveButton: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    backgroundColor: colors.surfaceTintPrimary,
    borderWidth: 1,
    borderColor: "rgba(93, 63, 211, 0.30)",
  },
  unarchiveButtonText: { color: colors.primary, fontSize: 11, fontWeight: "800" },

  // Tail-side unread count badge (shown when there's no other action button).
  unreadCountBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadCountText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800",
  },
});
