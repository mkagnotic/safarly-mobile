import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { PrimaryHeaderActions } from "@/components/ui/PrimaryHeaderActions";
import { Screen } from "@/components/ui/Screen";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import { isSameRoute } from "@/features/travels/routeValidation";
import {
  clearPersistedSearch,
  loadPersistedSearch,
  savePersistedSearch,
  type LookingForType,
  type ResultsTab,
  type SearchCountry,
} from "@/features/search/searchPersistence";
import { RouteListingCard } from "@/features/search/RouteListingCard";
import { useSearchMatches } from "@/hooks/api/useSearchMatches";
import { MainTabParamList } from "@/navigation/types";
import {
  buddiesApi,
  getErrorMessage,
  messagesApi,
  type BuddySearchMatch,
  type PackageMatch,
  type Parcel,
  type SearchFilters,
} from "@/services/api";
import { colors } from "@/theme/colors";
import { formatDeliveryWindow } from "@/utils/travelDate";
import { showToast } from "@/feedback/appFeedback";
import { styles } from "@/features/search/SearchScreen.styles";
import { AppliedFilterChips } from "@/features/search/components/AppliedFilterChips";
import { BuddyMatchCardBody } from "@/features/search/components/BuddyMatchCardBody";
import { PackageMatchCard } from "@/features/search/components/PackageMatchCard";
import { Pagination } from "@/features/search/components/Pagination";
import { ReceiverTabResults } from "@/features/search/components/ReceiverTabResults";
import { ResultTabs } from "@/features/search/components/ResultTabs";
import { SearchFilterFields } from "@/features/search/components/SearchFilterFields";
import { SearchModeBanner } from "@/features/search/components/SearchModeBanner";
import {
  MatchCardSkeleton,
  MatchListSkeleton,
  MyListingSkeleton,
} from "@/features/search/components/SearchSkeletons";
import { EmptyResults, ErrorBlock } from "@/features/search/components/SearchStates";
import { useSearchPaging } from "@/features/search/hooks/useSearchPaging";
import { useSearchResultLists } from "@/features/search/hooks/useSearchResultLists";
import type { Nav } from "@/features/search/lib/navigation";
import {
  AUTO_BUDDY_PER_PAGE,
  AUTO_PER_PAGE,
  BROWSE_QUERY,
  COUNTRY_LABEL,
  formatDateLabel,
  ISO_DATE,
  MANUAL_PER_PAGE,
  MATCH_MY_ROUTES_QUERY,
  type Notice,
  searchDateBounds,
} from "@/features/search/lib/searchConfig";
import { sharedStyles } from "@/features/search/searchStyles";

export function SearchScreen() {
  const navigation = useNavigation<Nav>();
  // Deep-link target from a match-found notification (`/customer/search?match=`).
  // The screen also mounts as the hidden "SearchTab" route (no params) — reading
  // an absent param is simply undefined.
  const route = useRoute<RouteProp<MainTabParamList, "Trips">>();
  const highlightId = route.params?.highlightId;

  // Independent per-side countries, matching the create forms. Search used to
  // model this as a coupled IN_TO_US / US_TO_IN "direction", which made
  // domestic routes (IN -> IN, US -> US) impossible to search for even though
  // every create form lets you list one.
  const [fromCountry, setFromCountry] = useState<SearchCountry>("IN");
  const [toCountry, setToCountry] = useState<SearchCountry>("US");
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Stable per mount — bounds the date pickers to today … +12 months (web parity).
  const dateBounds = useMemo(() => searchDateBounds(), []);
  const [lookingFor, setLookingFor] = useState<LookingForType[]>([]);
  // ⚠️ The notification's tab is the INITIAL value, not an effect: it must apply
  // before any results arrive, and the summary notifications carry no match id to
  // infer it from.
  const requestedTab = route.params?.tab;
  const [activeTab, setActiveTab] = useState<ResultsTab>(requestedTab ?? "package");
  /**
   * ⚠️ Arriving from a match notification forces route-matching ON and skips the
   * restore below. Web parity (`isMatchDeepLink` in `CustomerSearch.tsx`).
   *
   * Browsing everything is the right default for someone who opened Search
   * themselves, but the wrong list for someone who tapped "1 travel buddy matches
   * your route": in browse mode the results are every open listing, server-paged,
   * so the promised card is usually not on the first page and the tab looks empty
   * or unrelated. Route-matching returns exactly the overlapping listings — the
   * set the notification was computed from — unpaginated, so the highlight effect
   * can page to the card and scroll it into view.
   */
  const isMatchDeepLink = !!(highlightId || requestedTab);
  const [notice, setNotice] = useState<Notice | null>(null);

  // null `appliedFilters` = auto-match mode; per-list pages re-fire it for free.
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters | null>(null);
  const [pkgPage, setPkgPage] = useState(1);
  const [rcvPage, setRcvPage] = useState(1);
  const [buddyPage, setBuddyPage] = useState(1);
  // Auto-match lists are fetched in bulk and paged client-side.
  const [autoPkgPage, setAutoPkgPage] = useState(1);
  const [autoRcvPage, setAutoRcvPage] = useState(1);
  const [autoBuddyPage, setAutoBuddyPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * The screen used to open on route-matching ONLY: with no listings of your own
   * you saw an empty screen and had no way to simply look at what the
   * marketplace was carrying. Browsing everything is now the default, the way a
   * listings app behaves, and route-matching is an opt-in lens. Mirrors web
   * `CustomerSearch.tsx`.
   */
  const [matchMyRoutes, setMatchMyRoutes] = useState(isMatchDeepLink);
  const { results, loading, error, hasAppliedFilters, search, setBaseQuery, refetch, resetToAutoMatch } =
    useSearchMatches({ initialFilters: isMatchDeepLink ? MATCH_MY_ROUTES_QUERY : BROWSE_QUERY });

  // Manual search + page changes re-fire here; pagination is free (the unit was
  // already spent in handleApply).
  useEffect(() => {
    if (!appliedFilters) return;
    void search({
      ...appliedFilters,
      carrier_page: pkgPage,
      receive_page: rcvPage,
      buddy_page: buddyPage,
    });
  }, [appliedFilters, pkgPage, rcvPage, buddyPage, search]);

  // ── Restore-on-return (web parity: web persists to sessionStorage) ──
  // Gates the persist effect below until the async load resolves, so we never
  // clobber saved state with the initial defaults before restoring.
  const hydratedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // A deep-link is a fresh, specific intent: restoring the last browse over it
      // would drag the user off the card they just tapped. Web does the same by
      // returning null from `loadPersistedSearch` when the URL carries the params.
      const snap = isMatchDeepLink ? null : await loadPersistedSearch();
      if (!cancelled && snap) {
        setFromCountry(snap.fromCountry);
        setToCountry(snap.toCountry);
        setFromCity(snap.fromCity);
        setToCity(snap.toCity);
        setDateFrom(snap.dateFrom);
        setDateTo(snap.dateTo);
        setLookingFor(snap.lookingFor);
        // ⚠️ A notification's tab outranks the restored one. Otherwise the async
        // restore lands after mount and drags the user back to whichever tab they
        // last used, undoing the deep-link they just tapped.
        if (!requestedTab) setActiveTab(snap.activeTab);
        setPkgPage(snap.pkgPage);
        setRcvPage(snap.rcvPage);
        setBuddyPage(snap.buddyPage);
        setAutoPkgPage(snap.autoPkgPage);
        setAutoRcvPage(snap.autoRcvPage);
        setAutoBuddyPage(snap.autoBuddyPage);
        // Set applied filters LAST: the pagination effect above then replays the
        // manual search for FREE (no quota) with the restored pages already set.
        if (snap.matchMyRoutes) {
          setMatchMyRoutes(true);
          void setBaseQuery(MATCH_MY_ROUTES_QUERY);
        }
        if (snap.appliedFilters) setAppliedFilters(snap.appliedFilters);
      }
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the in-progress search whenever it changes (post-hydration only).
  useEffect(() => {
    if (!hydratedRef.current) return;
    void savePersistedSearch({
      v: 1,
      fromCountry,
      toCountry,
      fromCity,
      toCity,
      dateFrom,
      dateTo,
      lookingFor,
      activeTab,
      appliedFilters,
      matchMyRoutes,
      pkgPage,
      rcvPage,
      buddyPage,
      autoPkgPage,
      autoRcvPage,
      autoBuddyPage,
    });
  }, [
    fromCountry,
    toCountry,
    fromCity,
    toCity,
    dateFrom,
    dateTo,
    lookingFor,
    activeTab,
    appliedFilters,
    matchMyRoutes,
    pkgPage,
    rcvPage,
    buddyPage,
    autoPkgPage,
    autoRcvPage,
    autoBuddyPage,
  ]);

  const {
    myTripsState, myParcelsState, carrierTrips, receiverRequests, buddyMatches, displayCarrierTrips,
    displayReceiverRequests, dedupedBuddyMatches, sortedMyParcels, sortedMyTrips,
    carrierTripsByParcelId, receiverRequestsByTripId,
  } = useSearchResultLists({ results, loading, highlightId });

  const fromCities = fromCountry === "IN" ? INDIA_CITIES : USA_CITIES;
  const toCities = toCountry === "IN" ? INDIA_CITIES : USA_CITIES;
  const fromCountryLabel = COUNTRY_LABEL[fromCountry];
  const toCountryLabel = COUNTRY_LABEL[toCountry];

  // Deep-link highlight (web parity): once the results are in, jump to the tab —
  // and the page — that holds the `?match=` listing, so its ringed card is on
  // screen. Runs once per id; the card ring itself is applied in the tab lists.
  const highlightHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!highlightId || loading) return;
    if (highlightHandledRef.current === highlightId) return;

    const inBuddy = buddyMatches.some((b) => b.id === highlightId);
    const inCarrier = carrierTrips.some((m) => m.id === highlightId);
    const inReceiver = receiverRequests.some((m) => m.id === highlightId);
    if (!inBuddy && !inCarrier && !inReceiver) return; // not in this result set (yet)

    highlightHandledRef.current = highlightId;
    const autoMatch = !hasAppliedFilters && matchMyRoutes; // isAutoMatch is declared below this effect

    if (inBuddy) {
      setActiveTab("buddy");
      if (autoMatch) {
        const idx = dedupedBuddyMatches.findIndex((b) => b.id === highlightId);
        if (idx >= 0) setAutoBuddyPage(Math.floor(idx / AUTO_BUDDY_PER_PAGE) + 1);
      }
    } else if (inCarrier) {
      setActiveTab("package");
      if (autoMatch) {
        const parcelIdx = sortedMyParcels.findIndex((p) =>
          (carrierTripsByParcelId.get(p.id) ?? []).some((m) => m.id === highlightId),
        );
        if (parcelIdx >= 0) setAutoPkgPage(Math.floor(parcelIdx / AUTO_PER_PAGE) + 1);
      }
    } else {
      setActiveTab("receiver");
      if (autoMatch) {
        const tripIdx = sortedMyTrips.findIndex((t) =>
          (receiverRequestsByTripId.get(t.id) ?? []).some((m) => m.id === highlightId),
        );
        if (tripIdx >= 0) setAutoRcvPage(Math.floor(tripIdx / AUTO_PER_PAGE) + 1);
      }
    }
  }, [
    highlightId,
    loading,
    hasAppliedFilters,
    buddyMatches,
    carrierTrips,
    receiverRequests,
    dedupedBuddyMatches,
    sortedMyParcels,
    sortedMyTrips,
    carrierTripsByParcelId,
    receiverRequestsByTripId,
  ]);

  // Auto-match counts = sum of nested matches under user listings; manual
  // filter counts = flat result length. Buddies is always flat.
  const isAutoMatch = !hasAppliedFilters && matchMyRoutes;
  const {
    packageTabCount, receiverTabCount, buddyTabCount, carrierPages, receiverPages, buddyPages,
    autoPkgPages, safeAutoPkgPage, pagedMyParcels, autoRcvPages, safeAutoRcvPage, pagedMyTrips,
    autoBuddyPages, safeAutoBuddyPage, pagedBuddyMatches,
  } = useSearchPaging({
    isAutoMatch, results, carrierTrips, carrierTripsByParcelId, receiverRequests,
    receiverRequestsByTripId, dedupedBuddyMatches, sortedMyParcels, sortedMyTrips, autoPkgPage,
    autoRcvPage, autoBuddyPage,
  });

  /** Switching a side's country invalidates that side's city, so clear it. */
  const toggleFromCountry = useCallback(() => {
    setFromCountry((c) => (c === "IN" ? "US" : "IN"));
    setFromCity("");
  }, []);
  const toggleToCountry = useCallback(() => {
    setToCountry((c) => (c === "IN" ? "US" : "IN"));
    setToCity("");
  }, []);

  const toggleLookingFor = useCallback((value: LookingForType) => {
    setLookingFor((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const handleApply = useCallback(async () => {
    setNotice(null);
    const hasAtLeastOne =
      Boolean(fromCity) ||
      Boolean(toCity) ||
      Boolean(dateFrom) ||
      Boolean(dateTo) ||
      lookingFor.length > 0;
    if (!hasAtLeastOne) {
      setNotice({
        title: "Choose at least one filter",
        message: "Pick a city, date, or category before searching.",
        variant: "warning",
      });
      return;
    }
    if (dateFrom && !ISO_DATE.test(dateFrom)) {
      setNotice({ title: "Invalid date", message: "From date must be YYYY-MM-DD.", variant: "error" });
      return;
    }
    if (dateTo && !ISO_DATE.test(dateTo)) {
      setNotice({ title: "Invalid date", message: "To date must be YYYY-MM-DD.", variant: "error" });
      return;
    }
    // A same-city route (Any excepted) can never match anything — block it, as
    // the create/edit forms do.
    if (isSameRoute(fromCountry, fromCity, toCountry, toCity)) {
      setNotice({
        title: "Pick different cities",
        message: "Origin and destination cities must be different.",
        variant: "error",
      });
      return;
    }

    const filters: SearchFilters = { per_page: MANUAL_PER_PAGE };
    if (fromCity) filters.from_city = fromCity;
    if (toCity) filters.to_city = toCity;
    // The country the cities were picked from. This is what bounds a listing that
    // ticked "Any City" - without it, such a listing answers every city filter.
    filters.from_country = fromCountry;
    filters.to_country = toCountry;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (lookingFor.length > 0) filters.looking_for = lookingFor.join(",");

    // Filtering no longer spends a daily unit - see web `CustomerSearch.tsx`.
    // Every listing is browsable and pageable for free now, so rationing the
    // filter that narrows them only pushed people into scrolling.
    setPkgPage(1);
    setRcvPage(1);
    setBuddyPage(1);
    setAppliedFilters(filters);
  }, [fromCity, toCity, fromCountry, toCountry, dateFrom, dateTo, lookingFor]);

  /** Switch between browsing everything and matching against my own routes. */
  const applyMode = useCallback(
    (next: boolean) => {
      setMatchMyRoutes(next);
      setAppliedFilters(null);
      setPkgPage(1);
      setRcvPage(1);
      setBuddyPage(1);
      setAutoPkgPage(1);
      setAutoRcvPage(1);
      setAutoBuddyPage(1);
      void setBaseQuery(next ? MATCH_MY_ROUTES_QUERY : BROWSE_QUERY);
    },
    [setBaseQuery],
  );

  const handleClear = useCallback(() => {
    setFromCity("");
    setToCity("");
    setDateFrom("");
    setDateTo("");
    setLookingFor([]);
    setAppliedFilters(null);
    setPkgPage(1);
    setRcvPage(1);
    setBuddyPage(1);
    setAutoPkgPage(1);
    setAutoRcvPage(1);
    setAutoBuddyPage(1);
    setNotice(null);
    void clearPersistedSearch();
    void resetToAutoMatch();
  }, [resetToAutoMatch]);

  // Pull-to-refresh: re-run the current query + the owned listings. Free.
  const refetchMyTrips = myTripsState.refetch;
  const refetchMyParcels = myParcelsState.refetch;
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchMyTrips(), refetchMyParcels()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchMyTrips, refetchMyParcels]);

  const hasActiveFilters = Boolean(
    fromCity || toCity || dateFrom || dateTo || lookingFor.length || appliedFilters,
  );
  const searchBusy = loading;

  return (
    <Screen scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.wordmark}
              colors={[colors.wordmark]}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Search & discover</Text>
            <Text style={styles.subtitle}>
              Find carriers, parcels, or travel buddies for your journey.
            </Text>
          </View>
          <PrimaryHeaderActions />
        </View>

        {notice ? (
          <View style={styles.bannerSlot}>
            <FormBanner
              title={notice.title ?? undefined}
              message={notice.message}
              variant={notice.variant}
              onDismiss={() => setNotice(null)}
            />
          </View>
        ) : null}

        <Card style={styles.filtersCard}>
          <SearchFilterFields
            loading={loading}
            fromCountry={fromCountry}
            toCountry={toCountry}
            fromCountryLabel={fromCountryLabel}
            toCountryLabel={toCountryLabel}
            toggleFromCountry={toggleFromCountry}
            toggleToCountry={toggleToCountry}
            fromCity={fromCity}
            setFromCity={setFromCity}
            toCity={toCity}
            setToCity={setToCity}
            fromCities={fromCities}
            toCities={toCities}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            dateBounds={dateBounds}
            lookingFor={lookingFor}
            toggleLookingFor={toggleLookingFor}
            hasActiveFilters={hasActiveFilters}
            handleClear={handleClear}
            searchBusy={searchBusy}
            handleApply={handleApply}
          />

          <View style={styles.modeToggleRow}>
            <Pressable
              onPress={() => applyMode(false)}
              accessibilityRole="button"
              accessibilityState={{ selected: !matchMyRoutes }}
              style={[styles.modeToggleButton, !matchMyRoutes && styles.modeToggleButtonActive]}
            >
              <Text style={[styles.modeToggleLabel, !matchMyRoutes && styles.modeToggleLabelActive]}>
                All listings
              </Text>
            </Pressable>
            <Pressable
              onPress={() => applyMode(true)}
              accessibilityRole="button"
              accessibilityState={{ selected: matchMyRoutes }}
              style={[styles.modeToggleButton, matchMyRoutes && styles.modeToggleButtonActive]}
            >
              <Text style={[styles.modeToggleLabel, matchMyRoutes && styles.modeToggleLabelActive]}>
                Matches for my routes
              </Text>
            </Pressable>
          </View>
          <Text style={styles.noteText}>
            {matchMyRoutes
              ? "Showing only listings that fit the trips and parcels you have posted."
              : "Showing everything posted on Safarly. Add filters above to narrow it down."}
          </Text>
        </Card>

        {hasAppliedFilters && appliedFilters ? (
          <AppliedFilterChips filters={appliedFilters} />
        ) : null}

        <SearchModeBanner
          hasAppliedFilters={hasAppliedFilters}
          activeTab={activeTab}
          myParcelsCount={results?.my_parcels_count ?? 0}
          myTripsCount={results?.my_trips_count ?? 0}
          myBuddyCount={results?.my_buddy_route_targets_count ?? results?.my_buddy_listings_count ?? 0}
        />

        <ResultTabs
          active={activeTab}
          onChange={setActiveTab}
          counts={{
            package: packageTabCount,
            buddy: buddyTabCount,
            receiver: receiverTabCount,
          }}
          loading={loading}
          hideCounts={!!error}
        />

        {error ? (
          <ErrorBlock message={getErrorMessage(error)} onRetry={() => void refetch()} />
        ) : activeTab === "package" ? (
          <PackageTabResults
            loading={loading}
            isAutoMatch={isAutoMatch}
            myParcels={isAutoMatch ? pagedMyParcels : sortedMyParcels}
            myParcelsLoading={myParcelsState.loading}
            myParcelsError={myParcelsState.error}
            onRetryMyParcels={() => void refetchMyParcels()}
            matches={displayCarrierTrips}
            matchesByParcelId={carrierTripsByParcelId}
            navigation={navigation}
            highlightId={highlightId}
          />
        ) : activeTab === "buddy" ? (
          <BuddyTabResults
            loading={loading}
            matches={isAutoMatch ? pagedBuddyMatches : dedupedBuddyMatches}
            navigation={navigation}
            highlightId={highlightId}
          />
        ) : (
          <ReceiverTabResults
            loading={loading}
            isAutoMatch={isAutoMatch}
            myTrips={isAutoMatch ? pagedMyTrips : sortedMyTrips}
            myTripsLoading={myTripsState.loading}
            myTripsError={myTripsState.error}
            onRetryMyTrips={() => void refetchMyTrips()}
            matches={displayReceiverRequests}
            matchesByTripId={receiverRequestsByTripId}
            navigation={navigation}
            highlightId={highlightId}
          />
        )}

        {!error ? (
          <Pagination
            page={
              isAutoMatch
                ? activeTab === "package"
                  ? safeAutoPkgPage
                  : activeTab === "buddy"
                    ? safeAutoBuddyPage
                    : safeAutoRcvPage
                : activeTab === "package"
                  ? pkgPage
                  : activeTab === "buddy"
                    ? buddyPage
                    : rcvPage
            }
            totalPages={
              isAutoMatch
                ? activeTab === "package"
                  ? autoPkgPages
                  : activeTab === "buddy"
                    ? autoBuddyPages
                    : autoRcvPages
                : activeTab === "package"
                  ? carrierPages
                  : activeTab === "buddy"
                    ? buddyPages
                    : receiverPages
            }
            loading={searchBusy}
            onChange={(next) => {
              if (isAutoMatch) {
                if (activeTab === "package") setAutoPkgPage(next);
                else if (activeTab === "buddy") setAutoBuddyPage(next);
                else setAutoRcvPage(next);
              } else if (activeTab === "package") setPkgPage(next);
              else if (activeTab === "buddy") setBuddyPage(next);
              else setRcvPage(next);
            }}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

// PackageTabResults, BuddyTabResults and BuddyMatchCard's actions stay in this
// file on purpose: `npm run check:ux` pins the carriers empty-state copy and
// `buddiesApi.sendRequest` / `handleConnect` to SearchScreen.tsx, and
// cardFeedback.test.ts fences the card actions. Everything else lives in
// ./components, ./hooks and ./lib.

// ───────────────────────── Tab bodies ─────────────────────────

function PackageTabResults({
  loading,
  isAutoMatch,
  myParcels,
  myParcelsLoading,
  myParcelsError,
  onRetryMyParcels,
  matches,
  matchesByParcelId,
  navigation,
  highlightId,
}: Readonly<{
  loading: boolean;
  isAutoMatch: boolean;
  myParcels: Parcel[];
  myParcelsLoading: boolean;
  /** Loading YOUR parcels failed: say so, rather than "No parcel listings". */
  myParcelsError: unknown;
  onRetryMyParcels: () => void;
  matches: PackageMatch[];
  /** Pre-filtered per-parcel match lists (same source as the tab count). */
  matchesByParcelId: Map<string, PackageMatch[]>;
  navigation: Nav;
  highlightId?: string;
}>) {
  if (isAutoMatch) {
    if (myParcelsLoading && myParcels.length === 0)
      return (
        <View>
          <MyListingSkeleton />
          <MyListingSkeleton />
        </View>
      );
    if (myParcelsError && myParcels.length === 0)
      return <ErrorBlock message={getErrorMessage(myParcelsError)} onRetry={onRetryMyParcels} />;
    if (myParcels.length === 0)
      return (
        <EmptyResults
          icon="cube-outline"
          title="No parcel listings"
          body="Create a parcel request to see matching carriers on your route."
        />
      );
    return (
      <View>
        {myParcels.map((parcel) => {
          const matched = matchesByParcelId.get(parcel.id) ?? [];
          return (
            <RouteListingCard
              key={parcel.id}
              fromCity={parcel.from_city}
              toCity={parcel.to_city}
              kind="parcel"
              dateLabel={formatDeliveryWindow(parcel, { year: true })}
              secondary={
                parcel.category
                  ? { label: "CATEGORY", value: parcel.category }
                  : undefined
              }
            >
              {loading ? (
                <MatchCardSkeleton />
              ) : matched.length === 0 ? (
                <Text style={sharedStyles.nestedEmpty}>
                  No matching carriers yet for this route or date.
                </Text>
              ) : (
                <View>
                  <Text style={sharedStyles.nestedHeading}>CARRIER TRIPS</Text>
                  {matched.map((m, i) => (
                    <View
                      key={`${m.type}-${m.id}`}
                      style={i > 0 ? sharedStyles.nestedDivider : undefined}
                    >
                      <PackageMatchCard
                        match={m}
                        navigation={navigation}
                        nested
                        highlighted={m.id === highlightId}
                      />
                    </View>
                  ))}
                </View>
              )}
            </RouteListingCard>
          );
        })}
      </View>
    );
  }

  if (loading && matches.length === 0) return <MatchListSkeleton />;
  if (matches.length === 0)
    return (
      <EmptyResults
        icon="cube-outline"
        title="No matching carrier trips"
        body="Try widening your filters or date range."
      />
    );
  return (
    <View>
      {matches.map((m) => (
        <PackageMatchCard
          key={`${m.type}-${m.id}`}
          match={m}
          navigation={navigation}
          highlighted={m.id === highlightId}
        />
      ))}
    </View>
  );
}

function BuddyTabResults({
  loading,
  matches,
  navigation,
  highlightId,
}: Readonly<{
  loading: boolean;
  matches: BuddySearchMatch[];
  navigation: Nav;
  highlightId?: string;
}>) {
  if (loading && matches.length === 0) return <MatchListSkeleton />;
  if (matches.length === 0)
    return (
      <EmptyResults
        icon="people-outline"
        title="No travel buddy matches"
        body="Try adjusting your filters."
      />
    );
  return (
    <View>
      {matches.map((b) => (
        <BuddyMatchCard
          key={b.id}
          match={b}
          navigation={navigation}
          highlighted={b.id === highlightId}
        />
      ))}
    </View>
  );
}

function BuddyMatchCard({
  match,
  navigation,
  highlighted,
}: Readonly<{
  match: BuddySearchMatch;
  navigation: Nav;
  /** Deep-link highlight (web parity: the `?match=` ring). */
  highlighted?: boolean;
}>) {
  const dateFrom = match.travel_date_from || match.travel_date;
  const dateTo = match.travel_date_to || match.travel_date;
  const dateLabel =
    dateFrom === dateTo
      ? formatDateLabel(dateFrom)
      : `${formatDateLabel(dateFrom)} – ${formatDateLabel(dateTo)}`;

  // Connect is the point of a travel-buddy match, and until now there was no way
  // to do it on either platform: `buddiesApi.sendRequest` existed, and the whole
  // request -> accept -> connection -> two-tap completion -> rating chain was
  // built and deployed behind it, but nothing ever called it. Production had 0
  // buddy requests, 0 connections and 0 buddy ratings against 12 delivery
  // ratings. Chat was all a buddy match offered, and a chat creates no
  // connection - so journey completion and reviews were unreachable.
  const [connecting, setConnecting] = useState(false);
  const handleConnect = useCallback(async () => {
    if (!match.id || connecting) return;
    setConnecting(true);
    try {
      await buddiesApi.sendRequest(match.id);
      showToast({
        title: "Buddy request sent",
        message: `${match.user?.name ?? "They"} will see it in My travels → Partners.`,
        variant: "success",
      });
    } catch (err) {
      // The server already explains the ordinary refusals in plain words -
      // already connected, already sent, or they sent you one first.
      showToast({ title: "Couldn't send request", message: getErrorMessage(err), variant: "error" });
    } finally {
      setConnecting(false);
    }
  }, [match.id, match.user?.name, connecting]);

  const details: { label: string; value: string }[] = [
    ...(match.age != null ? [{ label: "AGE", value: `${match.age} yrs` }] : []),
    ...(match.languages?.length
      ? [{ label: "LANGUAGES", value: match.languages.slice(0, 3).join(", ") }]
      : []),
    ...(match.layover ? [{ label: "LAYOVER", value: match.layover }] : []),
  ];

  const [chatStarting, setChatStarting] = useState(false);

  const handleViewProfile = useCallback(() => {
    if (!match.user?.id) {
      showToast({
        title: "User unavailable",
        message: "Unable to open profile — user not available.",
        variant: "error",
      });
      return;
    }
    navigation.navigate("PublicProfileTab", {
      userId: match.user.id,
      name: match.user.name ?? undefined,
    });
  }, [match.user?.id, match.user?.name, navigation]);

  const handleStartChat = useCallback(async () => {
    if (!match.user?.id) {
      showToast({
        title: "User unavailable",
        message: "Unable to start chat — user not available.",
        variant: "error",
      });
      return;
    }
    setChatStarting(true);
    try {
      const res = await messagesApi.createConversation(match.user.id, "buddy");
      navigation.navigate("OfferChatTab", {
        conversationId: res.data.id,
        name: match.user.name || "Travel buddy",
        source: "buddies",
      });
    } catch (err) {
      showToast({ title: "Couldn't start chat", message: getErrorMessage(err), variant: "error" });
    } finally {
      setChatStarting(false);
    }
  }, [match.user?.id, match.user?.name, navigation]);

  return (
    <BuddyMatchCardBody
      match={match}
      highlighted={highlighted}
      dateLabel={dateLabel}
      details={details}
      connecting={connecting}
      handleConnect={handleConnect}
      handleViewProfile={handleViewProfile}
      chatStarting={chatStarting}
      handleStartChat={handleStartChat}
    />
  );
}
