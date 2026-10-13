import { useMemo } from "react";

import { buddyRequestSenderIds, withoutBlocked } from "@/features/moderation/blockFilter";
import { cancellableSentRequests } from "@/features/travels/buddyRequests";
import { createTrackerBookingResolver } from "@/features/travels/trackerBooking";
import { useBlockedUsers } from "@/hooks/api/useBlockedUsers";
import { useBookings } from "@/hooks/api/useBookings";
import { useBuddyConnections } from "@/hooks/api/useBuddyConnections";
import { useBuddyListings } from "@/hooks/api/useBuddyListings";
import { useBuddyRequests } from "@/hooks/api/useBuddyRequests";
import { useMyProfile } from "@/hooks/api/useMyProfile";
import { useParcels } from "@/hooks/api/useParcels";
import { useTrips } from "@/hooks/api/useTrips";
import type { Parcel } from "@/services/api";
import { uniqueBy } from "@/features/travels/lib/uniqueBy";
import { MY_TRAVELS_FILTERS } from "@/features/travels/lib/travelCounts";
import { useMyTravelCounts } from "@/features/travels/hooks/useMyTravelCounts";

/**
 * Every list My Travels shows, deduped and split into active / archived.
 * Moved verbatim out of MyTravelsScreen.tsx.
 */
export function useMyTravelsData() {
  // Each tab gets its own list hook so loading/error/refetch are independent.
  const flights = useTrips({ filter: "my_trips" });
  // Server filters backed by the SAME SQL as the tab counts: the server
  // returns only live parcels / posts here, and the past ones in the Archive.
  const sendParcels = useParcels({ filter: MY_TRAVELS_FILTERS.delivering });
  const receiveParcels = useParcels({ filter: MY_TRAVELS_FILTERS.sending });
  const partners = useBuddyListings({ filter: MY_TRAVELS_FILTERS.partnerPosts });
  const archive = useTrips({ filter: "my_archived" });
  const delivered = useBookings({ status: "delivered", perPage: 20 });
  const pastPackages = useParcels({ filter: MY_TRAVELS_FILTERS.pastPackages });
  const pastPosts = useBuddyListings({ filter: MY_TRAVELS_FILTERS.pastPartnerPosts });
  const myProfile = useMyProfile();
  const requests = useBuddyRequests();
  const sentRequests = useBuddyRequests("sent");
  const connections = useBuddyConnections();
  const { hiddenUserIds } = useBlockedUsers();

  // Bookings where I'm the sender — drives the Receive-card journey tracker.
  // Fetched broadly (all statuses) so we can pick the live booking per parcel;
  // the list carries status + timestamps + timeline. Web parity.
  const senderBookings = useBookings({ role: "sender", perPage: 100 });

  // Dedupe every list defensively so a repeated row never renders twice. Most
  // lists are keyed by row id; buddy connections collapse by the *buddy's* id
  // because a pair can end up with more than one active connection row.
  const dedupedSend = uniqueBy(sendParcels.parcels, (p) => p.id);
  const dedupedReceive = uniqueBy(receiveParcels.parcels, (p) => p.id);
  const dedupedConnections = uniqueBy(connections.connections, (c) => c.buddy?.id ?? c.id);
  // A pending request from a blocked person (either direction) is hidden. Existing
  // connections stay: that relationship is already under way.
  const dedupedRequests = uniqueBy(
    withoutBlocked(requests.requests, hiddenUserIds, buddyRequestSenderIds),
    (r) => r.id,
  );
  // Requests I sent that are still pending (so still cancellable). A recipient I
  // blocked, or who blocked me, is hidden like everywhere else.
  const pendingSentRequests = withoutBlocked(
    cancellableSentRequests(sentRequests.requests, myProfile.profile?.id),
    hiddenUserIds,
    (r) => r.receiver_id,
  );
  const dedupedListings = uniqueBy(partners.listings, (b) => b.id);
  const dedupedFlights = uniqueBy(flights.trips, (t) => t.id);
  const dedupedArchive = uniqueBy(archive.trips, (t) => t.id);
  const dedupedDelivered = uniqueBy(delivered.bookings, (b) => b.id);

  // The server already left finished and past parcels out (they are in the
  // Archive). Filtering a page here is what made the old tab count wrong.
  const activeSend = dedupedSend;
  const activeReceive = dedupedReceive;
  const dedupedPastPackages = uniqueBy(pastPackages.parcels, (p) => p.id);
  const dedupedPastPosts = uniqueBy(pastPosts.listings, (b) => b.id);

  // In-progress buddies stay in Partners; ratable ones move to Archive (§3.3 / §7.2).
  const activeBuddies = dedupedConnections.filter((c) => !(c.can_rate || c.already_rated));
  const completedBuddies = dedupedConnections.filter((c) => c.can_rate || c.already_rated);

  /** Resolves each parcel to the booking that best represents its journey. */
  const trackerBookingFor = useMemo(
    () => createTrackerBookingResolver(senderBookings.bookings, myProfile.profile?.id),
    [senderBookings.bookings, myProfile.profile?.id],
  );

  // Parcels already carry resolved sender/carrier profiles; reuse them to label
  // archived deliveries (the bookings list join is a deploy-dependent fallback).
  const parcelById = useMemo(() => {
    const map = new Map<string, Parcel>();
    for (const p of dedupedSend) map.set(p.id, p);
    for (const p of dedupedReceive) map.set(p.id, p);
    return map;
  }, [dedupedSend, dedupedReceive]);

  // The tab labels: exact, from the server, the same numbers web shows. Any
  // list changing (an action, realtime, pull to refresh) refreshes them.
  const listSignature = [
    flights.total, sendParcels.total, receiveParcels.total, partners.total, archive.total,
    delivered.total, pastPackages.total, pastPosts.total, requests.requests.length,
    sentRequests.requests.length, connections.connections.length,
    connections.connections.filter((c) => c.can_rate || c.already_rated).length,
  ].join("|");
  const travelCounts = useMyTravelCounts(listSignature);

  return {
    travelCounts,
    pastPackages,
    pastPosts,
    dedupedPastPackages,
    dedupedPastPosts,
    flights,
    sendParcels,
    receiveParcels,
    partners,
    archive,
    delivered,
    myProfile,
    requests,
    sentRequests,
    connections,
    senderBookings,
    dedupedRequests,
    pendingSentRequests,
    dedupedListings,
    dedupedFlights,
    dedupedArchive,
    dedupedDelivered,
    activeSend,
    activeReceive,
    activeBuddies,
    completedBuddies,
    trackerBookingFor,
    parcelById,
  };
}

export type MyTravelsData = ReturnType<typeof useMyTravelsData>;
