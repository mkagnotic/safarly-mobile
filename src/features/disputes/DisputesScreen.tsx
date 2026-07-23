import { useCallback, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import {
  categoryLabel,
  statusColor,
  statusIcon,
  statusTint,
} from "@/features/disputes/disputeConfig";
import { useAuth } from "@/context/AuthContext";
import { useMyDisputes } from "@/hooks/api/useMyDisputes";
import { MainTabParamList } from "@/navigation/types";
import { disputesApi, getErrorMessage, type Dispute } from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "DisputesTab">;
type BannerVariant = "success" | "error" | "info" | "warning";
interface ActionBanner {
  variant: BannerVariant;
  title?: string;
  message?: string;
}

const WAIVER_MARKER = "[Return-eligibility waiver request]";

/** Evidence can be an image or a PDF (web + backend now accept both). */
function isPdfName(value: string | null | undefined): boolean {
  return typeof value === "string" && value.toLowerCase().split("?")[0].endsWith(".pdf");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function DisputesScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { disputes, loading, loadingMore, hasMore, error, refetch, loadMore } = useMyDisputes();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [banner, setBanner] = useState<ActionBanner | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = useCallback((b: ActionBanner, ms = 5000) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner(b);
    bannerTimer.current = setTimeout(() => setBanner(null), ms);
  }, []);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  const handleToggle = useCallback(
    (id: string) => setExpandedId((prev) => (prev === id ? null : id)),
    [],
  );

  const goFile = useCallback(() => navigation.navigate("FileDisputeTab"), [navigation]);

  const keyExtractor = useCallback((d: Dispute) => d.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Dispute>) => (
      <DisputeCard
        dispute={item}
        userId={userId}
        expanded={expandedId === item.id}
        onToggle={() => handleToggle(item.id)}
        onPreviewImage={setPreviewUri}
        onRefetch={refetch}
        onBanner={showBanner}
      />
    ),
    [userId, expandedId, handleToggle, refetch, showBanner],
  );

  const listEmpty = useMemo(() => {
    if (loading && disputes.length === 0) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centeredText}>Loading disputes…</Text>
        </View>
      );
    }
    if (error && disputes.length === 0) {
      return (
        <Card style={styles.errorCard}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
          <Text style={styles.errorTitle}>Failed to load disputes</Text>
          <Text style={styles.errorBody}>{getErrorMessage(error)}</Text>
          <Pressable onPress={() => void refetch()} style={styles.retryButton} accessibilityRole="button">
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </Card>
      );
    }
    return (
      <Card style={styles.emptyCard}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="shield-checkmark-outline" size={28} color={colors.safe} />
        </View>
        <Text style={styles.emptyTitle}>No disputes</Text>
        <Text style={styles.emptySubtitle}>You haven't filed any disputes yet.</Text>
        <Pressable onPress={goFile} style={styles.emptyActionButton} accessibilityRole="button">
          <Text style={styles.emptyActionText}>File a Dispute</Text>
        </Pressable>
      </Card>
    );
  }, [loading, error, disputes.length, refetch, goFile]);

  return (
    <Screen scroll={false}>
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <Pressable onPress={handleBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Disputes</Text>
          <Pressable onPress={goFile} style={styles.fileButton} accessibilityRole="button" accessibilityLabel="File a dispute">
            <Text style={styles.fileButtonText}>File</Text>
          </Pressable>
        </View>

        {banner ? (
          <View style={styles.bannerSlot}>
            <FormBanner
              variant={banner.variant}
              title={banner.title ?? null}
              message={banner.message ?? null}
              onDismiss={() => setBanner(null)}
            />
          </View>
        ) : null}

        <FlatList
          data={disputes}
          style={styles.list}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          onEndReached={() => {
            if (hasMore) void loadMore();
          }}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={disputes.length === 0 ? styles.listContentEmpty : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading && disputes.length > 0} onRefresh={refetch} tintColor={colors.primary} />
          }
        />
      </View>

      {/* Evidence lightbox */}
      <Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <Pressable style={styles.lightbox} onPress={() => setPreviewUri(null)} accessibilityRole="button" accessibilityLabel="Close image">
          {previewUri ? <Image source={{ uri: previewUri }} style={styles.lightboxImage} resizeMode="contain" /> : null}
          <View style={styles.lightboxClose}>
            <Ionicons name="close" size={22} color={colors.white} />
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

// ───────────────────────── Dispute card ─────────────────────────

interface DisputeCardProps {
  dispute: Dispute;
  userId: string;
  expanded: boolean;
  onToggle: () => void;
  onPreviewImage: (url: string) => void;
  onRefetch: () => Promise<void>;
  onBanner: (b: ActionBanner, ms?: number) => void;
}

function DisputeCard({
  dispute,
  userId,
  expanded,
  onToggle,
  onPreviewImage,
  onRefetch,
  onBanner,
}: Readonly<DisputeCardProps>) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [waiving, setWaiving] = useState(false);

  const isResolved = dispute.status === "resolved";
  // Web parity: the sender can grant the waiver when the counterparty filed a
  // return-eligibility waiver request that isn't resolved yet.
  const isWaiverRequest =
    dispute.description?.trim().startsWith(WAIVER_MARKER) === true &&
    !isResolved &&
    dispute.filed_by !== userId;

  const messages = dispute.messages ?? [];
  const evidence = dispute.evidence_files ?? [];
  const color = statusColor(dispute.status);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await disputesApi.addMessage(dispute.id, text);
      setDraft("");
      await onRefetch();
    } catch (err) {
      onBanner({ variant: "error", title: "Couldn't send message", message: getErrorMessage(err) });
    } finally {
      setSending(false);
    }
  }, [draft, sending, dispute.id, onRefetch, onBanner]);

  const confirmWaiver = useCallback(async () => {
    if (waiving) return;
    setWaiving(true);
    try {
      const res = await disputesApi.confirmReturnWaiver(dispute.id);
      const refunded = res.data?.refunded_amount;
      onBanner({
        variant: "success",
        title: "Penalty waived — carrier refunded",
        message:
          typeof refunded === "number"
            ? `$${refunded} returned to the carrier. The strike record stays.`
            : "The cash penalty was waived; the strike record stays.",
      });
      await onRefetch();
    } catch (err) {
      onBanner({ variant: "error", title: "Couldn't confirm waiver", message: getErrorMessage(err) });
    } finally {
      setWaiving(false);
    }
  }, [waiving, dispute.id, onRefetch, onBanner]);

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={onToggle}
        style={styles.summary}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? "Collapse" : "Expand"} dispute`}
      >
        <View style={styles.summaryTop}>
          <View style={[styles.statusBadge, { backgroundColor: statusTint(dispute.status) }]}>
            <Ionicons name={statusIcon(dispute.status)} size={12} color={color} />
            <Text style={[styles.statusText, { color }]}>{dispute.status}</Text>
          </View>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText} numberOfLines={1}>
              {categoryLabel(dispute.category)}
            </Text>
          </View>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedText} />
        </View>
        <View style={styles.summaryMeta}>
          <Ionicons name="cube-outline" size={12} color={colors.subtleText} />
          <Text style={styles.metaText}>Booking #{dispute.booking_id.slice(0, 8)}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Ionicons name="calendar-outline" size={12} color={colors.subtleText} />
          <Text style={styles.metaText}>{formatDate(dispute.created_at)}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.detail}>
          {/* Description */}
          <Text style={styles.detailLabel}>DESCRIPTION</Text>
          <Text style={styles.description}>{dispute.description}</Text>

          {/* Resolution (shown when resolved) */}
          {dispute.resolution ? (
            <View style={styles.resolutionBox}>
              <Text style={styles.detailLabel}>RESOLUTION</Text>
              <Text style={styles.resolutionText}>{dispute.resolution}</Text>
            </View>
          ) : null}

          {/* Return-waiver CTA */}
          {isWaiverRequest ? (
            <View style={styles.waiverBlock}>
              <View style={styles.waiverHeader}>
                <Ionicons name="shield-checkmark" size={14} color={colors.safe} />
                <Text style={styles.waiverTitle}>Waiver requested</Text>
              </View>
              <Text style={styles.waiverBody}>
                The carrier asked to waive their cash penalty because this parcel is returnable.
                Confirming refunds the penalty to the carrier; the strike on their record stays.
              </Text>
              <Pressable
                onPress={() => void confirmWaiver()}
                disabled={waiving}
                style={[styles.waiverButton, waiving && styles.buttonPending]}
                accessibilityRole="button"
                accessibilityLabel="Confirm return waiver"
              >
                {waiving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={14} color={colors.white} />
                    <Text style={styles.waiverButtonText}>Confirm waiver — refund penalty</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}

          {/* Evidence */}
          {evidence.length > 0 ? (
            <>
              <Text style={[styles.detailLabel, styles.detailLabelGap]}>EVIDENCE</Text>
              <View style={styles.evidenceGallery}>
                {evidence.map((f, i) => {
                  const pdf = isPdfName(f.name) || isPdfName(f.url);
                  if (f.url && pdf) {
                    return (
                      <Pressable
                        key={`${f.url}-${i}`}
                        onPress={() => void WebBrowser.openBrowserAsync(f.url)}
                        style={styles.evidencePdfChip}
                        accessibilityRole="button"
                        accessibilityLabel="Open PDF evidence"
                      >
                        <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                        <Text style={styles.evidencePdfChipText} numberOfLines={1}>
                          {f.name}
                        </Text>
                      </Pressable>
                    );
                  }
                  if (f.url) {
                    return (
                      <Pressable
                        key={`${f.url}-${i}`}
                        onPress={() => onPreviewImage(f.url)}
                        accessibilityRole="button"
                        accessibilityLabel="View evidence photo"
                      >
                        <Image source={{ uri: f.url }} style={styles.evidenceThumb} />
                      </Pressable>
                    );
                  }
                  return (
                    <View key={`${f.name}-${i}`} style={styles.evidenceChip}>
                      <Ionicons name="document-outline" size={14} color={colors.mutedText} />
                      <Text style={styles.evidenceChipText} numberOfLines={1}>
                        {f.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {/* Conversation */}
          {messages.length > 0 ? (
            <>
              <Text style={[styles.detailLabel, styles.detailLabelGap]}>CONVERSATION</Text>
              <View style={styles.thread}>
                {messages.map((m) => {
                  const mine = m.sender_id === userId;
                  return (
                    <View key={m.id} style={[styles.msgRow, mine && styles.msgRowMine]}>
                      <View style={[styles.msgBubble, mine ? styles.msgBubbleMine : styles.msgBubbleOther]}>
                        <Text style={[styles.msgAuthor, mine && styles.msgAuthorMine]}>
                          {mine ? "You" : "Support"}
                        </Text>
                        <Text style={[styles.msgText, mine && styles.msgTextMine]}>{m.text}</Text>
                        <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>
                          {formatDateTime(m.created_at)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {/* Add message (hidden once resolved, web parity) */}
          {!isResolved ? (
            <View style={styles.addMsgRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a message…"
                placeholderTextColor={colors.subtleText}
                style={styles.addMsgInput}
                multiline
                editable={!sending}
              />
              <Pressable
                onPress={() => void sendMessage()}
                disabled={!draft.trim() || sending}
                style={[styles.sendButton, (!draft.trim() || sending) && styles.buttonPending]}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="send" size={16} color={colors.white} />
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 20 },
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  listContentEmpty: { flexGrow: 1 },
  footerLoading: { paddingVertical: 16, alignItems: "center" },

  headerRow: { flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 14, gap: 10 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800", flex: 1 },
  fileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ctaAccent,
  },
  fileButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  bannerSlot: { marginBottom: 12 },

  // Card
  card: { borderRadius: 16, marginBottom: 12, overflow: "hidden", padding: 0 },
  summary: { padding: 16, gap: 10 },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, textTransform: "capitalize" },
  categoryPill: { flex: 1, minWidth: 0 },
  categoryPillText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  summaryMeta: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  metaText: { color: colors.subtleText, fontSize: 12, fontWeight: "500" },
  metaDot: { color: colors.subtleText, fontSize: 12 },

  // Detail
  detail: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 8,
  },
  detailLabel: { color: colors.subtleText, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  detailLabelGap: { marginTop: 8 },
  description: { color: colors.text, fontSize: 14, lineHeight: 20 },
  resolutionBox: {
    marginTop: 8,
    backgroundColor: "rgba(34,197,94,0.08)",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  resolutionText: { color: colors.text, fontSize: 14, lineHeight: 20 },

  // Waiver
  waiverBlock: {
    marginTop: 8,
    backgroundColor: "rgba(34,195,93,0.08)",
    borderColor: "rgba(34,195,93,0.30)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  waiverHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  waiverTitle: { color: colors.safe, fontSize: 12, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  waiverBody: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
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
  waiverButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  buttonPending: { opacity: 0.6 },

  // Evidence
  evidenceGallery: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  evidenceThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  evidenceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    maxWidth: 160,
  },
  evidenceChipText: { color: colors.mutedText, fontSize: 12, fontWeight: "600", flexShrink: 1 },
  evidencePdfChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceTintPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 200,
  },
  evidencePdfChipText: { color: colors.primary, fontSize: 12, fontWeight: "700", flexShrink: 1 },

  // Thread
  thread: { gap: 8 },
  msgRow: { flexDirection: "row" },
  msgRowMine: { justifyContent: "flex-end" },
  msgBubble: { maxWidth: "84%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  msgBubbleOther: { backgroundColor: colors.surfaceMuted, borderTopLeftRadius: 4 },
  msgBubbleMine: { backgroundColor: colors.primary, borderTopRightRadius: 4 },
  msgAuthor: { color: colors.mutedText, fontSize: 10, fontWeight: "800", marginBottom: 2 },
  msgAuthorMine: { color: "rgba(255,255,255,0.85)" },
  msgText: { color: colors.text, fontSize: 14, lineHeight: 19 },
  msgTextMine: { color: colors.white },
  msgTime: { color: colors.subtleText, fontSize: 10, marginTop: 3 },
  msgTimeMine: { color: "rgba(255,255,255,0.75)" },

  // Add message
  addMsgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 8 },
  addMsgInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    color: colors.text,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  // States
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  centeredText: { color: colors.mutedText, fontSize: 14, fontWeight: "500" },
  errorCard: { borderRadius: 16, alignItems: "center", paddingVertical: 28, paddingHorizontal: 18, gap: 8 },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  errorBody: { color: colors.mutedText, fontSize: 13, textAlign: "center", maxWidth: 280 },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  retryButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  emptyCard: { borderRadius: 16, alignItems: "center", paddingVertical: 28, paddingHorizontal: 18 },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(34,197,94,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 4 },
  emptySubtitle: { color: colors.mutedText, fontSize: 13, textAlign: "center", maxWidth: 300 },
  emptyActionButton: {
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.ctaAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyActionText: { color: colors.white, fontSize: 14, fontWeight: "800" },

  // Lightbox
  lightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" },
  lightboxImage: { width: "92%", height: "80%" },
  lightboxClose: { position: "absolute", top: 48, right: 24 },
});
