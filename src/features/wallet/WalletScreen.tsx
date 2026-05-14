import { useCallback, useRef, useState } from "react";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Animated, Easing, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { showAppAlert, showToast } from "@/feedback/appFeedback";
import { useShallow } from "zustand/react/shallow";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import type { AppLanguage } from "@/i18n/translations";
import { t } from "@/i18n/translations";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import type { PaymentMethod } from "@/store/types";
import { colors } from "@/theme/colors";
import { shadowCard, shadowHero, shadowSoft } from "@/theme/elevation";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "WalletTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

const HERO_BG = colors.brandDark;
const HERO_MUTED = colors.onBrandMuted;
const LABEL_CAPS = colors.mutedText;
const TITLE_COLOR = colors.text;

const WALLET_ESCROW_LIVE = 100;
const WALLET_EARNED_LIVE = 99;

type TxKind = "payout" | "escrow" | "refund";
type TxStatus = "completed" | "held" | "refunded";

type TxRow = { id: string; kind: TxKind; date: string; amount: number; status: TxStatus };
const QUICK_AMOUNTS = [25, 50, 100] as const;

const PAYMENT_METHODS_LIVE: readonly PaymentMethod[] = [
  { id: "1", brand: "Visa", last4: "4242", expiry: "12/2027", isDefault: true },
  { id: "2", brand: "Mastercard", last4: "8888", expiry: "08/2026", isDefault: false },
];

const TRANSACTIONS_LIVE: readonly TxRow[] = [
  { id: "1", kind: "payout", date: "Mar 18, 2026", amount: 58, status: "completed" },
  { id: "2", kind: "escrow", date: "Mar 15, 2026", amount: 24.5, status: "held" },
  { id: "3", kind: "refund", date: "Mar 10, 2026", amount: 12, status: "refunded" },
];

function txLabel(language: AppLanguage, kind: TxKind): string {
  switch (kind) {
    case "payout":
      return t(language, "wallet.txPayout");
    case "escrow":
      return t(language, "wallet.txEscrowHold");
    case "refund":
      return t(language, "wallet.txRefund");
    default:
      return "";
  }
}

function statusLabel(language: AppLanguage, status: TxStatus): string {
  switch (status) {
    case "completed":
      return t(language, "wallet.statusCompleted");
    case "held":
      return t(language, "wallet.statusHeld");
    case "refunded":
      return t(language, "wallet.statusRefunded");
    default:
      return "";
  }
}

function TxIcon({ kind }: Readonly<{ kind: TxKind }>) {
  const payoutIconStyle = Platform.OS === "ios" ? styles.iconDownLeftIos : styles.iconDownLeft;
  const refundIconStyle = Platform.OS === "ios" ? styles.iconUpRightIos : styles.iconUpRight;
  switch (kind) {
    case "payout":
      return <Ionicons name="arrow-down" size={18} color={colors.safe} style={payoutIconStyle} />;
    case "escrow":
      return <Ionicons name="cash-outline" size={18} color={colors.primary} />;
    case "refund":
      return <Ionicons name="arrow-up" size={18} color={colors.danger} style={refundIconStyle} />;
    default:
      return null;
  }
}

function iconBg(kind: TxKind): string {
  switch (kind) {
    case "payout":
      return "#EAF8F0";
    case "escrow":
      return "#FFF1EC";
    case "refund":
      return "#FEE8E8";
    default:
      return colors.accent;
  }
}

function statusColor(status: TxStatus): string {
  switch (status) {
    case "completed":
      return colors.safe;
    case "held":
      return colors.warning;
    case "refunded":
      return colors.mutedText;
    default:
      return colors.mutedText;
  }
}

function sanitizeMoneyInput(raw: string): string {
  const digitsAndDot = raw.replaceAll(/[^0-9.]/g, "");
  const [whole, ...decimalChunks] = digitsAndDot.split(".");
  const decimals = decimalChunks.join("").slice(0, 2);
  return decimalChunks.length > 0 ? `${whole}.${decimals}` : whole;
}

function parseAmount(raw: string): number {
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function TransactionCard({ item, language }: Readonly<{ item: TxRow; language: AppLanguage }>) {
  const refund = item.kind === "refund";
  const amountStr = `${refund ? "-" : ""}$${item.amount.toFixed(2)}`;
  return (
    <View style={styles.txCard}>
      <View style={[styles.txIconBox, { backgroundColor: iconBg(item.kind) }]}>
        <TxIcon kind={item.kind} />
      </View>
      <View style={styles.txMiddle}>
        <Text style={styles.txTitle}>{txLabel(language, item.kind)}</Text>
        <Text style={styles.txDate}>{item.date}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, refund && styles.txAmountRefund]}>{amountStr}</Text>
        <Text style={[styles.txStatus, { color: statusColor(item.status) }]}>{statusLabel(language, item.status).toUpperCase()}</Text>
      </View>
    </View>
  );
}

export function WalletScreen() {
  const navigation = useNavigation<Nav>();
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [amountToAdd, setAmountToAdd] = useState("0.00");
  const addMoneyAnim = useRef(new Animated.Value(0)).current;
  const { showLiveData, walletBalance, language, paymentMethodsStore, adjustWalletBalance } = useAppStore(
    useShallow((s) => ({
      showLiveData: s.showLiveData,
      walletBalance: s.walletBalance,
      language: s.language,
      paymentMethodsStore: s.paymentMethods,
      adjustWalletBalance: s.adjustWalletBalance,
    }))
  );

  const hasData = showLiveData;
  // Always reflect wallet operations immediately on this screen.
  const balanceStr = walletBalance.toFixed(2);
  const escrowStr = hasData ? WALLET_ESCROW_LIVE.toFixed(2) : "0.00";
  const earnedStr = hasData ? WALLET_EARNED_LIVE.toFixed(2) : "0.00";
  const paymentMethods = paymentMethodsStore.length > 0 ? paymentMethodsStore : [];
  const fallbackPaymentMethods = hasData && paymentMethods.length === 0 ? PAYMENT_METHODS_LIVE : paymentMethods;
  const transactions = hasData ? TRANSACTIONS_LIVE : [];

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const toggleAddMoney = useCallback(() => {
    const nextOpen = !addMoneyOpen;
    setAddMoneyOpen(nextOpen);
    Animated.timing(addMoneyAnim, {
      toValue: nextOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [addMoneyAnim, addMoneyOpen]);

  const closeAddMoneyPanel = useCallback(() => {
    setAddMoneyOpen(false);
    Animated.timing(addMoneyAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [addMoneyAnim]);

  const selectAmount = useCallback((value: number) => {
    setAmountToAdd(value.toFixed(2));
  }, []);

  const handleAmountChange = useCallback((value: string) => {
    setAmountToAdd(sanitizeMoneyInput(value));
  }, []);

  const handleAddMoney = useCallback(() => {
    const delta = parseAmount(amountToAdd);
    if (delta <= 0) return;
    adjustWalletBalance(delta);
    setAmountToAdd("0.00");
    closeAddMoneyPanel();
  }, [adjustWalletBalance, amountToAdd, closeAddMoneyPanel]);

  const withdrawAmount = useCallback(
    (delta: number) => {
    if (delta <= 0) return;
    if (delta > walletBalance) {
      showToast({
        title: "Insufficient balance",
        message: "Enter an amount less than or equal to your available balance.",
        variant: "error",
      });
      return;
    }
    adjustWalletBalance(-delta);
    setAmountToAdd("0.00");
    },
    [adjustWalletBalance, walletBalance]
  );

  const handleWithdraw = useCallback(() => {
    const typedAmount = parseAmount(amountToAdd);
    showAppAlert({
      title: "Withdraw",
      message: "Select an amount to withdraw.",
      actions: [
        { text: "$25", onPress: () => withdrawAmount(25) },
        { text: "$50", onPress: () => withdrawAmount(50) },
        { text: "$100", onPress: () => withdrawAmount(100) },
        ...(typedAmount > 0
          ? [{ text: `Use $${typedAmount.toFixed(2)}`, onPress: () => withdrawAmount(typedAmount) }]
          : []),
        { text: "Cancel", style: "cancel" },
      ],
    });
  }, [amountToAdd, withdrawAmount]);

  const addMoneyHeight = addMoneyAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 160],
  });
  const addMoneyOpacity = addMoneyAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const addMoneyTranslate = addMoneyAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
  });

  return (
    <Screen contentContainerStyle={styles.screenContent}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>{t(language, "stack.wallet")}</Text>
      </View>

      <View style={[styles.balanceCard, shadowHero()]}>
        <Text style={styles.balanceLabel}>{t(language, "wallet.availableBalance").toUpperCase()}</Text>
        <Text style={styles.balanceAmount}>${balanceStr}</Text>
        <View style={styles.heroActions}>
          <Pressable style={styles.addMoneyBtn} onPress={toggleAddMoney} accessibilityRole="button" accessibilityLabel={t(language, "wallet.addMoney")}>
            <Ionicons name="add" size={22} color={colors.white} />
            <Text style={styles.addMoneyBtnText}>{t(language, "wallet.addMoney")}</Text>
          </Pressable>
          <Pressable style={styles.withdrawBtn} onPress={handleWithdraw} accessibilityRole="button" accessibilityLabel={t(language, "wallet.withdraw")}>
            <Ionicons name="arrow-forward" size={18} color={colors.white} style={styles.withdrawIcon} />
            <Text style={styles.withdrawBtnText}>{t(language, "wallet.withdraw")}</Text>
          </Pressable>
        </View>
      </View>

      <Animated.View
        pointerEvents={addMoneyOpen ? "auto" : "none"}
        style={[styles.addMoneyWrap, { maxHeight: addMoneyHeight, opacity: addMoneyOpacity, transform: [{ translateY: addMoneyTranslate }] }]}
      >
        <View style={[styles.addMoneyCard, shadowCard()]}>
          <Text style={styles.addMoneyTitle}>AMOUNT TO ADD</Text>
          <View style={styles.addMoneyInputRow}>
            <View style={styles.addMoneyInputWrap}>
              <Text style={styles.amountPrefix}>$</Text>
              <TextInput
                value={amountToAdd}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                style={styles.addMoneyInput}
                placeholder="0.00"
                placeholderTextColor={colors.mutedText}
              />
            </View>
            <Pressable style={styles.addMoneySubmit} onPress={handleAddMoney} accessibilityRole="button">
              <Text style={styles.addMoneySubmitText}>Add</Text>
            </Pressable>
          </View>
          <View style={styles.quickAmountRow}>
            {QUICK_AMOUNTS.map((value) => (
              <Pressable key={value} style={styles.quickAmountChip} onPress={() => selectAmount(value)} accessibilityRole="button">
                <Text style={styles.quickAmountText}>${value}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Animated.View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, shadowCard()]}>
          <View style={styles.statIconRow}>
            <Ionicons name="time-outline" size={22} color={colors.warning} />
          </View>
          <Text style={styles.statValue}>${escrowStr}</Text>
          <Text style={styles.statCaption}>{t(language, "wallet.inEscrow").toUpperCase()}</Text>
        </View>
        <View style={[styles.statCard, shadowCard()]}>
          <View style={styles.statIconRow}>
            <Ionicons name="trending-up-outline" size={22} color={colors.safe} />
          </View>
          <Text style={styles.statValue}>${earnedStr}</Text>
          <Text style={styles.statCaption}>{t(language, "wallet.totalEarned").toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>{t(language, "wallet.paymentMethods")}</Text>
        <Pressable onPress={() => navigation.navigate("AddCardTab")} accessibilityRole="button">
          <Text style={styles.sectionAction}>{t(language, "wallet.addCard")}</Text>
        </Pressable>
      </View>

      {fallbackPaymentMethods.length === 0 ? (
        <View style={[styles.payEmptyBox, shadowCard()]}>
          <Ionicons name="card-outline" size={40} color={colors.mutedText} />
          <Text style={styles.payEmptyText}>{t(language, "wallet.noPaymentMethods")}</Text>
          <Pressable style={styles.payEmptyCta} onPress={() => navigation.navigate("AddCardTab")} accessibilityRole="button">
            <Text style={styles.payEmptyCtaText}>{t(language, "wallet.addACard")}</Text>
          </Pressable>
        </View>
      ) : (
        fallbackPaymentMethods.map((pm) => (
          <View key={pm.id} style={[styles.payRow, shadowCard()]}>
            <View style={styles.payIcon}>
              <Ionicons name="card-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.payBody}>
              <Text style={styles.payTitle}>
                {pm.brand} •••• {pm.last4}
              </Text>
              <Text style={styles.paySub}>
                Exp. {pm.expiry}
              </Text>
            </View>
            {pm.isDefault ? (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>{t(language, "wallet.default").toUpperCase()}</Text>
              </View>
            ) : null}
          </View>
        ))
      )}

      <View style={[styles.sectionRow, styles.txSectionHeader]}>
        <Text style={styles.sectionTitle}>{t(language, "wallet.recentTransactions")}</Text>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.txEmpty}>
          <View style={styles.txEmptyCircle}>
            <Ionicons name="cash-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.txEmptyTitle}>{t(language, "wallet.noTransactionsYet")}</Text>
          <Text style={styles.txEmptySubtitle}>Your payment history will appear here.</Text>
        </View>
      ) : (
        transactions.map((row) => <TransactionCard key={row.id} item={row} language={language} />)
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
    ...shadowSoft(),
  },
  screenTitle: {
    color: TITLE_COLOR,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  balanceCard: {
    backgroundColor: HERO_BG,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: 18,
  },
  balanceLabel: {
    color: HERO_MUTED,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  balanceAmount: {
    color: colors.white,
    fontSize: 36,
    fontWeight: "800",
    marginTop: 6,
    marginBottom: 18,
  },
  heroActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  addMoneyBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  addMoneyBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  withdrawBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  withdrawIcon: {
    transform: [{ rotate: "-45deg" }],
  },
  withdrawBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  addMoneyWrap: {
    overflow: "hidden",
    marginBottom: 16,
  },
  addMoneyCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  addMoneyTitle: {
    color: LABEL_CAPS,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 10,
  },
  addMoneyInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  addMoneyInputWrap: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  amountPrefix: {
    color: colors.mutedText,
    fontSize: 18,
    lineHeight: 24,
    marginRight: 2,
  },
  addMoneyInput: {
    flex: 1,
    color: colors.mutedText,
    fontSize: 26,
    fontWeight: "700",
    paddingVertical: 0,
  },
  addMoneySubmit: {
    minWidth: 72,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  addMoneySubmitText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
  },
  quickAmountRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickAmountChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  quickAmountText: {
    color: colors.mutedText,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statIconRow: { marginBottom: 10, alignItems: "center", justifyContent: "center" },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
    textAlign: "center",
  },
  statCaption: {
    color: LABEL_CAPS,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  txSectionHeader: {
    marginTop: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 20,
    lineHeight: 28,
  },
  sectionAction: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 14,
  },
  payEmptyBox: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  payEmptyText: {
    color: colors.mutedText,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 18,
    textAlign: "center",
  },
  payEmptyCta: {
    minWidth: 200,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  payEmptyCtaText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  payIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  payBody: { flex: 1 },
  payTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  paySub: { color: colors.mutedText, fontSize: 13, marginTop: 2, fontWeight: "500" },
  defaultBadge: {
    backgroundColor: "#E8F8EE",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  defaultBadgeText: {
    color: colors.safe,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  txEmpty: {
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 8,
  },
  txEmptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFF1EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  txEmptyTitle: {
    color: TITLE_COLOR,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  txEmptySubtitle: {
    marginTop: 6,
    color: colors.subtleText,
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
  },
  txCard: {
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
  txIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconDownLeft: {
    transform: [{ rotate: "-135deg" }],
  },
  iconDownLeftIos: {
    transform: [{ rotate: "-135deg" }],
  },
  iconUpRight: {
    transform: [{ rotate: "-135deg" }],
  },
  iconUpRightIos: {
    transform: [{ rotate: "-135deg" }],
  },
  txMiddle: { flex: 1 },
  txTitle: { color: TITLE_COLOR, fontSize: 16, fontWeight: "800" },
  txDate: { color: colors.mutedText, fontSize: 12, marginTop: 2, fontWeight: "500" },
  txRight: { alignItems: "flex-end" },
  txAmount: { color: TITLE_COLOR, fontSize: 16, fontWeight: "800" },
  txAmountRefund: { color: colors.danger },
  txStatus: {
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: 0.4,
  },
});
