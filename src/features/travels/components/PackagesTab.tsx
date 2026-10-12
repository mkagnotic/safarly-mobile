import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { JourneySummaryRow } from "@/features/travels/ParcelJourneyTracker";
import { TravelCard } from "@/features/travels/TravelCard";
import { getErrorMessage, type Booking, type Parcel } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { ErrorBlock, ListSkeleton, LoadMoreButton } from "@/features/travels/components/ListStates";
import { sharedStyles } from "@/features/travels/myTravelsStyles";

export function PackagesTab({
  sendLoading,
  sendParcels,
  sendError,
  receiveLoading,
  receiveParcels,
  receiveError,
  onOpen,
  onEdit,
  onDeleteSend,
  onDeleteReceive,
  onViewMatches,
  deletingId,
  onRetrySend,
  onRetryReceive,
  sendHasMore,
  sendLoadingMore,
  onLoadMoreSend,
  receiveHasMore,
  receiveLoadingMore,
  onLoadMoreReceive,
  trackerBookingFor,
  myUserId,
  onChat,
  chatPendingId,
}: Readonly<{
  sendLoading: boolean;
  sendParcels: Parcel[];
  sendError: Error | null;
  receiveLoading: boolean;
  receiveParcels: Parcel[];
  receiveError: Error | null;
  onOpen: (id: string) => void;
  onEdit: (parcel: Parcel) => void;
  onDeleteSend: (parcel: Parcel) => void;
  onDeleteReceive: (parcel: Parcel) => void;
  onViewMatches: (parcel: Parcel) => void;
  deletingId: string | null;
  onRetrySend: () => Promise<void>;
  onRetryReceive: () => Promise<void>;
  sendHasMore: boolean;
  sendLoadingMore: boolean;
  onLoadMoreSend: () => void;
  receiveHasMore: boolean;
  receiveLoadingMore: boolean;
  onLoadMoreReceive: () => void;
  /** Resolves the booking that drives a parcel's journey tracker. */
  trackerBookingFor: (parcel: Parcel) => Booking | null;
  myUserId: string | null;
  onChat: (parcel: Parcel) => void;
  chatPendingId: string | null;
}>) {
  /** The other party on a matched parcel — carrier if I sent it, else the sender. */
  const counterpartOf = (p: Parcel) =>
    (myUserId && p.sender_id === myUserId ? p.carrier : p.sender) ?? null;
  const roleOf = (p: Parcel) => (myUserId && p.sender_id === myUserId ? "carrier" : "sender");

  return (
    <View>
      <View style={sharedStyles.section}>
        <View style={sharedStyles.sectionHeading}>
          <Ionicons name="cube-outline" size={16} color={colors.wordmark} />
          <Text style={sharedStyles.sectionTitle}>Send</Text>
          <Text style={styles.sectionHint}>(Packages I'm Delivering)</Text>
        </View>
        {sendLoading && sendParcels.length === 0 ? (
          <ListSkeleton count={2} />
        ) : sendError && sendParcels.length === 0 ? (
          <ErrorBlock message={getErrorMessage(sendError)} onRetry={onRetrySend} />
        ) : sendParcels.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyPanelText}>No packages to deliver yet</Text>
          </View>
        ) : (
          sendParcels.map((p) => (
            <TravelCard
              key={p.id}
              type="parcel"
              tag="PACKAGE DELIVERY"
              item={p}
              onPress={() => onOpen(p.id)}
              onEdit={() => onEdit(p)}
              onDelete={() => onDeleteSend(p)}
              onViewMatches={() => onViewMatches(p)}
              isDeleting={deletingId === p.id}
              counterpart={counterpartOf(p)}
              counterpartRole={roleOf(p)}
              onChat={() => onChat(p)}
              chatPending={chatPendingId === p.id}
            />
          ))
        )}
        <LoadMoreButton
          hasMore={sendHasMore}
          loading={sendLoadingMore}
          onPress={onLoadMoreSend}
        />
      </View>

      <View style={sharedStyles.section}>
        <View style={sharedStyles.sectionHeading}>
          <Ionicons name="cube-outline" size={16} color={colors.safe} />
          <Text style={sharedStyles.sectionTitle}>Receive</Text>
          <Text style={styles.sectionHint}>(Packages I'm Receiving)</Text>
        </View>
        {receiveLoading && receiveParcels.length === 0 ? (
          <ListSkeleton count={2} />
        ) : receiveError && receiveParcels.length === 0 ? (
          <ErrorBlock message={getErrorMessage(receiveError)} onRetry={onRetryReceive} />
        ) : receiveParcels.length === 0 ? (
          // Matches the Send section above and web's dashed placeholder. The
          // "Send a Parcel" CTA already sits in the header actions row, so
          // repeating it here just pushed a second primary button on-screen.
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyPanelText}>No packages to receive yet</Text>
          </View>
        ) : (
          receiveParcels.map((p) => (
            <TravelCard
              key={p.id}
              type="parcel"
              tag="PARCEL REQUEST"
              item={p}
              onPress={() => onOpen(p.id)}
              onEdit={() => onEdit(p)}
              onDelete={() => onDeleteReceive(p)}
              onViewMatches={() => onViewMatches(p)}
              isDeleting={deletingId === p.id}
              counterpart={counterpartOf(p)}
              counterpartRole={roleOf(p)}
              onChat={() => onChat(p)}
              chatPending={chatPendingId === p.id}
              // Only Receive cards carry journey status — as the sender you're
              // the one following the parcel. The card shows a one-line summary;
              // the full timeline lives on the details screen this card opens.
              footer={<JourneySummaryRow parcel={p} booking={trackerBookingFor(p)} />}
            />
          ))
        )}
        <LoadMoreButton
          hasMore={receiveHasMore}
          loading={receiveLoadingMore}
          onPress={onLoadMoreReceive}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHint: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  /**
   * Empty-list panel.
   *
   * Was a dashed hairline in `colors.border` (#EDE6F5) with no fill, which is
   * near-invisible against the peach/lavender hero wash (#ECDBE4) — the box read
   * as floating text. Two changes fix it: an opaque white surface so the panel
   * has an actual edge, and a solid brand-tinted stroke instead of dashed —
   * RN draws `borderStyle: "dashed"` unreliably on Android once `borderRadius`
   * is involved, so the dashes were being dropped on top of the low contrast.
   */
  emptyPanel: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: primaryTint.stroke18,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPanelText: { color: colors.subtleText, fontSize: 13, lineHeight: 18, fontWeight: "500" },
});
