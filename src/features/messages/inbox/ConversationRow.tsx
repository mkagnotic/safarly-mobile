import { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { VerifiedAvatarBadge } from "@/components/ui/Avatar";
import { type Conversation } from "@/services/api";
import { colors } from "@/theme/colors";
import { COMPACT_CONTROL_MAX_FONT_SCALE } from "@/theme/typography";

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
  // so the tail actions (Accept / Decline / Match again / Unarchive) are siblings
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
        <VerifiedAvatarBadge verified={conversation.participant?.is_verified} avatarSize={46} />
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
              <Text style={[styles.miniStatusText, { color: miniStatus.fg }]} numberOfLines={1} maxFontSizeMultiplier={COMPACT_CONTROL_MAX_FONT_SCALE}>
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
         *   1. Archived view → Unarchive
         *   2. Awaiting-mine → Accept (orange) + Decline (outline)
         *   3. Declined or Unmatched → "Match again"
         * The unread pill (capped at "9+") ALWAYS shows when the chat has unread
         * messages - beside the action, never in its place. Hiding it on archived,
         * declined, unmatched and awaiting rows left the badge counting messages no
         * row showed (flow-18 bug 11; the server sends archived rows' counts on purpose).
         */}
        <View style={styles.actionsRow} pointerEvents="box-none">
          {onUnarchive ? (
            <Pressable
              onPress={() => onUnarchive(conversation)}
              disabled={unarchiving}
              style={[styles.actionButton, styles.unarchiveButton, unarchiving && styles.actionBusy]}
              accessibilityRole="button"
              accessibilityLabel="Unarchive chat"
              accessibilityState={{ busy: !!unarchiving, disabled: !!unarchiving }}
              hitSlop={4}
            >
              {unarchiving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="arrow-undo-outline" size={12} color={colors.primary} />
              )}
              <Text style={styles.unarchiveButtonText}>Unarchive</Text>
            </Pressable>
          ) : flags.awaitingMine ? (
            <>
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
              {/* "Decline", as on web and in the dialog it opens (flow-18 bug 18). */}
              <Pressable
                onPress={() => onDecline(conversation)}
                disabled={mutating}
                style={[styles.actionButton, styles.declineButton]}
                accessibilityRole="button"
                accessibilityLabel="Decline match"
                hitSlop={4}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </Pressable>
            </>
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
          ) : null}
          {flags.hasUnread ? (
            <View style={styles.unreadCountBadge} pointerEvents="none">
              <Text style={styles.unreadCountText}>
                {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
              </Text>
            </View>
          ) : null}
        </View>
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
  // WRAPS: on a 320pt screen with larger text the status pill + "Match again"
  // left the name zero width and it rendered as "…". The pill now drops under
  // the name when the row is short; the name is never squeezed away.
  topRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: "600", flexShrink: 1 },
  nameUnread: { fontWeight: "800" },
  // Never squeezed: "Unmatched" broke as "Unmatch / ed"; it wraps under the name instead.
  miniStatusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, flexShrink: 0 },
  miniStatusText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  preview: { color: colors.mutedText, fontSize: 13, marginTop: 4 },
  previewUnread: { color: colors.text, fontWeight: "600" },

  tail: { alignItems: "flex-end", gap: 6 },
  timeText: { color: colors.mutedText, fontSize: 11, fontWeight: "500" },
  timeUnread: { color: colors.primary, fontWeight: "800" },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionBusy: { opacity: 0.6 },
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

  // Tail-side unread count badge (beside any action button).
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
