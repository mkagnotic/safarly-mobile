import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { BuddyPartnerCard } from "@/features/travels/BuddyPartnerCard";
import { TravelCard } from "@/features/travels/TravelCard";
import {
  getErrorMessage,
  type Booking,
  type BuddyConnection,
  type BuddyListing,
  type Parcel,
  type Trip,
} from "@/services/api";
import { colors } from "@/theme/colors";
import { ArchiveBookingCard, ArchiveBuddyCard } from "@/features/travels/components/ArchiveCards";
import {
  EmptyBlock,
  ErrorBlock,
  ListSkeleton,
  LoadMoreButton,
} from "@/features/travels/components/ListStates";
import { sharedStyles } from "@/features/travels/myTravelsStyles";

export function ArchiveTab({
  loading,
  error,
  trips,
  onRetry,
  onOpen,
  deliveredLoading,
  deliveredBookings,
  myUserId,
  onRateDelivery,
  onOpenDelivery,
  hasMore,
  loadingMore,
  onLoadMore,
  completedBuddies,
  onRateBuddy,
  parcelById,
  deliveredHasMore,
  deliveredLoadingMore,
  onLoadMoreDelivered,
  pastPackages,
  pastPackagesHasMore,
  pastPackagesLoadingMore,
  onLoadMorePastPackages,
  onOpenParcel,
  pastPosts,
  pastPostsHasMore,
  pastPostsLoadingMore,
  onLoadMorePastPosts,
  onOpenBuddy,
}: Readonly<{
  loading: boolean;
  error: Error | null;
  trips: Trip[];
  onRetry: () => Promise<void>;
  onOpen: (id: string) => void;
  deliveredLoading: boolean;
  deliveredBookings: Booking[];
  myUserId: string | null;
  onRateDelivery: (bookingId: string) => void;
  onOpenDelivery: (bookingId: string) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  completedBuddies: BuddyConnection[];
  onRateBuddy: (conn: BuddyConnection) => void;
  /** Parcels already loaded in Send/Receive, keyed by id — feeds the archive tracker. */
  parcelById: Map<string, Parcel>;
  deliveredHasMore: boolean;
  deliveredLoadingMore: boolean;
  onLoadMoreDelivered: () => void;
  /** Packages whose date passed, or that closed without a delivery (server-decided). */
  pastPackages: Parcel[];
  pastPackagesHasMore: boolean;
  pastPackagesLoadingMore: boolean;
  onLoadMorePastPackages: () => void;
  onOpenParcel: (id: string) => void;
  /** Travel-partner posts whose travel dates have passed (server-decided). */
  pastPosts: BuddyListing[];
  pastPostsHasMore: boolean;
  pastPostsLoadingMore: boolean;
  onLoadMorePastPosts: () => void;
  onOpenBuddy: (id: string) => void;
}>) {
  const nothing =
    trips.length === 0 &&
    deliveredBookings.length === 0 &&
    completedBuddies.length === 0 &&
    pastPackages.length === 0 &&
    pastPosts.length === 0;
  if ((loading || deliveredLoading) && nothing) return <ListSkeleton />;
  if (error && nothing)
    return <ErrorBlock message={getErrorMessage(error)} onRetry={onRetry} />;
  if (nothing)
    return (
      <EmptyBlock
        icon="archive"
        title="No archived items"
        subtitle="Completed deliveries, trips, and travel partners will appear here."
      />
    );
  return (
    <View>
      {deliveredBookings.length > 0 ? (
        <View style={sharedStyles.section}>
          <View style={sharedStyles.sectionHeading}>
            <Ionicons name="checkmark-done-outline" size={16} color={colors.safe} />
            <Text style={sharedStyles.sectionTitle}>Completed deliveries</Text>
          </View>
          {deliveredBookings.map((b) => (
            <ArchiveBookingCard
              key={b.id}
              booking={b}
              parcel={parcelById.get(b.parcel_id) ?? null}
              myUserId={myUserId}
              onRate={() => onRateDelivery(b.id)}
              onOpen={() => onOpenDelivery(b.id)}
            />
          ))}
          <LoadMoreButton
            hasMore={deliveredHasMore}
            loading={deliveredLoadingMore}
            onPress={onLoadMoreDelivered}
          />
        </View>
      ) : null}

      {completedBuddies.length > 0 ? (
        <View style={sharedStyles.section}>
          <View style={sharedStyles.sectionHeading}>
            <Ionicons name="people-outline" size={16} color={colors.safe} />
            <Text style={sharedStyles.sectionTitle}>Completed buddies</Text>
          </View>
          {completedBuddies.map((c) => (
            <ArchiveBuddyCard key={c.id} connection={c} onRate={() => onRateBuddy(c)} />
          ))}
        </View>
      ) : null}

      {trips.length > 0 ? (
        <View style={sharedStyles.section}>
          {deliveredBookings.length > 0 ? (
            <View style={sharedStyles.sectionHeading}>
              <Ionicons name="airplane-outline" size={16} color={colors.wordmark} />
              <Text style={sharedStyles.sectionTitle}>Flights</Text>
            </View>
          ) : null}
          {trips.map((t) => (
            <TravelCard
              key={t.id}
              type="flight"
              // Neutral tag: these are closed records, so the accent orange read
              // as an active listing. The status pill carries the real outcome.
              tag="ARCHIVED TRIP"
              tagTone="muted"
              item={t}
              onPress={() => onOpen(t.id)}
            />
          ))}
          <LoadMoreButton hasMore={hasMore} loading={loadingMore} onPress={onLoadMore} />
        </View>
      ) : null}

      {pastPackages.length > 0 ? (
        <View style={sharedStyles.section}>
          <View style={sharedStyles.sectionHeading}>
            <Ionicons name="cube-outline" size={16} color={colors.mutedText} />
            <Text style={sharedStyles.sectionTitle}>Past packages</Text>
          </View>
          {pastPackages.map((p) => (
            <TravelCard
              key={p.id}
              type="parcel"
              tag="PAST PACKAGE"
              tagTone="muted"
              item={p}
              onPress={() => onOpenParcel(p.id)}
            />
          ))}
          <LoadMoreButton
            hasMore={pastPackagesHasMore}
            loading={pastPackagesLoadingMore}
            onPress={onLoadMorePastPackages}
          />
        </View>
      ) : null}

      {pastPosts.length > 0 ? (
        <View style={sharedStyles.section}>
          <View style={sharedStyles.sectionHeading}>
            <Ionicons name="people-outline" size={16} color={colors.mutedText} />
            <Text style={sharedStyles.sectionTitle}>Past travel partner posts</Text>
          </View>
          {pastPosts.map((b) => (
            <BuddyPartnerCard key={b.id} item={b} onPress={() => onOpenBuddy(b.id)} />
          ))}
          <LoadMoreButton
            hasMore={pastPostsHasMore}
            loading={pastPostsLoadingMore}
            onPress={onLoadMorePastPosts}
          />
        </View>
      ) : null}
    </View>
  );
}
