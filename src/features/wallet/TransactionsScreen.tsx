import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import {
  getErrorMessage,
  paymentsApi,
  walletApi,
  type Earnings,
  type Transaction,
} from "@/services/api";
import { colors } from "@/theme/colors";
import { COMPACT_CONTROL_MAX_FONT_SCALE } from "@/theme/typography";
import { showToast } from "@/feedback/appFeedback";
import {
  formatTxAmount,
  formatTxDate,
  txStatusTone,
  txTypeMeta,
  penaltyView,
  txStatusLabel,
} from "@/features/wallet/transactionDisplay";
import { canDownloadReceipt, shareTransactionReceipt } from "@/features/wallet/receiptPdf";
import { formatMoney, formatMoneyByCurrency } from "@/utils/money";
import {
  hasEarnings,
  moneyAmounts,
  transactionCount,
  type PaymentsSummary,
} from "@/features/wallet/paymentsSummary";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "TransactionsTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

const PER_PAGE = 15;

/**
 * Payments history — web parity with `CustomerTransactions`. Lists the user's
 * transactions from `GET /payment-handler/me` with lifetime summary tiles, type
 * labels and status pills. (The web receipt-PDF download is intentionally out of
 * scope for v1 — a native share-sheet receipt can follow.)
 */
export function TransactionsScreen() {
  const navigation = useNavigation<Nav>();

  const [items, setItems] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const hadItemsRef = useRef(false);
  hadItemsRef.current = items.length > 0;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchPage = useCallback(async (nextPage: number) => {
    const res = await paymentsApi.getMyTransactions({ page: nextPage, per_page: PER_PAGE });
    const meta = res.meta as { total?: number; summary?: PaymentsSummary } | undefined;
    return { rows: res.data ?? [], total: meta?.total ?? 0, summary: meta?.summary ?? null };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Earnings (for the pending-payout note) fetched alongside page 1. It's
      // non-essential, so a failure there never blocks the transaction list.
      const [pageRes, earnRes] = await Promise.allSettled([fetchPage(1), walletApi.getEarnings()]);
      if (!mountedRef.current) return;
      if (pageRes.status === "fulfilled") {
        setItems(pageRes.value.rows);
        setTotal(pageRes.value.total);
        setSummary(pageRes.value.summary);
        setPage(1);
      } else {
        throw pageRes.reason;
      }
      if (earnRes.status === "fulfilled") setEarnings(earnRes.value.data ?? null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(getErrorMessage(err));
      // With a list already on screen the error panel is not shown, so a failed
      // pull-to-refresh used to look like "nothing new" (27 Oct 2026). Say so.
      if (hadItemsRef.current) showToast({ title: "Couldn't refresh your payments", message: getErrorMessage(err), variant: "error" });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const { rows } = await fetchPage(next);
      if (!mountedRef.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...rows.filter((r) => !seen.has(r.id))];
      });
      setPage(next);
    } catch (err) {
      // Keep what we have; the button stays so the user can press it again.
      showToast({ title: "Couldn't load more payments", message: getErrorMessage(err), variant: "error" });
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [loadingMore, items.length, total, page, fetchPage]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Profile");
  }, [navigation]);

  const handleDownload = useCallback(async (tx: Transaction) => {
    if (downloadingId) return;
    setDownloadingId(tx.id);
    try {
      await shareTransactionReceipt(tx);
    } catch (err) {
      showToast({ title: "Couldn't create receipt", message: getErrorMessage(err), variant: "error" });
    } finally {
      if (mountedRef.current) setDownloadingId(null);
    }
  }, [downloadingId]);

  const hasMore = items.length < total;
  // The summary endpoint names its currency now; for an older backend fall back
  // to the account's (earnings) currency, else the newest transaction's - never a
  // hard-coded "$".
  const fallbackCurrency = summary?.currency ?? earnings?.currency ?? items[0]?.currency ?? null;
  const moneyLines = (field: "spent" | "refunded" | "earned") =>
    moneyAmounts(summary, field, fallbackCurrency).map((m) => formatMoney(m.amount, m.currency));
  // Third tile mirrors web: "Total earned" when there are earnings, else "Refunded".
  // Money tiles carry one line per currency - never a sum across currencies.
  const thirdTile = hasEarnings(summary)
    ? { label: "Total earned", lines: moneyLines("earned"), tone: colors.safe }
    : { label: "Refunded", lines: moneyLines("refunded"), tone: colors.mutedText };

  return (
    <Screen contentContainerStyle={styles.content} refreshEnabled onRefresh={load}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Payments</Text>
      </View>

      {loading ? (
        <Card style={styles.centerCard}>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : error && items.length === 0 ? (
        <Card style={styles.panel}>
          <Ionicons name="cloud-offline-outline" size={34} color={colors.mutedText} />
          <Text style={styles.panelTitle}>Couldn't load payments</Text>
          <Text style={styles.panelBody}>{error}</Text>
          <AppButton label="Try again" onPress={() => void load()} style={styles.panelButton} />
        </Card>
      ) : (
        <>
          {/* Summary tiles */}
          <View style={styles.summaryRow}>
            <SummaryTile label="Total paid" lines={moneyLines("spent")} tone={colors.text} />
            <SummaryTile label="Transactions" lines={[String(transactionCount(summary, total))]} tone={colors.text} />
            <SummaryTile label={thirdTile.label} lines={thirdTile.lines} tone={thirdTile.tone} />
          </View>

          {/* Payout note — pending payout + auto-payout disclaimer + link
              (folded in from the old Wallet screen). */}
          <Pressable
            style={styles.payoutNote}
            onPress={() => navigation.navigate("PayoutSetupTab")}
            accessibilityRole="button"
            accessibilityLabel="Manage payout details"
          >
            <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
            <View style={{ flex: 1 }}>
              {(earnings?.pending_payouts ?? 0) > 0 ? (
                <Text style={styles.payoutNoteStrong}>
                  {`${formatMoneyByCurrency(earnings?.pending_payouts_by_currency, earnings?.pending_payouts, earnings?.currency)} payout on the way`}
                </Text>
              ) : null}
              <Text style={styles.payoutNoteText}>
                Earnings pay out automatically to your linked bank 2–7 business days after each delivery.
              </Text>
              <Text style={styles.payoutNoteLink}>Manage payout details ›</Text>
            </View>
          </Pressable>

          {items.length === 0 ? (
            <Card style={styles.panel}>
              <Ionicons name="receipt-outline" size={34} color={colors.mutedText} />
              <Text style={styles.panelTitle}>No payments yet</Text>
              <Text style={styles.panelBody}>Your payment history and earnings will appear here.</Text>
            </Card>
          ) : (
            <Card style={styles.listCard}>
              {items.map((tx, i) => (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  isLast={i === items.length - 1}
                  downloading={downloadingId === tx.id}
                  onDownload={() => void handleDownload(tx)}
                />
              ))}
            </Card>
          )}

          {hasMore ? (
            <AppButton
              label={loadingMore ? "Loading…" : "Load more"}
              variant="secondary"
              onPress={() => void loadMore()}
              disabled={loadingMore}
              leftIcon={loadingMore ? <ActivityIndicator size="small" color={colors.text} /> : undefined}
              style={styles.loadMore}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function SummaryTile({
  label,
  lines,
  tone,
}: Readonly<{ label: string; lines: string[]; tone: string }>) {
  const multi = lines.length > 1;
  return (
    <View style={styles.summaryTile}>
      {lines.map((line) => (
        <Text
          key={line}
          style={[styles.summaryValue, multi ? styles.summaryValueSmall : null, { color: tone }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {line}
        </Text>
      ))}
      {/* One line that shrinks: "Transactions" broke as "Transacti / ons" in a
          narrow tile at larger text (23 Oct 2026). */}
      <Text
        style={styles.summaryLabel}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={COMPACT_CONTROL_MAX_FONT_SCALE}
      >
        {label}
      </Text>
    </View>
  );
}

function TxRow({
  tx,
  isLast,
  downloading,
  onDownload,
}: Readonly<{ tx: Transaction; isLast?: boolean; downloading?: boolean; onDownload: () => void }>) {
  const pen = penaltyView(tx);
  const meta = pen ? { ...txTypeMeta(tx.type), label: pen.label, credit: pen.credit } : txTypeMeta(tx.type);
  const tone = txStatusTone(tx.status);
  const showReceipt = canDownloadReceipt(tx.status) || !!pen;
  return (
    <View style={[styles.txRow, !isLast && styles.txDivider]}>
      <View style={[styles.txIcon, { backgroundColor: meta.credit ? "rgba(34,195,93,0.10)" : "rgba(255,122,38,0.10)" }]}>
        <Ionicons name={meta.icon} size={16} color={meta.credit ? colors.safe : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        {/* Two lines before an ellipsis: "Refu…" / "Delive…" at 320pt + larger text. */}
        <Text style={styles.txLabel} numberOfLines={2}>{meta.label}</Text>
        <Text style={styles.txSub} numberOfLines={1}>
          {formatTxDate(tx.created_at)}
          {tx.booking_id ? ` · #${tx.booking_id.slice(0, 8)}` : ""}
        </Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: meta.credit ? colors.safe : colors.text }]}>
          {formatTxAmount(tx.amount, meta.credit, tx.currency)}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.statusText, { color: tone.fg }]} numberOfLines={1} maxFontSizeMultiplier={COMPACT_CONTROL_MAX_FONT_SCALE}>{pen ? pen.status : txStatusLabel(tx.status)}</Text>
        </View>
      </View>
      {showReceipt ? (
        <Pressable
          onPress={onDownload}
          disabled={downloading}
          hitSlop={8}
          style={styles.receiptBtn}
          accessibilityRole="button"
          accessibilityLabel="Download receipt"
        >
          {downloading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="download-outline" size={18} color={colors.primary} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 28 },
  headerRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 16, gap: 12, minHeight: 34 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800", lineHeight: 28 },

  centerCard: { borderRadius: 16, alignItems: "center", paddingVertical: 40 },
  panel: { borderRadius: 16, alignItems: "center", paddingVertical: 28, paddingHorizontal: 18, gap: 8 },
  panelTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 6 },
  panelBody: { color: colors.mutedText, fontSize: 13, textAlign: "center", maxWidth: 280, lineHeight: 18 },
  panelButton: { marginTop: 8, alignSelf: "stretch" },

  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 3,
  },
  summaryValue: { fontSize: 16, fontWeight: "800" },
  summaryValueSmall: { fontSize: 13 },
  summaryLabel: { color: colors.mutedText, fontSize: 10, fontWeight: "700", letterSpacing: 0.3, textAlign: "center" },

  payoutNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(245,159,10,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,159,10,0.24)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 18,
  },
  payoutNoteStrong: { color: colors.text, fontSize: 14, fontWeight: "800", marginBottom: 3 },
  payoutNoteText: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  payoutNoteLink: { color: colors.warning, fontSize: 13, fontWeight: "800", marginTop: 6 },

  listCard: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 0 },
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  txDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  txIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  txLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  txSub: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
  txRight: { alignItems: "flex-end", gap: 4 },
  txAmount: { fontSize: 15, fontWeight: "800" },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "capitalize" },
  receiptBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginLeft: 2 },

  loadMore: { borderRadius: 14, minHeight: 46, marginTop: 14 },
});

export default TransactionsScreen;
