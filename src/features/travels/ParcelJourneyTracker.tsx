import { Ionicons } from "@expo/vector-icons";
import { memo, useMemo, useState } from "react";
import { LayoutAnimation, Platform, StyleSheet, Text, UIManager, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import {
  STAGE_ORDER,
  computeJourney,
  type StageKey,
  type StageState,
} from "@/features/travels/journeyTracker";
import type { Booking, Parcel } from "@/services/api";
import { colors } from "@/theme/colors";

// LayoutAnimation is opt-in on Android; enabling it here keeps the expand/collapse
// smooth without pulling in Reanimated for one component.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

interface Props {
  /** Optional — only used as a pre-booking fallback; the booking drives the journey. */
  parcel?: Parcel | null;
  booking?: Booking | null;
  /** Start expanded (e.g. deep-linked). Defaults to collapsed like a standard app. */
  defaultOpen?: boolean;
}

/**
 * Amazon/Flipkart-style journey tracker for a parcel — the mobile counterpart of
 * web's `ParcelJourneyTracker`. Renders a collapsible "Track parcel" header that
 * expands a vertical timeline of the 11 delivery stages, including terminal
 * (cancelled/expired/declined) and disputed outcomes.
 *
 * All state comes from {@link computeJourney}, which is a verbatim port of web's
 * logic — so the two platforms can't disagree about a journey.
 */
export const ParcelJourneyTracker = memo(function ParcelJourneyTracker({
  parcel,
  booking,
  defaultOpen = false,
}: Readonly<Props>) {
  const [open, setOpen] = useState(defaultOpen);

  // Only surface the tracker once a carrier is committed (matched). Pre-match
  // listings (open / looking-for-carrier / negotiating) have no journey to track,
  // so showing "Track parcel — 0/11" there is just noise.
  const isMatched =
    !!booking ||
    (!!parcel?.status &&
      ["matched", "in_transit", "delivered", "completed", "disputed"].includes(parcel.status));

  const journey = useMemo(
    () => (isMatched ? computeJourney(parcel, booking) : null),
    [isMatched, parcel, booking],
  );

  if (!journey) return null;

  const { stages, outcome, outcomeLabel } = journey;
  const doneCount = stages.filter((s) => s.state === "done").length;
  const currentStage = stages.find((s) => s.state === "current");
  const isBad = outcome === "cancelled" || outcome === "disputed";

  const summary = isBad
    ? outcome === "disputed"
      ? "Payment under review"
      : outcomeLabel
    : currentStage
      ? `Next: ${currentStage.label}`
      : doneCount >= STAGE_ORDER.length
        ? "Journey complete"
        : "Awaiting carrier";

  const summaryColor =
    outcome === "cancelled"
      ? colors.danger
      : outcome === "disputed"
        ? colors.warning
        : colors.mutedText;

  const badgeStyle =
    outcome === "cancelled"
      ? styles.badgeDanger
      : outcome === "disputed"
        ? styles.badgeWarning
        : styles.badgePrimary;
  const badgeColor =
    outcome === "cancelled"
      ? colors.danger
      : outcome === "disputed"
        ? colors.warning
        : colors.wordmark;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Track parcel. ${summary}`}
      >
        <View style={[styles.badge, badgeStyle]}>
          <Ionicons
            name={isBad ? "alert-circle-outline" : "location-outline"}
            size={13}
            color={badgeColor}
          />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle}>Track parcel</Text>
          <Text style={[styles.headerSummary, { color: summaryColor }]} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        {!isBad ? (
          <Text style={styles.headerCount}>
            {Math.max(doneCount, 0)}/{STAGE_ORDER.length}
          </Text>
        ) : null}
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedText}
        />
      </Pressable>

      {open ? (
        <View style={styles.body}>
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

          {stages.map((stage, i) => {
            const tone = NODE_TONES[stage.state];
            const isLast = i === stages.length - 1;
            return (
              <View key={stage.key} style={styles.stageRow}>
                {/* Left rail: node + connector down to the next stage. */}
                <View style={styles.rail}>
                  <View
                    style={[
                      styles.node,
                      { backgroundColor: tone.bg, borderColor: tone.border },
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
                      color={tone.fg}
                    />
                  </View>
                  {!isLast ? (
                    <View
                      style={[
                        styles.connector,
                        stage.state === "done" && styles.connectorDone,
                      ]}
                    />
                  ) : null}
                </View>

                {/* Content */}
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
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 12,
    paddingTop: 4,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  badgePrimary: { backgroundColor: colors.surfaceTintPrimary },
  badgeDanger: { backgroundColor: "rgba(220, 40, 40, 0.10)" },
  badgeWarning: { backgroundColor: colors.surfaceTintWarning },
  headerTextCol: { flex: 1, minWidth: 0 },
  headerTitle: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  headerSummary: { fontSize: 11, lineHeight: 15, fontWeight: "500", marginTop: 1 },
  headerCount: {
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  body: { paddingTop: 4, paddingBottom: 8 },

  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  noticeDanger: { backgroundColor: "rgba(220, 40, 40, 0.08)" },
  noticeWarning: { backgroundColor: colors.surfaceTintWarning },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: "600" },

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
