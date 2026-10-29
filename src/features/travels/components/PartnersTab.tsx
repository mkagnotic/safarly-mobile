import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { BuddyPartnerCard } from "@/features/travels/BuddyPartnerCard";
import { useBuddyListings } from "@/hooks/api/useBuddyListings";
import {
  getErrorMessage,
  type BuddyConnection,
  type BuddyListing,
  type BuddyRequest,
} from "@/services/api";
import { colors } from "@/theme/colors";
import {
  BuddyConnectionCard,
  BuddyRequestCard,
  SentBuddyRequestCard,
} from "@/features/travels/components/BuddyRequestCards";
import {
  EmptyBlock,
  ErrorBlock,
  ListSkeleton,
  LoadMoreButton,
} from "@/features/travels/components/ListStates";
import { sharedStyles } from "@/features/travels/myTravelsStyles";

export function PartnersTab({
  loading,
  error,
  listings,
  onRetry,
  onOpen,
  onEdit,
  onDelete,
  deletingId,
  hasMore,
  loadingMore,
  onLoadMore,
  requests,
  sentRequests,
  onCancelSent,
  activeBuddies,
  actioningId,
  onAccept,
  onReject,
  onChat,
  onComplete,
  onCreate,
  connectionsLoading = false,
  connectionsError = null,
  onRetryConnections,
}: Readonly<{
  loading: boolean;
  error: Error | null;
  listings: ReturnType<typeof useBuddyListings>["listings"];
  onRetry: () => Promise<void>;
  onOpen: (id: string) => void;
  onEdit: (listing: BuddyListing) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  requests: BuddyRequest[];
  sentRequests: BuddyRequest[];
  onCancelSent: (request: BuddyRequest, recipientName: string) => void;
  activeBuddies: BuddyConnection[];
  actioningId: string | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onChat: (conn: BuddyConnection) => void;
  onComplete: (id: string) => void;
  onCreate?: () => void;
  connectionsLoading?: boolean;
  connectionsError?: Error | null;
  onRetryConnections?: () => Promise<void>;
}>) {
  const hasExtras = requests.length > 0 || sentRequests.length > 0 || activeBuddies.length > 0;

  const listingsBody =
    loading && listings.length === 0 ? (
      <ListSkeleton />
    ) : error && listings.length === 0 ? (
      <ErrorBlock subject="your travel partners" message={getErrorMessage(error)} onRetry={onRetry} />
    ) : listings.length === 0 ? (
      <EmptyBlock
        icon="people-outline"
        title="No buddy listings yet"
        subtitle="Create a buddy listing to find travel companions."
        actionLabel="Create a buddy listing"
        onAction={onCreate}
      />
    ) : (
      <View>
        {listings.map((b) => (
          <BuddyPartnerCard
            key={b.id}
            item={b}
            onPress={() => onOpen(b.id)}
            onEdit={() => onEdit(b)}
            onDelete={() => onDelete(b.id)}
            isDeleting={deletingId === b.id}
          />
        ))}
        <LoadMoreButton hasMore={hasMore} loading={loadingMore} onPress={onLoadMore} />
      </View>
    );

  return (
    <View>
      {requests.length > 0 ? (
        <View style={sharedStyles.section}>
          <View style={sharedStyles.sectionHeading}>
            <Ionicons name="mail-unread-outline" size={16} color={colors.warning} />
            <Text style={sharedStyles.sectionTitle}>Requests received</Text>
          </View>
          {requests.map((r) => (
            <BuddyRequestCard
              key={r.id}
              request={r}
              listing={listings.find((l) => l.id === r.listing_id) ?? null}
              pending={actioningId === r.id}
              onAccept={() => onAccept(r.id)}
              onReject={() => onReject(r.id)}
            />
          ))}
        </View>
      ) : null}

      {sentRequests.length > 0 ? (
        <View style={sharedStyles.section}>
          <View style={sharedStyles.sectionHeading}>
            <Ionicons name="paper-plane-outline" size={16} color={colors.primary} />
            <Text style={sharedStyles.sectionTitle}>Sent requests</Text>
          </View>
          {sentRequests.map((r) => (
            <SentBuddyRequestCard
              key={r.id}
              request={r}
              pending={actioningId === r.id}
              onCancel={(name) => onCancelSent(r, name)}
            />
          ))}
        </View>
      ) : null}

      {/* Always shown, as on web (27 Oct 2026): empty text, or an error with Try again. */}
      {activeBuddies.length > 0 || connectionsError || !connectionsLoading ? (
        <View style={sharedStyles.section}>
          <View style={sharedStyles.sectionHeading}>
            <Ionicons name="people-outline" size={16} color={colors.safe} />
            <Text style={sharedStyles.sectionTitle}>My buddies</Text>
          </View>
          {connectionsError && activeBuddies.length === 0 && onRetryConnections ? (
            <ErrorBlock subject="your travel partners" message={getErrorMessage(connectionsError)} onRetry={onRetryConnections} />
          ) : activeBuddies.length === 0 ? (
            <Text style={styles.emptyText}>No travel buddies yet</Text>
          ) : null}
          {activeBuddies.map((c) => (
            <BuddyConnectionCard
              key={c.id}
              connection={c}
              pending={actioningId === c.id}
              onChat={() => onChat(c)}
              onComplete={() => onComplete(c.id)}
            />
          ))}
        </View>
      ) : null}

      <View style={sharedStyles.section}>
        {hasExtras || !connectionsLoading || connectionsError ? (
          <View style={sharedStyles.sectionHeading}>
            <Ionicons name="megaphone-outline" size={16} color={colors.wordmark} />
            <Text style={sharedStyles.sectionTitle}>My buddy listings</Text>
          </View>
        ) : null}
        {listingsBody}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 14,
  },
});
