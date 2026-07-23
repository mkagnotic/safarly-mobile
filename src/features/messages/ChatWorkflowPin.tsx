import { Ionicons } from "@expo/vector-icons";
import { memo, useEffect, useState } from "react";
import { ActivityIndicator, LayoutAnimation, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import type { ActiveDeal, WorkflowView } from "@/services/api";
import { colors } from "@/theme/colors";

type IoniconName = keyof typeof Ionicons.glyphMap;
type Tone = "primary" | "good" | "warn" | "bad" | "neutral";

/**
 * Per-CTA presentation. The label/kind/variant come from the server; this only
 * adds an icon, a tone, and a one-line explanation for the expanded card. Keyed
 * by `workflow.cta.code` (see `supabase/functions/_shared/fsm.ts`).
 */
const CTA_META: Record<string, { icon: IoniconName; tone: Tone; blurb: string }> = {
  // Match handshake
  request_match: { icon: "hand-right-outline", tone: "primary", blurb: "Send a match request to start this deal." },
  request_match_again: { icon: "refresh-outline", tone: "primary", blurb: "Send a new match request to reopen this conversation." },
  accept_match: { icon: "checkmark-circle-outline", tone: "good", blurb: "They asked to match — accept to move forward." },
  await_match_accept: { icon: "hourglass-outline", tone: "neutral", blurb: "Waiting for them to accept your match request." },
  // Travel document
  upload_travel_doc: { icon: "document-attach-outline", tone: "primary", blurb: "Upload your travel document so the sender can verify the trip." },
  review_travel_doc: { icon: "shield-checkmark-outline", tone: "primary", blurb: "The carrier uploaded their travel document — review it." },
  await_admin_review: { icon: "time-outline", tone: "neutral", blurb: "An admin is reviewing the travel document." },
  // Parcel photos
  upload_parcel_photos: { icon: "images-outline", tone: "primary", blurb: "Add parcel photos so the carrier can review what they'll carry." },
  review_parcel_photos: { icon: "eye-outline", tone: "primary", blurb: "The sender added parcel photos — review and approve them." },
  // Offer
  make_offer: { icon: "pricetag-outline", tone: "primary", blurb: "Verification is done — send a delivery-fee offer." },
  accept_offer: { icon: "checkmark-circle-outline", tone: "good", blurb: "Review the current offer and accept, counter or decline." },
  await_offer_response: { icon: "hourglass-outline", tone: "neutral", blurb: "Waiting for a response to the offer." },
  // Payment
  pay: { icon: "card-outline", tone: "primary", blurb: "Pay to hold the fee in escrow and confirm the booking." },
  pay_grace: { icon: "alert-circle-outline", tone: "warn", blurb: "Payment is overdue — pay now before the deal auto-cancels." },
  await_payment: { icon: "hourglass-outline", tone: "neutral", blurb: "Waiting for the sender to pay." },
  await_payment_grace: { icon: "hourglass-outline", tone: "warn", blurb: "Waiting for payment — the grace period is running." },
  // Handoff / transit / delivery
  accept_handoff: { icon: "cube-outline", tone: "primary", blurb: "Confirm you've collected the parcel to start the trip." },
  await_handoff: { icon: "hourglass-outline", tone: "neutral", blurb: "Waiting for the carrier to collect the parcel." },
  in_transit: { icon: "car-outline", tone: "neutral", blurb: "The parcel is on its way." },
  share_otp: { icon: "key-outline", tone: "primary", blurb: "Share your delivery code with the carrier at handover." },
  generate_otp: { icon: "key-outline", tone: "primary", blurb: "Generate the delivery code to confirm handover." },
  verify_otp: { icon: "keypad-outline", tone: "primary", blurb: "Enter the delivery code to confirm delivery." },
  // Terminal
  completed: { icon: "checkmark-done-outline", tone: "good", blurb: "Delivered — rate this delivery to finish." },
  return_flow: { icon: "return-up-back-outline", tone: "warn", blurb: "A return is in progress for this parcel." },
};

const TONE_FG: Record<Tone, string> = {
  primary: colors.wordmark,
  good: colors.safe,
  warn: colors.warning,
  bad: colors.danger,
  neutral: colors.subtleText,
};
const TONE_BG: Record<Tone, string> = {
  primary: colors.surfaceTintPrimary,
  good: "rgba(34, 195, 93, 0.12)",
  warn: colors.surfaceTintWarning,
  bad: "rgba(220, 40, 40, 0.10)",
  neutral: colors.surfaceMuted,
};

/** Web parity (`ChatCountdown.tsx` LABEL). */
const COUNTDOWN_LABEL: Record<string, string> = {
  match_auto_decline: "Auto-declines in",
  travel_verify_escalate: "Sent for review in",
  parcel_review_reminder: "Reminder in",
  payment_grace: "Payment due in",
  payment_cancel: "Auto-cancels in",
  otp_reminder: "Reminder in",
  archive: "Archives in",
};

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return "";
  if (ms <= 0) return "any moment now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec}s`;
}

/** Live countdown to the backend-enforced stage deadline. Display only. */
function Countdown({ expiresAt, kind }: Readonly<{ expiresAt: string; kind?: string | null }>) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const urgent = new Date(expiresAt).getTime() - Date.now() < 60 * 60 * 1000;
  const label = (kind && COUNTDOWN_LABEL[kind]) || "Expires in";
  const color = urgent ? colors.warning : colors.subtleText;
  return (
    <View style={styles.countdownRow}>
      <Ionicons name="time-outline" size={11} color={color} />
      <Text style={[styles.countdownText, { color }]}>
        {label} {formatRemaining(expiresAt)}
      </Text>
    </View>
  );
}

export interface ChatWorkflowPinProps {
  workflow: WorkflowView;
  activeDeal: ActiveDeal | null;
  /** Runs the CTA. `code` is `workflow.cta.code`; the screen maps it to a screen/handler. */
  onAction: (code: string) => void;
  /** True while the current CTA's action is in flight (spins the button). */
  pending?: boolean;
}

/**
 * Pinned action bar — the mobile counterpart of web's `ChatWorkflowPin`, and a
 * PURE PROJECTION of the server FSM. Web renders a full card; on a phone that
 * would eat a third of the screen, so this is a one-line bar that expands on tap
 * to reveal the explanation. Everything shown comes from `workflow` — a
 * refresh/reconnect always restores the right state because it's server-owned.
 *
 * Nothing renders for states with no user-facing action (MATCHED / ARCHIVED /
 * CANCELLED with nothing to do); the caller can still show a system row for those.
 */
export const ChatWorkflowPin = memo(function ChatWorkflowPin({
  workflow,
  activeDeal,
  onAction,
  pending,
}: ChatWorkflowPinProps) {
  const [expanded, setExpanded] = useState(false);
  const { cta, expires_at: expiresAt, timeout_kind: timeoutKind } = workflow;

  // Nothing to surface: no CTA and no countdown. MATCHED sits here between the
  // handshake and the first verification step.
  if (cta.kind === "none" && !expiresAt) return null;

  const meta = CTA_META[cta.code] ?? { icon: "ellipse-outline" as IoniconName, tone: "neutral" as Tone, blurb: "" };
  const tone: Tone =
    cta.variant === "destructive" ? "bad" : cta.variant === "secondary" ? "neutral" : meta.tone;
  const isAction = cta.kind === "action" || cta.kind === "link";
  const label = cta.label ?? "Update";

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.bar}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={label}
      >
        <View style={[styles.iconBubble, { backgroundColor: TONE_BG[tone] }]}>
          <Ionicons name={meta.icon} size={15} color={TONE_FG[tone]} />
        </View>

        <View style={styles.barTextCol}>
          <Text style={[styles.barLabel, { color: isAction ? colors.text : TONE_FG[tone] }]} numberOfLines={expanded ? undefined : 1}>
            {label}
          </Text>
          {expiresAt ? <Countdown expiresAt={expiresAt} kind={timeoutKind} /> : null}
        </View>

        {isAction ? (
          <Pressable
            style={[styles.actionButton, { backgroundColor: tone === "bad" ? colors.danger : colors.primary }]}
            onPress={() => onAction(cta.code)}
            disabled={pending}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            {pending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.actionButtonText}>{ctaButtonText(cta.code)}</Text>
            )}
          </Pressable>
        ) : (
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.mutedText}
          />
        )}
      </Pressable>

      {expanded && meta.blurb ? (
        <View style={styles.detail}>
          <Text style={styles.detailText}>{meta.blurb}</Text>
          {activeDeal?.parcel ? (
            <Text style={styles.detailMeta}>
              {activeDeal.parcel.from_city} → {activeDeal.parcel.to_city}
              {activeDeal.offer ? `  ·  ${activeDeal.offer.currency === "USD" ? "$" : ""}${activeDeal.offer.amount}` : ""}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

/** Short button verb per CTA code (the bar label carries the full sentence). */
function ctaButtonText(code: string): string {
  switch (code) {
    case "request_match":
    case "request_match_again":
      return "Match";
    case "accept_match":
    case "accept_offer":
    case "accept_handoff":
      return "Review";
    case "upload_travel_doc":
    case "upload_parcel_photos":
      return "Upload";
    case "review_travel_doc":
    case "review_parcel_photos":
      return "Review";
    case "make_offer":
      return "Offer";
    case "pay":
    case "pay_grace":
      return "Pay";
    case "generate_otp":
    case "share_otp":
      return "Code";
    case "verify_otp":
      return "Verify";
    case "completed":
      return "Rate";
    default:
      return "Open";
  }
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  barTextCol: { flex: 1, minWidth: 0 },
  barLabel: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  countdownRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  countdownText: { fontSize: 11, lineHeight: 15, fontWeight: "600", fontVariant: ["tabular-nums"] },
  actionButton: {
    minWidth: 72,
    minHeight: 34,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: { color: colors.white, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  detail: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 4,
  },
  detailText: { color: colors.mutedText, fontSize: 13, lineHeight: 19, fontWeight: "500" },
  detailMeta: { color: colors.subtleText, fontSize: 12, lineHeight: 16, fontWeight: "600" },
});

export default ChatWorkflowPin;
