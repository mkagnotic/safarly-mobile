import { useCallback, useEffect, useState } from "react";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { FormBanner } from "@/components/ui/FormBanner";
import { PrimaryHeaderActions } from "@/components/ui/PrimaryHeaderActions";
import { Screen } from "@/components/ui/Screen";
import { MatchesModal } from "@/features/travels/MatchesModal";
import { MainTabParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";
import { styles } from "@/features/travels/MyTravelsScreen.styles";
import { ArchiveTab } from "@/features/travels/components/ArchiveTab";
import { FlightsTab } from "@/features/travels/components/FlightsTab";
import { MyTravelsEditModals } from "@/features/travels/components/MyTravelsEditModals";
import { Tabs } from "@/features/travels/components/MyTravelsTabs";
import { PackagesTab } from "@/features/travels/components/PackagesTab";
import { PartnersTab } from "@/features/travels/components/PartnersTab";
import { useMyTravelsActions } from "@/features/travels/hooks/useMyTravelsActions";
import { useMyTravelsData } from "@/features/travels/hooks/useMyTravelsData";
import type { Nav, TabConfig, TabKey } from "@/features/travels/lib/myTravelsTypes";

export function MyTravelsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainTabParamList, "Parcels">>();
  const requestedTab = route.params?.tab;
  const [activeTab, setActiveTab] = useState<TabKey>(requestedTab ?? "flights");

  // ⚠️ Unlike Search, which is pushed fresh and can read its tab as initial
  // state, My Travels is a BOTTOM TAB: it stays mounted, so arriving here a
  // second time with a new `tab` does not remount and an initial-only read
  // would be silently ignored. Posting a parcel would then drop you on
  // whichever tab you happened to leave open. Deliberately keyed on the param
  // alone, so a tab the user picks by hand afterwards is left alone.
  useEffect(() => {
    if (requestedTab) setActiveTab(requestedTab);
  }, [requestedTab]);

  const {
    flights, sendParcels, receiveParcels, partners, archive, delivered, myProfile, requests,
    sentRequests, connections, senderBookings, dedupedRequests, pendingSentRequests,
    dedupedListings, dedupedFlights, dedupedArchive, dedupedDelivered, activeSend, activeReceive,
    activeBuddies, completedBuddies, trackerBookingFor, parcelById,
  } = useMyTravelsData();

  const {
    deletingId, actioningId, formError, setFormError, matchSource, setMatchSource, chatPendingId,
    handleViewTripMatches, handleViewParcelMatches, handleDeleteTrip, handleDeleteSendParcel,
    handleDeleteReceiveParcel, handleDeleteBuddy, handleOpenTrip, handleOpenParcel, handleEditBuddy,
    handleOpenBuddy, handleEditParcel, handleEditTrip, handleRateDelivery, handleOpenDelivery,
    handleAcceptRequest, handleRejectRequest, handleCancelSentRequest, handleCompleteConnection,
    handleDisconnect, handleChatCounterpart, handleChatConnection, handleOpenRate,
    ...editModals
  } = useMyTravelsActions({
    navigation, flights, sendParcels, receiveParcels, partners, requests, sentRequests, connections,
    myProfile,
  });

  const tabs: readonly TabConfig[] = [
    { key: "flights", label: "Flights", count: flights.total },
    {
      key: "packages",
      label: "Packages",
      count: activeSend.length + activeReceive.length,
    },
    { key: "partners", label: "Partners", count: partners.total },
    {
      key: "archive",
      label: "Archive",
      count: archive.total + delivered.bookings.length + completedBuddies.length,
    },
  ];

  const goSendParcel = useCallback(
    () => navigation.navigate("SendParcelTab"),
    [navigation],
  );
  const goListTrip = useCallback(
    () => navigation.navigate("ListTripTab"),
    [navigation],
  );

  const refetchActive = useCallback(async () => {
    if (activeTab === "flights") return flights.refetch();
    if (activeTab === "packages") {
      // senderBookings drives the journey trackers on the Receive cards, so it
      // has to refresh with them or the timeline goes stale after a pull.
      await Promise.all([
        sendParcels.refetch(),
        receiveParcels.refetch(),
        senderBookings.refetch(),
      ]);
      return;
    }
    if (activeTab === "partners") {
      await Promise.all([
        partners.refetch(),
        requests.refetch(),
        sentRequests.refetch(),
        connections.refetch(),
      ]);
      return;
    }
    if (activeTab === "archive") {
      await Promise.all([archive.refetch(), delivered.refetch(), connections.refetch()]);
      return;
    }
  }, [
    activeTab,
    flights,
    sendParcels,
    receiveParcels,
    partners,
    archive,
    delivered,
    requests,
    sentRequests,
    connections,
    senderBookings,
  ]);

  const refreshing =
    (activeTab === "flights" && flights.loading && flights.trips.length > 0) ||
    (activeTab === "packages" &&
      ((sendParcels.loading && sendParcels.parcels.length > 0) ||
        (receiveParcels.loading && receiveParcels.parcels.length > 0))) ||
    (activeTab === "partners" &&
      ((partners.loading && partners.listings.length > 0) ||
        (connections.loading && connections.connections.length > 0))) ||
    (activeTab === "archive" &&
      ((archive.loading && archive.trips.length > 0) ||
        (delivered.loading && delivered.bookings.length > 0) ||
        (connections.loading && completedBuddies.length > 0)));

  return (
    <Screen scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refetchActive}
            tintColor={colors.wordmark}
              colors={[colors.wordmark]}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>My travels</Text>
            <Text style={styles.subtitle}>
              Track all your flights, packages, and travel partners.
            </Text>
          </View>
          <PrimaryHeaderActions />
        </View>

        {formError ? (
          <View style={styles.bannerSlot}>
            <FormBanner message={formError} onDismiss={() => setFormError(null)} />
          </View>
        ) : null}

        {/* Action row — standard AppButton recipe (radius 16, 14/16 padding,
            15/700 label, scale-on-press). Send is the primary (orange CTA);
            List is the secondary (white card + border) — matches every other
            primary/secondary button pair across the app. */}
        <View style={styles.actionsRow}>
          <AppButton
            label="Carry a Parcel"
            variant="secondary"
            onPress={goListTrip}
            style={styles.actionButtonFlex}
          />
          <AppButton
            label="Send a Parcel"
            onPress={goSendParcel}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.actionButtonFlex}
          />
        </View>

        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {activeTab === "flights" ? (
          <FlightsTab
            loading={flights.loading}
            error={flights.error}
            trips={dedupedFlights}
            onRetry={flights.refetch}
            onOpen={handleOpenTrip}
            onEdit={handleEditTrip}
            onDelete={handleDeleteTrip}
            onViewMatches={handleViewTripMatches}
            deletingId={deletingId}
            hasMore={flights.hasMore}
            loadingMore={flights.loadingMore}
            onLoadMore={flights.loadMore}
          />
        ) : null}

        {activeTab === "packages" ? (
          <PackagesTab
            sendLoading={sendParcels.loading}
            sendParcels={activeSend}
            sendError={sendParcels.error}
            receiveLoading={receiveParcels.loading}
            receiveParcels={activeReceive}
            receiveError={receiveParcels.error}
            onOpen={handleOpenParcel}
            onEdit={handleEditParcel}
            onDeleteSend={handleDeleteSendParcel}
            onDeleteReceive={handleDeleteReceiveParcel}
            onViewMatches={handleViewParcelMatches}
            deletingId={deletingId}
            onRetrySend={sendParcels.refetch}
            onRetryReceive={receiveParcels.refetch}
            sendHasMore={sendParcels.hasMore}
            sendLoadingMore={sendParcels.loadingMore}
            onLoadMoreSend={sendParcels.loadMore}
            receiveHasMore={receiveParcels.hasMore}
            receiveLoadingMore={receiveParcels.loadingMore}
            onLoadMoreReceive={receiveParcels.loadMore}
            trackerBookingFor={trackerBookingFor}
            myUserId={myProfile.profile?.id ?? null}
            onChat={(p) => void handleChatCounterpart(p)}
            chatPendingId={chatPendingId}
          />
        ) : null}

        {activeTab === "partners" ? (
          <PartnersTab
            loading={partners.loading}
            error={partners.error}
            listings={dedupedListings}
            onRetry={partners.refetch}
            onOpen={handleOpenBuddy}
            onEdit={handleEditBuddy}
            onDelete={handleDeleteBuddy}
            deletingId={deletingId}
            hasMore={partners.hasMore}
            loadingMore={partners.loadingMore}
            onLoadMore={partners.loadMore}
            requests={dedupedRequests}
            sentRequests={pendingSentRequests}
            onCancelSent={handleCancelSentRequest}
            activeBuddies={activeBuddies}
            actioningId={actioningId}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            onChat={handleChatConnection}
            onComplete={handleCompleteConnection}
            onDisconnect={handleDisconnect}
          />
        ) : null}

        {activeTab === "archive" ? (
          <ArchiveTab
            loading={archive.loading}
            error={archive.error}
            trips={dedupedArchive}
            onRetry={archive.refetch}
            onOpen={handleOpenTrip}
            deliveredLoading={delivered.loading}
            deliveredBookings={dedupedDelivered}
            myUserId={myProfile.profile?.id ?? null}
            onRateDelivery={handleRateDelivery}
            onOpenDelivery={handleOpenDelivery}
            hasMore={archive.hasMore}
            loadingMore={archive.loadingMore}
            onLoadMore={archive.loadMore}
            completedBuddies={completedBuddies}
            onRateBuddy={handleOpenRate}
            parcelById={parcelById}
          />
        ) : null}
      </ScrollView>

      <MatchesModal
        open={!!matchSource}
        source={matchSource}
        onClose={() => setMatchSource(null)}
      />

      <MyTravelsEditModals {...editModals} />
    </Screen>
  );
}
