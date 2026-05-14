import { useCallback, useMemo, useState } from "react";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { createParcelDraft, normalizeFee } from "@/features/parcels/model/createParcel";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import type { PaymentMethod } from "@/store/types";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "ReviewPayTab">,
  NativeStackNavigationProp<RootStackParamList>
>;
type ReviewPayRoute = RouteProp<MainTabParamList, "ReviewPayTab">;

const FALLBACK_PAYMENT_METHODS: readonly PaymentMethod[] = [
  { id: "review-pay-visa", brand: "Visa", last4: "4242", expiry: "12/27", isDefault: true },
  { id: "review-pay-mastercard", brand: "Mastercard", last4: "8888", expiry: "06/28", isDefault: false },
];

function parseFeeValue(fee: string): number {
  const numeric = Number.parseFloat(fee.replaceAll(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function ReviewPayScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<ReviewPayRoute>();
  const { showLiveData, walletBalance, paymentMethods, addParcel, adjustWalletBalance } = useAppStore(
    useShallow((s) => ({
      showLiveData: s.showLiveData,
      walletBalance: s.walletBalance,
      paymentMethods: s.paymentMethods,
      addParcel: s.addParcel,
      adjustWalletBalance: s.adjustWalletBalance,
    }))
  );

  const hasData = showLiveData;
  const [selectedMethodId, setSelectedMethodId] = useState<string>("wallet-outline");
  const deliveryFee = hasData ? parseFeeValue(params.draft.fee) : 30;
  const platformFee = hasData ? Number((deliveryFee * 0.1).toFixed(2)) : 3;
  const total = Number((deliveryFee + platformFee).toFixed(2));
  const availableBalance = hasData ? walletBalance : 0;
  const isWalletSelected = selectedMethodId === "wallet-outline";
  const canPay = hasData && (!isWalletSelected || availableBalance >= total);
  let visibleMethods: PaymentMethod[] = [];
  if (hasData) {
    visibleMethods = paymentMethods.length > 0 ? paymentMethods : [...FALLBACK_PAYMENT_METHODS];
  }

  const feeLabel = useMemo(() => `$${deliveryFee.toFixed(2)}`, [deliveryFee]);
  const platformFeeLabel = useMemo(() => `$${platformFee.toFixed(2)}`, [platformFee]);
  const totalLabel = useMemo(() => `$${total.toFixed(2)}`, [total]);
  const balanceLabel = useMemo(() => `$${availableBalance.toFixed(2)} available`, [availableBalance]);
  const routeLabel = hasData ? `${params.draft.from.trim()} \u2192 ${params.draft.to.trim()}` : "\u2014 \u2192 \u2014";
  const categoryLabel = hasData ? params.draft.category.trim() : "Electronics";
  const weightLabel = hasData ? params.draft.weight.trim() : "\u2014";
  const buttonLabel = canPay ? `Pay ${totalLabel}` : "Insufficient Balance";
  const isMethodSelected = useCallback((methodId: string) => selectedMethodId === methodId, [selectedMethodId]);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const handlePay = useCallback(() => {
    if (!canPay) return;
    addParcel(
      createParcelDraft({
        from: params.draft.from,
        to: params.draft.to,
        weight: params.draft.weight,
        fee: normalizeFee(params.draft.fee),
        category: params.draft.category,
        sender: "Alex Johnson",
      })
    );
    if (isWalletSelected) {
      adjustWalletBalance(-total);
    }
    navigation.navigate("PaymentSuccessTab", { amount: totalLabel });
  }, [addParcel, adjustWalletBalance, canPay, isWalletSelected, navigation, params.draft, totalLabel]);

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Review & Pay</Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="cube-outline" size={15} color={colors.primary} />
          <Text style={styles.sectionTitle}>Parcel Summary</Text>
        </View>
        <Row label="Route" value={routeLabel} />
        <Row label="Category" value={categoryLabel} valueStyle={styles.strongValue} />
        <Row label="Weight" value={weightLabel} />
      </Card>

      <Card style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="cash-outline" size={15} color={colors.primary} />
          <Text style={styles.sectionTitle}>Fee Breakdown</Text>
        </View>
        <Row label="Delivery Fee" value={feeLabel} valueStyle={styles.strongValue} />
        <Row label="Platform Fee (10%)" value={platformFeeLabel} valueStyle={styles.strongValue} />
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{totalLabel}</Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.paymentTitle}>Payment Method</Text>
        <Pressable
          style={[styles.walletMethod, isWalletSelected && styles.selectedMethodCard]}
          onPress={() => setSelectedMethodId("wallet-outline")}
          accessibilityRole="button"
          accessibilityLabel="Select wallet balance"
          disabled={!hasData}
        >
          <View style={styles.methodLeft}>
            <Ionicons name="wallet-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.methodTitle}>Wallet Balance</Text>
              <Text style={styles.methodSub}>{balanceLabel}</Text>
            </View>
          </View>
          <Ionicons name={isWalletSelected ? "checkmark-circle" : "ellipse"} size={20} color={colors.primary} />
        </Pressable>
        {visibleMethods.map((method) => (
          <Pressable
            key={method.id}
            style={[styles.methodRow, isMethodSelected(method.id) && styles.selectedMethodCard]}
            onPress={() => setSelectedMethodId(method.id)}
            accessibilityRole="button"
            accessibilityLabel={`Select ${method.brand} ending in ${method.last4}`}
            disabled={!hasData}
          >
            <Ionicons name="card-outline" size={18} color={colors.mutedText} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>
                {method.brand} •••• {method.last4}
              </Text>
              <Text style={styles.cardSub}>Expires {method.expiry}</Text>
            </View>
            <Ionicons name={isMethodSelected(method.id) ? "checkmark-circle" : "ellipse"} size={20} color={colors.primary} />
          </Pressable>
        ))}
      </Card>

      <View style={styles.notice}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.warning} />
        <Text style={styles.noticeText}>Payment will be held in escrow and released to the carrier only after you confirm delivery.</Text>
      </View>

      <AppButton label={buttonLabel} disabled={!canPay} onPress={handlePay} style={styles.payButton} />
    </Screen>
  );
}

function Row({
  label,
  value,
  valueStyle,
}: Readonly<{
  label: string;
  value: string;
  valueStyle?: object;
}>) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueStyle]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 16,
    paddingBottom: 20,
  },
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
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  card: {
    borderRadius: 16,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  rowLabel: {
    color: colors.mutedText,
    fontSize: 16,
    lineHeight: 24,
  },
  rowValue: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  strongValue: {
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginTop: 2,
    marginBottom: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
  },
  totalValue: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  paymentTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
    lineHeight: 22,
  },
  walletMethod: {
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F7F8FA",
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  methodLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  methodTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  methodSub: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  methodRow: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
  },
  selectedMethodCard: {
    borderWidth: 1.5,
    borderColor: "#F1B8AA",
    backgroundColor: "#FDF0EC",
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  cardSub: {
    color: colors.mutedText,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  notice: {
    backgroundColor: "#FFF5E6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F6E8CB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 2,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  noticeText: {
    flex: 1,
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  payButton: {
    borderRadius: 12,
    minHeight: 48,
  },
});
