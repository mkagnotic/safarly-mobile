import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

import {
  blockedBannerBody,
  MATCH_DECLINED_BODY,
  MATCH_UNMATCHED_BODY,
  matchRequestBody,
  matchWaitingBody,
} from "../lib/chatModerationRules";

interface MatchStateBannerProps {
  participantName: string;
  matchedByOther: boolean;
  matchedByMe: boolean;
  isDeclined: boolean;
  wasUnmatched: boolean;
  isBlocked: boolean;
  /** Only the person who blocked is told how to undo it (blocked_by). */
  canUnblock: boolean;
  /** A travel-buddy match reads "for this trip". */
  isBuddy?: boolean;
  matchBusy: boolean;
  matchPending: boolean;
  decliningPending: boolean;
  setMatchModalOpen: (open: boolean) => void;
  setDeclineOpen: (open: boolean) => void;
}

/** ───────── Match-state banner ───────── */
export function MatchStateBanner({
  participantName,
  matchedByOther,
  matchedByMe,
  isDeclined,
  wasUnmatched,
  isBlocked,
  canUnblock,
  isBuddy = false,
  matchBusy,
  matchPending,
  decliningPending,
  setMatchModalOpen,
  setDeclineOpen,
}: Readonly<MatchStateBannerProps>) {
  return matchedByOther ? (
    <View style={[styles.banner, styles.bannerWarning]}>
      <View style={styles.bannerTextWrap}>
        <Text style={styles.bannerTitle}>Match request</Text>
        <Text style={styles.bannerBody}>{matchRequestBody(participantName, isBuddy)}</Text>
      </View>
      {/* Accept and Decline are two answers to ONE question, so they share
          a single busy flag: once either is being sent the other must be
          dead, or the thread gets a match and a decline for the same
          request. */}
      <View style={styles.bannerActions}>
        <Pressable
          onPress={() => setMatchModalOpen(true)}
          disabled={matchBusy}
          style={[styles.bannerButton, styles.bannerButtonPrimary, matchBusy && styles.bannerButtonDisabled]}
          accessibilityRole="button"
        >
          {matchPending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.bannerButtonPrimaryText}>Accept</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => setDeclineOpen(true)}
          disabled={matchBusy}
          style={[styles.bannerButton, styles.bannerButtonOutline, matchBusy && styles.bannerButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Decline match"
        >
          {/* "Decline", as on web: one word for one action - the dialog's button
              says Decline and the toast "Match declined" (flow-18 bug 18). */}
          {decliningPending ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={styles.bannerButtonOutlineText}>Decline</Text>
          )}
        </Pressable>
      </View>
    </View>
  ) : matchedByMe ? (
    // Web parity (CustomerMessages.tsx:870-888): dedicated waiting strip
    // when YOU sent a match request and the other side hasn't accepted
    // yet. Distinct visual from the closed/declined state below.
    <View style={[styles.banner, styles.bannerWaiting]}>
      <Ionicons name="hourglass" size={16} color={colors.warning} />
      <View style={styles.bannerTextWrap}>
        {/* The viewer SENT the request — they have not accepted anything yet.
            One line, = web: "Match request sent. Waiting for {first} to accept." */}
        <Text style={styles.bannerLine}>{matchWaitingBody(participantName)}</Text>
      </View>
    </View>
  ) : isDeclined || wasUnmatched ? (
    <View style={[styles.banner, styles.bannerMuted]}>
      <View style={styles.bannerTextWrap}>
        {/* After an unmatch the chat is open and the composer live, so it is not
            "closed" (flow-18 bug 19). Same words as web ChatMatchPrompt. */}
        <Text style={styles.bannerLine}>{isDeclined ? MATCH_DECLINED_BODY : MATCH_UNMATCHED_BODY}</Text>
      </View>
      <View style={styles.bannerActions}>
        <Pressable
          onPress={() => setMatchModalOpen(true)}
          disabled={matchBusy}
          style={[styles.bannerButton, styles.bannerButtonPrimary, matchBusy && styles.bannerButtonDisabled]}
          accessibilityRole="button"
        >
          {matchPending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.bannerButtonPrimaryText}>Match again</Text>
          )}
        </Pressable>
      </View>
    </View>
  ) : isBlocked ? (
    <View style={[styles.banner, styles.bannerDanger]}>
      <View style={styles.bannerTextWrap}>
        <Text style={[styles.bannerTitle, { color: colors.danger }]}>
          Conversation blocked
        </Text>
        {/* The person who was blocked can't unblock, so they get a neutral line
            (flow-18 bug 3). */}
        <Text style={styles.bannerBody}>{blockedBannerBody(canUnblock, participantName)}</Text>
      </View>
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  // Banners
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bannerWarning: { backgroundColor: "rgba(245, 158, 11, 0.10)" },
  // Dashed-orange variant for "waiting on the other side" — matches web's
  // distinct treatment for the awaitingOtherAccept state.
  bannerWaiting: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderStyle: "dashed",
    borderTopWidth: 1,
    borderTopColor: colors.warning,
    borderBottomColor: colors.warning,
  },
  bannerMuted: { backgroundColor: colors.surfaceMuted },
  bannerDanger: { backgroundColor: "rgba(239, 68, 68, 0.10)" },
  bannerTextWrap: { flex: 1 },
  bannerTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  bannerBody: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
  // A one-sentence banner (no title), as web's ChatMatchPrompt.
  bannerLine: { color: colors.text, fontSize: 13, fontWeight: "600" },
  bannerActions: { flexDirection: "row", gap: 6 },
  bannerButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  // Orange CTA, not green: `safe` is the app's STATUS colour ("Matched",
  // "Delivered" pills) and `ctaAccent` is the action colour the pinned bar
  // (ChatWorkflowPin) and web's `.btn-action-primary` already use for exactly
  // this button. Two different colours for one action read as two systems.
  bannerButtonPrimary: { backgroundColor: colors.ctaAccent },
  bannerButtonPrimaryText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  bannerButtonDisabled: { opacity: 0.5 },
  bannerButtonOutline: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  bannerButtonOutlineText: { color: colors.text, fontSize: 11, fontWeight: "800" },
});
