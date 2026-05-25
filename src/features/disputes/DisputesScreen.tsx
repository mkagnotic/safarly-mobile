import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useShallow } from "zustand/react/shallow";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";
import type { Dispute } from "@/types/models";

const WAIVER_MARKER = "[Return-eligibility waiver request]";

function isReturnWaiverRequest(dispute: Dispute): boolean {
  return (
    dispute.description?.trim().startsWith(WAIVER_MARKER) === true &&
    dispute.status !== "resolved"
  );
}

function disputeStatusIcon(status: string): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case "open": return "alert-circle";
    case "investigating": return "search-outline";
    case "resolved": return "checkmark-circle";
    case "escalated": return "arrow-up-circle";
    default: return "help-circle-outline";
  }
}

function disputeStatusColor(status: string) {
  switch (status) {
    case "open": return colors.warning;
    case "investigating": return colors.primary;
    case "resolved": return colors.safe;
    case "escalated": return colors.danger;
    default: return colors.mutedText;
  }
}

export function DisputesScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { disputes, showLiveData } = useAppStore(
    useShallow((s) => ({ disputes: s.disputes, showLiveData: s.showLiveData }))
  );
  const [waiverPendingId, setWaiverPendingId] = useState<string | null>(null);
  type BannerVariant = "success" | "error" | "info" | "warning";
  const [actionBanner, setActionBanner] = useState<
    { variant: BannerVariant; title?: string; message?: string } | null
  >(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visible = showLiveData ? disputes : [];

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = null;
    setActionBanner(null);
  }, []);

  useEffect(
    () => () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    },
    [],
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  const handleConfirmWaiver = useCallback(async (disputeId: string) => {
    setWaiverPendingId(disputeId);
    // PR1 builds the UI; the dedicated `/dispute/:id/confirm-return-waiver`
    // call lands in PR2 alongside Idempotency-Key support.
    setTimeout(() => {
      setWaiverPendingId(null);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      setActionBanner({
        variant: "info",
        title: "Coming next update",
        message: "Waiver confirmation is shipping in the next release.",
      });
      bannerTimerRef.current = setTimeout(() => setActionBanner(null), 4000);
    }, 300);
  }, []);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Disputes</Text>
      </View>

      {actionBanner ? (
        <View style={styles.bannerSlot}>
          <FormBanner
            variant={actionBanner.variant}
            title={actionBanner.title ?? null}
            message={actionBanner.message ?? null}
            onDismiss={dismissBanner}
          />
        </View>
      ) : null}

      {visible.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="shield-checkmark-outline" size={48} color={colors.safe} />
          <Text style={styles.emptyTitle}>No disputes</Text>
          <Text style={styles.emptySubtitle}>All your deliveries are in good standing</Text>
        </View>
      ) : (
        visible.map((dispute) => {
          const isWaiver = isReturnWaiverRequest(dispute);
          return (
            <Pressable
              key={dispute.id}
              onPress={() => navigation.navigate("DisputeDetailsTab" as any, { disputeId: dispute.id })}
            >
              <Card style={styles.disputeCard}>
                <View style={styles.disputeTop}>
                  <View style={styles.disputeIdRow}>
                    <Ionicons
                      name={disputeStatusIcon(dispute.status)}
                      size={18}
                      color={disputeStatusColor(dispute.status)}
                    />
                    <Text style={styles.disputeId}>{dispute.id}</Text>
                  </View>
                  <Text style={[styles.disputeStatus, { color: disputeStatusColor(dispute.status) }]}>
                    {dispute.status}
                  </Text>
                </View>
                <Text style={styles.disputeCategory}>{dispute.category.replace("_", " ")}</Text>
                <Text style={styles.disputeDesc} numberOfLines={isWaiver ? 4 : 2}>
                  {dispute.description}
                </Text>
                <Text style={styles.disputeDate}>{dispute.date}</Text>

                {isWaiver ? (
                  <View style={styles.waiverBlock}>
                    <View style={styles.waiverBlockHeader}>
                      <Ionicons name="shield-checkmark" size={14} color={colors.safe} />
                      <Text style={styles.waiverBlockTitle}>Waiver requested</Text>
                    </View>
                    <Text style={styles.waiverBlockBody}>
                      The carrier returned this parcel to its merchant. Confirming the waiver
                      refunds the cash penalty back to the carrier; the strike on their record
                      stays in place.
                    </Text>
                    <Pressable
                      onPress={() => void handleConfirmWaiver(dispute.id)}
                      disabled={waiverPendingId === dispute.id}
                      style={[
                        styles.waiverButton,
                        waiverPendingId === dispute.id && styles.waiverButtonPending,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Confirm return waiver"
                    >
                      {waiverPendingId === dispute.id ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={14} color={colors.white} />
                          <Text style={styles.waiverButtonText}>Confirm waiver</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 20, gap: 12 },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  bannerSlot: { marginBottom: 12 },
  disputeCard: { marginBottom: 12, paddingVertical: 14, paddingHorizontal: 14 },
  disputeTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  disputeIdRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  disputeId: { color: colors.mutedText, fontSize: 12, fontWeight: "700" },
  disputeStatus: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  disputeCategory: { color: colors.text, fontSize: 16, fontWeight: "700", textTransform: "capitalize", marginBottom: 4 },
  disputeDesc: { color: colors.mutedText, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  disputeDate: { color: colors.subtleText, fontSize: 12 },
  emptyWrap: { alignItems: "center", paddingVertical: 64, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  emptySubtitle: { color: colors.subtleText, fontSize: 14 },

  waiverBlock: {
    marginTop: 12,
    backgroundColor: "rgba(34,195,93,0.08)",
    borderColor: "rgba(34,195,93,0.30)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  waiverBlockHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  waiverBlockTitle: {
    color: colors.safe,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  waiverBlockBody: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  waiverButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.safe,
  },
  waiverButtonPending: { opacity: 0.7 },
  waiverButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
});
