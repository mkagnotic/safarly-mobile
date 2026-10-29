import { View } from "react-native";

import { TravelCard } from "@/features/travels/TravelCard";
import { TripAvailabilityToggle } from "@/features/travels/TripAvailabilityToggle";
import { getErrorMessage, type Trip } from "@/services/api";
import {
  EmptyBlock,
  ErrorBlock,
  ListSkeleton,
  LoadMoreButton,
} from "@/features/travels/components/ListStates";

// ───────────────────────── Tab bodies ─────────────────────────

export function FlightsTab({
  loading,
  error,
  trips,
  onRetry,
  onOpen,
  onEdit,
  onDelete,
  onViewMatches,
  deletingId,
  hasMore,
  loadingMore,
  onLoadMore,
}: Readonly<{
  loading: boolean;
  error: Error | null;
  trips: Trip[];
  onRetry: () => Promise<void>;
  onOpen: (id: string) => void;
  onEdit: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
  onViewMatches: (trip: Trip) => void;
  deletingId: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}>) {
  if (loading && trips.length === 0) return <ListSkeleton />;
  if (error && trips.length === 0)
    return <ErrorBlock subject="your flights" message={getErrorMessage(error)} onRetry={onRetry} />;
  if (trips.length === 0)
    return (
      <EmptyBlock
        icon="airplane-outline"
        title="No flights listed"
        subtitle="List a trip so senders on your route can find you and send match requests."
      />
    );
  return (
    <View>
      {trips.map((t) => (
        <TravelCard
          key={t.id}
          type="flight"
          tag="Trip listing"
          item={t}
          onPress={() => onOpen(t.id)}
          onEdit={() => onEdit(t)}
          onDelete={() => onDelete(t)}
          onViewMatches={() => onViewMatches(t)}
          isDeleting={deletingId === t.id}
          footer={
            /* Trip Availability - a carrier scanning their list can see which
               trips are still taking parcels and close one without opening it.
               Only the active list renders this; the `my_trips` filter already
               excludes departed trips, which lock automatically anyway. */
            <TripAvailabilityToggle trip={t} onChanged={() => void onRetry()} />
          }
        />
      ))}
      <LoadMoreButton hasMore={hasMore} loading={loadingMore} onPress={onLoadMore} />
    </View>
  );
}
