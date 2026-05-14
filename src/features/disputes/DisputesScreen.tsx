import { useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useShallow } from "zustand/react/shallow";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

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
  const visible = showLiveData ? disputes : [];

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Disputes</Text>
      </View>

      {visible.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="shield-checkmark-outline" size={48} color={colors.safe} />
          <Text style={styles.emptyTitle}>No disputes</Text>
          <Text style={styles.emptySubtitle}>All your deliveries are in good standing</Text>
        </View>
      ) : (
        visible.map((dispute) => (
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
              <Text style={styles.disputeDesc} numberOfLines={2}>{dispute.description}</Text>
              <Text style={styles.disputeDate}>{dispute.date}</Text>
            </Card>
          </Pressable>
        ))
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
});
