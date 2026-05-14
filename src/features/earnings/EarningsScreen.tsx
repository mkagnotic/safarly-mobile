import { memo, useCallback, useMemo } from "react";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import type { AppLanguage } from "@/i18n/translations";
import { t } from "@/i18n/translations";
import { RootStackParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

type Nav = NativeStackNavigationProp<RootStackParamList, "Earnings">;

const HERO_BG = colors.brandDark;
const HERO_MUTED = colors.onBrandMuted;
const TITLE_NAVY = colors.text;
const LABEL_MUTED = colors.mutedText;
const STAT_LABEL = colors.mutedText;
const PENDING_ICON_BG = "#FFF4E6";
const COMPLETED_ICON_BG = "#EAF8F0";

type HistoryStatus = "pending" | "completed";

type EarningHistoryRow = { id: string; date: string; amount: number; status: HistoryStatus };

/** Demo data aligned with the Earnings reference UI */
const TOTAL_EARNED_LIVE = 99;
const DELIVERIES_PAID_LIVE = 2;
const PENDING_TOTAL_LIVE = 28;

const EARNING_HISTORY_LIVE: readonly EarningHistoryRow[] = [
  { id: "1", date: "Mar 15, 2026", amount: 25.2, status: "pending" },
  { id: "2", date: "Mar 14, 2026", amount: 2.8, status: "pending" },
  { id: "3", date: "Mar 10, 2026", amount: 41, status: "completed" },
  { id: "4", date: "Mar 5, 2026", amount: 30, status: "completed" },
];

const HistoryRow = memo(function HistoryRow({ item, language }: Readonly<{ item: EarningHistoryRow; language: AppLanguage }>) {
  const pending = item.status === "pending";
  const statusColor = pending ? colors.warning : colors.safe;
  const statusLabel = pending ? t(language, "earnings.statusPending") : t(language, "earnings.statusCompleted");
  return (
    <View style={styles.historyCard}>
      <View style={[styles.historyIconCircle, { backgroundColor: pending ? PENDING_ICON_BG : COMPLETED_ICON_BG }]}>
        <Ionicons name={pending ? "time-outline" : "checkmark"} size={22} color={statusColor} />
      </View>
      <View style={styles.historyMiddle}>
        <Text style={styles.historyTitle}>{t(language, "earnings.deliveryPayout")}</Text>
        <Text style={styles.historyDate}>{item.date}</Text>
      </View>
      <View style={styles.historyRight}>
        <Text style={styles.historyAmount}>${item.amount.toFixed(2)}</Text>
        <Text style={[styles.historyStatus, { color: statusColor }]}>{statusLabel.toUpperCase()}</Text>
      </View>
    </View>
  );
});

export function EarningsScreen() {
  const navigation = useNavigation<Nav>();
  const { showLiveData, language } = useAppStore(useShallow((s) => ({ showLiveData: s.showLiveData, language: s.language })));

  const totals = useMemo(() => {
    if (!showLiveData) {
      return { totalStr: "0.00", deliveriesPaid: "0", pendingStr: "$0.00", history: [] as readonly EarningHistoryRow[] };
    }
    return {
      totalStr: TOTAL_EARNED_LIVE.toFixed(2),
      deliveriesPaid: String(DELIVERIES_PAID_LIVE),
      pendingStr: `$${PENDING_TOTAL_LIVE.toFixed(2)}`,
      history: EARNING_HISTORY_LIVE,
    };
  }, [showLiveData]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  return (
    <Screen contentContainerStyle={styles.screenContent}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>{t(language, "stack.earnings")}</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroInner}>
          <Ionicons name="cash-outline" size={26} color={colors.white} style={styles.heroIcon} />
          <Text style={styles.heroLabel}>{t(language, "earnings.heroTotalLabel").toUpperCase()}</Text>
          <Text style={styles.heroAmount}>${totals.totalStr}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValueNavy}>{totals.deliveriesPaid}</Text>
          <Text style={styles.statCaption}>{t(language, "earnings.deliveriesPaid").toUpperCase()}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValueOrange}>{totals.pendingStr}</Text>
          <Text style={styles.statCaption}>{t(language, "earnings.pending").toUpperCase()}</Text>
        </View>
      </View>

      <Pressable style={styles.withdrawBtn} onPress={() => {}} accessibilityRole="button" accessibilityLabel={t(language, "earnings.withdrawToBank")}>
        <Ionicons name="cash-outline" size={22} color={colors.white} />
        <Text style={styles.withdrawBtnText}>{t(language, "earnings.withdrawToBank")}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>{t(language, "earnings.history")}</Text>

      {totals.history.length === 0 ? (
        <View style={styles.emptyHistory}>
          <Text style={styles.emptyHistoryText}>{t(language, "earnings.emptyHistory")}</Text>
        </View>
      ) : (
        totals.history.map((row) => <HistoryRow key={row.id} item={row} language={language} />) // NOSONAR
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingBottom: 28 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 18,
    minHeight: 34,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    color: TITLE_NAVY,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  heroCard: {
    backgroundColor: HERO_BG,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  heroInner: { alignItems: "center" },
  heroIcon: { marginBottom: 10, opacity: 0.95 },
  heroLabel: {
    color: HERO_MUTED,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  heroAmount: {
    color: colors.white,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  statValueNavy: {
    color: TITLE_NAVY,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
  },
  statValueOrange: {
    color: colors.warning,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
  },
  statCaption: {
    color: STAT_LABEL,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  withdrawBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.safe,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 22,
    paddingHorizontal: 16,
  },
  withdrawBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionTitle: {
    color: TITLE_NAVY,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  historyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  historyMiddle: { flex: 1 },
  historyTitle: { color: TITLE_NAVY, fontSize: 16, fontWeight: "800" },
  historyDate: { color: LABEL_MUTED, fontSize: 13, marginTop: 2, fontWeight: "500" },
  historyRight: { alignItems: "flex-end" },
  historyAmount: { color: TITLE_NAVY, fontSize: 16, fontWeight: "800" },
  historyStatus: {
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: 0.4,
  },
  emptyHistory: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyHistoryText: {
    color: LABEL_MUTED,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});
