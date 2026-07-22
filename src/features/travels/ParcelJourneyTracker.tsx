import { Ionicons } from "@expo/vector-icons";
import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  STAGE_ORDER,
  computeJourney,
  type JourneyResult,
  type StageKey,
  type StageState,
} from "@/features/travels/journeyTracker";
import type { Booking, Parcel } from "@/services/api";
import { colors } from "@/theme/colors";

type IoniconName = keyof typeof Ionicons.glyphMap;

/** Web parity (`ParcelJourneyTracker.tsx` STAGE_ICONS), mapped to Ionicons. */
const STAGE_ICONS: Record<StageKey, IoniconName> = {
  matched: "people-outline",
  flight_verified: "airplane-outline",
  parcel_approved: "clipboard-outline",
  parcel_received: "cube-outline",
  payment_secured: "shield-checkmark-outline",
  travel_tomorrow: "calendar-outline",
  traveling: "car-outline",
  ready_for_delivery: "location-outline",
  otp_verification: "key-outline",
  payment_released: "wallet-outline",
  review: "star-outline",
};

interface NodeTone {
  bg: string;
  fg: string;
  border: string;
}

const NODE_TONES: Record<StageState, NodeTone> = {
  done: { bg: colors.safe, fg: colors.white, border: colors.safe },
  current: { bg: colors.surfaceTintPrimary, fg: colors.wordmark, border: colors.wordmark },
  upcoming: { bg: colors.surfaceMuted, fg: colors.subtleText, border: colors.border },
  failed: { bg: colors.danger, fg: colors.white, border: colors.danger },
  skipped: { bg: colors.surfaceMuted, fg: colors.subtleText, border: colors.border },
  disputed: { bg: colors.surfaceTintWarning, fg: colors.warning, border: colors.warning },
};

const LABEL_COLORS: Record<StageState, string> = {
  done: colors.text,
  current: colors.text,
  upcoming: colors.mutedText,
  failed: colors.danger,
  skipped: colors.subtleText,
  disputed: colors.warning,
};

interface JourneyInput {
  /** Optional — only used as a pre-booking fallback; the booking drives the journey. */
  parcel?: Parcel | null;
  booking?: Booking | null;
}

/**
 * Only surface a journey once a carrier is committed. Pre-match listings
 * (open / looking-for-carrier / negotiating) have no journey to track, so
 * showing "0/11" there is just noise. Web parity.
 */
function useJourney({ parcel, booking }: JourneyInput): JourneyResult | null {
  return useMemo(() => {
    const isMatched =
      !!booking ||
      (!!parcel?.status &&
        ["matched", "in_transit", "delivered", "completed", "disputed"].includes(parcel.status));
    return isMatched ? computeJourney(parcel, booking) : null;
  }, [parcel, booking]);
}

/** Shared header/summary derivation so the row and the timeline never disagree. */
function summarise(journey: JourneyResult) {
  const { stages, outcome, outcomeLabel } = journey;
  const doneCount = stages.filter((s) => s.state === "done").length;
  const currentStage = stages.find((s) => s.state === "current");
  const isBad = outcome === "cancelled" || outcome === "disputed";

  const summary = isBad
    ? outcome === "disputed"
      ? "Payment under review"
      : (outcomeLabel ?? "Journey ended")
    : currentStage
      ? `Next: ${currentStage.label}`
      : doneCount >= STAGE_ORDER.length
        ? "Journey completed"
        : "Awaiting carrier";

  const tone =
    outcome === "cancelled"
      ? colors.danger
      : outcome === "disputed"
        ? colors.warning
        : colors.mutedText;

  return { doneCount, isBad, summary, tone };
}

// ───────────────────────── Compact row (list cards) ─────────────────────────

/**
 * One-line journey status for a list card — the "at a glance" half of the
 * standard tracking pattern. The full timeline lives on the item's details
 * screen, which the parent card already navigates to on press, so this is
 * presentational and carries only an affordance chevron.
 */
export const JourneySummaryRow = memo(function JourneySummaryRow({
  parcel,
  booking,
}: Readonly<JourneyInput>) {
  const journey = useJourney({ parcel, booking });
  if (!journey) return null;

  const { doneCount, isBad, summary, tone } = summarise(journey);

  return (
    <View style={styles.summaryRow}>
      <View
        style={[
          styles.summaryBadge,
          isBad && journey.outcome === "cancelled" && styles.badgeDanger,
          isBad && journey.outcome === "disputed" && styles.badgeWarning,
        ]}
      >
        <Ionicons
          name={isBad ? "alert-circle-outline" : "location-outline"}
          size={13}
          color={
            journey.outcome === "cancelled"
              ? colors.danger
              : journey.outcome === "disputed"
                ? colors.warning
                : colors.wordmark
          }
        />
      </View>
      <Text style={[styles.summaryText, { color: tone }]} numberOfLines={1}>
        {summary}
      </Text>
      {!isBad ? (
        <Text style={styles.summaryCount}>
          {Math.max(doneCount, 0)}/{STAGE_ORDER.length}
        </Text>
      ) : null}
      <Ionicons name="chevron-forward" size={14} color={colors.subtleText} />
    </View>
  );
});

// ───────────────────────── Full timeline (details screens) ─────────────────────────

/**
 * The full 11-stage delivery timeline, always expanded — it's the point of the
 * section it sits in on a details screen, so it doesn't hide behind a toggle.
 * Renders nothing before a carrier is committed.
 */
export const ParcelJourneyTimeline = memo(function ParcelJourneyTimeline({
  parcel,
  booking,
}: Readonly<JourneyInput>) {
  const journey = useJourney({ parcel, booking });
  if (!journey) return null;

  const { stages, outcome, outcomeLabel } = journey;
  const { doneCount, isBad, summary, tone } = summarise(journey);

  return (
    <View style={styles.timelineCard}>
      <View style={styles.timelineHeader}>
        <Text style={styles.timelineTitle}>Delivery tracking</Text>
        {!isBad ? (
          <Text style={styles.timelineCount}>
            {Math.max(doneCount, 0)}/{STAGE_ORDER.length}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.timelineSummary, { color: tone }]}>{summary}</Text>

      {outcome === "cancelled" ? (
        <View style={[styles.notice, styles.noticeDanger]}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
          <Text style={[styles.noticeText, { color: colors.danger }]}>
            {outcomeLabel} — this journey didn&apos;t complete.
          </Text>
        </View>
      ) : null}
      {outcome === "disputed" ? (
        <View style={[styles.notice, styles.noticeWarning]}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
          <Text style={[styles.noticeText, { color: colors.warning }]}>
            Payment is under review — a dispute is open on this delivery.
          </Text>
        </View>
      ) : null}

      <View style={styles.stages}>
        {stages.map((stage, i) => {
          const nodeTone = NODE_TONES[stage.state];
          const isLast = i === stages.length - 1;
          return (
            <View key={stage.key} style={styles.stageRow}>
              {/* Left rail: node + connector down to the next stage. */}
              <View style={styles.rail}>
                <View
                  style={[
                    styles.node,
                    { backgroundColor: nodeTone.bg, borderColor: nodeTone.border },
                    stage.state === "current" && styles.nodeCurrent,
                  ]}
                >
                  <Ionicons
                    name={
                      stage.state === "done"
                        ? "checkmark"
                        : stage.state === "failed"
                          ? "close"
                          : stage.state === "disputed"
                            ? "alert-circle-outline"
                            : STAGE_ICONS[stage.key]
                    }
                    size={13}
                    color={nodeTone.fg}
                  />
                </View>
                {!isLast ? (
                  <View
                    style={[styles.connector, stage.state === "done" && styles.connectorDone]}
                  />
                ) : null}
              </View>

              <View style={[styles.stageContent, isLast && styles.stageContentLast]}>
                <View style={styles.stageTextCol}>
                  <Text
                    style={[
                      styles.stageLabel,
                      { color: LABEL_COLORS[stage.state] },
                      stage.state === "current" && styles.stageLabelCurrent,
                      stage.state === "skipped" && styles.stageLabelSkipped,
                    ]}
                  >
                    {stage.label}
                  </Text>
                  {stage.state === "current" ? (
                    <Text style={styles.stageHintCurrent}>In progress</Text>
                  ) : null}
                  {stage.state === "disputed" ? (
                    <Text style={styles.stageHintDisputed}>Under review</Text>
                  ) : null}
                </View>
                {stage.detail ? (
                  <Text
                    style={[
                      styles.stageDetail,
                      stage.state === "failed" && { color: colors.danger },
                      stage.state === "disputed" && { color: colors.warning },
                    ]}
                  >
                    {stage.detail}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // ───── Compact row ─────
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  summaryBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTintPrimary,
  },
  badgeDanger: { backgroundColor: "rgba(220, 40, 40, 0.10)" },
  badgeWarning: { backgroundColor: colors.surfaceTintWarning },
  summaryText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  summaryCount: {
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  // ───── Full timeline ─────
  timelineCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  timelineTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  timelineCount: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  timelineSummary: { fontSize: 13, lineHeight: 18, fontWeight: "600", marginTop: 2 },

  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
  },
  noticeDanger: { backgroundColor: "rgba(220, 40, 40, 0.08)" },
  noticeWarning: { backgroundColor: colors.surfaceTintWarning },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: "600" },

  stages: { marginTop: 16 },
  stageRow: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center" },
  node: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeCurrent: { borderWidth: 2 },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 14,
    marginVertical: 4,
    borderRadius: 1,
    backgroundColor: colors.border,
  },
  connectorDone: { backgroundColor: colors.safe },

  stageContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 16,
  },
  stageContentLast: { paddingBottom: 0 },
  stageTextCol: { flex: 1, minWidth: 0 },
  stageLabel: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  stageLabelCurrent: { fontWeight: "800" },
  stageLabelSkipped: { textDecorationLine: "line-through" },
  stageHintCurrent: {
    color: colors.wordmark,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  stageHintDisputed: {
    color: colors.warning,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  stageDetail: {
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
});
