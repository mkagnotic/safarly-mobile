import { memo, useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/feedback/appFeedback";
import { CityPicker } from "@/features/search/CityPicker";
import {
  citiesForDirection,
  countryLabelForDirection,
  type Direction,
} from "@/features/search/cityLists";
import { RouteListingCard } from "@/features/search/RouteListingCard";
import { useParcels } from "@/hooks/api/useParcels";
import { useSearchMatches } from "@/hooks/api/useSearchMatches";
import { useTrips } from "@/hooks/api/useTrips";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import {
  getErrorMessage,
  type BuddySearchMatch,
  type PackageMatch,
  type Parcel,
  type SearchFilters,
  type Trip,
} from "@/services/api";
import { colors } from "@/theme/colors";
import { carrierTripMatchesParcel, parcelMatchesTrip } from "@/utils/routeMatch";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

type LookingForType = "travel_buddy" | "carrier" | "receive_request";
type ResultsTab = "package" | "buddy" | "receiver";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface LookingForOption {
  value: LookingForType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const LOOKING_FOR_OPTIONS: readonly LookingForOption[] = [
  { value: "travel_buddy", label: "Travel Buddy", icon: "people-outline" },
  { value: "carrier", label: "Carrier", icon: "car-sport" },
  { value: "receive_request", label: "Receive Request", icon: "mail-outline" },
] as const;

function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Single-day trip range "Apr 18, 2026 – Apr 18, 2026" — matches web's RouteListingCard. */
function formatTripDateRange(iso: string | null | undefined): string {
  if (!iso) return "—";
  const f = formatDateLabel(iso);
  return `${f} – ${f}`;
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function SearchScreen() {
  const navigation = useNavigation<Nav>();

  // Filter state
  const [direction, setDirection] = useState<Direction>("IN_TO_US");
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [lookingFor, setLookingFor] = useState<LookingForType[]>([]);
  const [activeTab, setActiveTab] = useState<ResultsTab>("package");

  // Auto-match on mount: hook fires `{ per_page: 50, match_my_routes: true }`
  // so the result tabs render with data before the user touches a filter.
  const { results, loading, error, hasAppliedFilters, search, refetch } = useSearchMatches();

  // For auto-match, web groups search results by the user's own listings:
  //   Packages tab    → one card per `my_parcels` (matched carriers nested)
  //   Receivers tab   → one card per `my_trips` (matched receivers nested)
  // We fetch both lists at high per_page to mirror that — `useTrips`/`useParcels`
  // already cache their own state, so this isn't a duplicate fetch with `MyTravels`.
  const myTripsState = useTrips({ filter: "my_trips", perPage: 100 });
  const myParcelsState = useParcels({ filter: "my_parcels", perPage: 100 });

  const fromCities = citiesForDirection(direction, "from");
  const toCities = citiesForDirection(direction, "to");
  const fromCountry = countryLabelForDirection(direction, "from");
  const toCountry = countryLabelForDirection(direction, "to");

  const carrierTrips = useMemo(
    () => (results?.package_matches ?? []).filter((m) => m.type === "carrier_trip"),
    [results],
  );
  const receiverRequests = useMemo(
    () => (results?.package_matches ?? []).filter((m) => m.type === "receive_request"),
    [results],
  );
  const buddyMatches = results?.buddy_matches ?? [];

  // Web filters to active statuses + sorts by date — port both.
  const sortedMyParcels: Parcel[] = useMemo(
    () =>
      myParcelsState.parcels
        .filter((p) => p.status === "open" || p.status === "looking_for_match")
        .sort((a, b) => (a.delivery_by ?? "").localeCompare(b.delivery_by ?? "")),
    [myParcelsState.parcels],
  );
  const sortedMyTrips: Trip[] = useMemo(
    () =>
      myTripsState.trips
        .filter((t) => t.status === "active" || t.status === "looking_for_match")
        .sort((a, b) => a.travel_date.localeCompare(b.travel_date)),
    [myTripsState.trips],
  );

  const handleSwapDirection = useCallback(() => {
    setDirection((d) => (d === "IN_TO_US" ? "US_TO_IN" : "IN_TO_US"));
    setFromCity("");
    setToCity("");
  }, []);

  const toggleLookingFor = useCallback((value: LookingForType) => {
    setLookingFor((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const handleApply = useCallback(async () => {
    const hasAtLeastOne =
      Boolean(fromCity) ||
      Boolean(toCity) ||
      Boolean(dateFrom) ||
      Boolean(dateTo) ||
      lookingFor.length > 0;
    if (!hasAtLeastOne) {
      showToast({
        title: "Choose at least one filter",
        message: "Pick a city, date, or category before searching.",
        variant: "warning",
      });
      return;
    }
    if (dateFrom && !ISO_DATE.test(dateFrom)) {
      showToast({ title: "Invalid date", message: "From date must be YYYY-MM-DD.", variant: "error" });
      return;
    }
    if (dateTo && !ISO_DATE.test(dateTo)) {
      showToast({ title: "Invalid date", message: "To date must be YYYY-MM-DD.", variant: "error" });
      return;
    }

    const filters: SearchFilters = { per_page: 50 };
    if (fromCity) filters.from_city = fromCity;
    if (toCity) filters.to_city = toCity;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (lookingFor.length > 0) filters.looking_for = lookingFor.join(",");

    try {
      await search(filters);
    } catch {
      // Errors are already surfaced via the hook's error state.
    }
  }, [fromCity, toCity, dateFrom, dateTo, lookingFor, search]);

  return (
    <Screen scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ───────── Header ───────── */}
        <View style={styles.header}>
          <Text style={styles.title}>Search & Discover</Text>
          <Text style={styles.subtitle}>
            Find carriers, parcels, or travel buddies for your journey
          </Text>
        </View>

        {/* ───────── Filters ───────── */}
        <Card style={styles.filtersCard}>
          {/* Route */}
          <Text style={styles.fieldLabel}>ROUTE</Text>
          <View style={styles.routeRow}>
            <CityPicker
              value={fromCity}
              onChange={setFromCity}
              cities={fromCities}
              placeholder={`From (${fromCountry})`}
              disabled={loading}
            />
            <Pressable
              style={styles.swapButton}
              onPress={handleSwapDirection}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Swap direction"
            >
              <Ionicons name="swap-vertical-outline" size={16} color={colors.primary} />
            </Pressable>
            <CityPicker
              value={toCity}
              onChange={setToCity}
              cities={toCities}
              placeholder={`To (${toCountry})`}
              disabled={loading}
            />
          </View>

          {/* Date Range */}
          <Text style={[styles.fieldLabel, styles.fieldLabelTopGap]}>DATE RANGE</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateInputWrap}>
              <TextInput
                value={dateFrom}
                onChangeText={setDateFrom}
                style={styles.dateInput}
                placeholder="From (YYYY-MM-DD)"
                placeholderTextColor={colors.subtleText}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                maxLength={10}
              />
            </View>
            <View style={styles.dateInputWrap}>
              <TextInput
                value={dateTo}
                onChangeText={setDateTo}
                style={styles.dateInput}
                placeholder="To (YYYY-MM-DD)"
                placeholderTextColor={colors.subtleText}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                maxLength={10}
              />
            </View>
          </View>

          {/* Looking For */}
          <Text style={[styles.fieldLabel, styles.fieldLabelTopGap]}>LOOKING FOR</Text>
          <View style={styles.lookingForCol}>
            {LOOKING_FOR_OPTIONS.map((opt) => {
              const checked = lookingFor.includes(opt.value);
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => toggleLookingFor(opt.value)}
                  style={styles.checkboxRow}
                  disabled={loading}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked ? <Ionicons name="checkmark" size={12} color={colors.white} /> : null}
                  </View>
                  <Ionicons name={opt.icon} size={16} color={colors.primary} />
                  <Text style={styles.checkboxLabel}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Apply */}
          <Pressable
            style={[styles.applyButton, loading && styles.applyButtonDisabled]}
            onPress={() => void handleApply()}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Apply filters and search"
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="search-outline" size={16} color={colors.white} />
                <Text style={styles.applyButtonText}>Apply Filters & Search</Text>
              </>
            )}
          </Pressable>

          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={12} color={colors.mutedText} />
            <Text style={styles.noteText}>
              Max 3 searches per day. Use filters wisely for best results.
            </Text>
          </View>
        </Card>

        {/* ───────── Auto-match / applied-filters banner ───────── */}
        <SearchModeBanner
          hasAppliedFilters={hasAppliedFilters}
          activeTab={activeTab}
          myParcelsCount={results?.my_parcels_count ?? 0}
          myTripsCount={results?.my_trips_count ?? 0}
          myBuddyCount={results?.my_buddy_route_targets_count ?? results?.my_buddy_listings_count ?? 0}
        />

        {/* ───────── Result tabs (always visible, like web) ───────── */}
        <ResultTabs
          active={activeTab}
          onChange={setActiveTab}
          counts={{
            package: carrierTrips.length,
            buddy: buddyMatches.length,
            receiver: receiverRequests.length,
          }}
          loading={loading}
        />

        {error ? (
          <ErrorBlock message={getErrorMessage(error)} onRetry={() => void refetch()} />
        ) : activeTab === "package" ? (
          <PackageTabResults
            loading={loading}
            isAutoMatch={!hasAppliedFilters}
            myParcels={sortedMyParcels}
            myParcelsLoading={myParcelsState.loading}
            matches={carrierTrips}
            navigation={navigation}
          />
        ) : activeTab === "buddy" ? (
          <BuddyTabResults
            loading={loading}
            matches={buddyMatches}
            navigation={navigation}
          />
        ) : (
          <ReceiverTabResults
            loading={loading}
            isAutoMatch={!hasAppliedFilters}
            myTrips={sortedMyTrips}
            myTripsLoading={myTripsState.loading}
            matches={receiverRequests}
            navigation={navigation}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

// ───────────────────────── Result tabs ─────────────────────────

interface ResultTabsProps {
  active: ResultsTab;
  onChange: (tab: ResultsTab) => void;
  counts: { package: number; buddy: number; receiver: number };
  loading: boolean;
}

const ResultTabs = memo(function ResultTabs({
  active,
  onChange,
  counts,
  loading,
}: Readonly<ResultTabsProps>) {
  const tabs: readonly { key: ResultsTab; label: string; count: number; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { key: "package", label: "Packages", count: counts.package, icon: "cube-outline", color: colors.primary },
    { key: "buddy", label: "Buddies", count: counts.buddy, icon: "people-outline", color: colors.safe },
    { key: "receiver", label: "Receivers", count: counts.receiver, icon: "mail-outline", color: colors.warning },
  ];
  return (
    <View style={styles.tabsRow}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, isActive && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons name={tab.icon} size={14} color={tab.color} />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {loading ? (
              <ActivityIndicator size="small" color={colors.mutedText} />
            ) : (
              <Text style={styles.tabCount}>({tab.count})</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
});

// ───────────────────────── Tab bodies ─────────────────────────

function PackageTabResults({
  loading,
  isAutoMatch,
  myParcels,
  myParcelsLoading,
  matches,
  navigation,
}: Readonly<{
  loading: boolean;
  isAutoMatch: boolean;
  myParcels: Parcel[];
  myParcelsLoading: boolean;
  matches: PackageMatch[];
  navigation: Nav;
}>) {
  // Auto-match mode (web parity): one route card per user parcel, with
  // matching carrier trips nested inside. Web's `sortedMyParcels.map(...)`.
  if (isAutoMatch) {
    if (myParcelsLoading && myParcels.length === 0)
      return <CenteredSpinner label="Loading your parcel requests…" />;
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
          const matched = loading
            ? []
            : matches.filter((m) =>
                carrierTripMatchesParcel(
                  {
                    from_city: m.from_city,
                    to_city: m.to_city,
                    any_from: m.any_from,
                    any_to: m.any_to,
                    travel_date: m.travel_date,
                  },
                  parcel,
                ),
              );
          return (
            <RouteListingCard
              key={parcel.id}
              title={`${parcel.from_city} → ${parcel.to_city}`}
              dateLabel={formatTripDateRange(parcel.delivery_by)}
              metaRight={parcel.category ? `Parcel · ${parcel.category}` : "Parcel request"}
            >
              {loading ? (
                <CenteredSpinner label="Searching carrier trips…" small />
              ) : matched.length === 0 ? (
                <Text style={styles.nestedEmpty}>
                  No matched carriers yet for this route/date.
                </Text>
              ) : (
                <View>
                  <Text style={styles.nestedHeading}>CARRIER TRIPS</Text>
                  {matched.map((m) => (
                    <PackageMatchCard
                      key={`${m.type}-${m.id}`}
                      match={m}
                      metaRight="Carrier trip"
                      navigation={navigation}
                    />
                  ))}
                </View>
              )}
            </RouteListingCard>
          );
        })}
      </View>
    );
  }

  // Manual filter mode — flat list of carrier trips (web also flat in this mode).
  if (loading && matches.length === 0)
    return <CenteredSpinner label="Searching carrier trips…" />;
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
          metaRight="Carrier trip"
          navigation={navigation}
        />
      ))}
    </View>
  );
}

function BuddyTabResults({
  loading,
  matches,
  navigation,
}: Readonly<{
  loading: boolean;
  matches: BuddySearchMatch[];
  navigation: Nav;
}>) {
  if (loading && matches.length === 0)
    return <CenteredSpinner label="Searching travel buddies…" />;
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
        <BuddyMatchCard key={b.id} match={b} navigation={navigation} />
      ))}
    </View>
  );
}

function ReceiverTabResults({
  loading,
  isAutoMatch,
  myTrips,
  myTripsLoading,
  matches,
  navigation,
}: Readonly<{
  loading: boolean;
  isAutoMatch: boolean;
  myTrips: Trip[];
  myTripsLoading: boolean;
  matches: PackageMatch[];
  navigation: Nav;
}>) {
  // Auto-match mode (web parity): one route card per user trip, with
  // matching receive_requests nested inside. Web's `sortedMyTrips.map(...)`.
  if (isAutoMatch) {
    if (myTripsLoading && myTrips.length === 0)
      return <CenteredSpinner label="Loading your trips…" />;
    if (myTrips.length === 0)
      return (
        <EmptyResults
          icon="mail-outline"
          title="No trips listed"
          body="List a trip to see receiver requests on your route."
        />
      );
    return (
      <View>
        {myTrips.map((trip) => {
          const matched = loading
            ? []
            : matches.filter((m) =>
                m.delivery_by != null &&
                parcelMatchesTrip(
                  {
                    from_city: m.from_city,
                    to_city: m.to_city,
                    any_from: m.any_from,
                    any_to: m.any_to,
                    delivery_by: m.delivery_by,
                  },
                  trip,
                ),
              );
          return (
            <RouteListingCard
              key={trip.id}
              title={`${trip.from_city} → ${trip.to_city}`}
              dateLabel={formatTripDateRange(trip.travel_date)}
              airline={trip.airline}
              metaRight="Your trip"
            >
              {loading ? (
                <CenteredSpinner label="Searching receiver requests…" small />
              ) : matched.length === 0 ? (
                <Text style={styles.nestedEmpty}>
                  No receiver requests yet for this route/date.
                </Text>
              ) : (
                <View>
                  <Text style={styles.nestedHeading}>RECEIVER REQUESTS</Text>
                  {matched.map((m) => (
                    <PackageMatchCard
                      key={`${m.type}-${m.id}`}
                      match={m}
                      metaRight="Receive request"
                      navigation={navigation}
                    />
                  ))}
                </View>
              )}
            </RouteListingCard>
          );
        })}
      </View>
    );
  }

  // Manual filter mode — flat list (matches web).
  if (loading && matches.length === 0)
    return <CenteredSpinner label="Searching receiver requests…" />;
  if (matches.length === 0)
    return (
      <EmptyResults
        icon="mail-outline"
        title="No receiver requests"
        body="Try widening your filters or date range."
      />
    );
  return (
    <View>
      {matches.map((m) => (
        <PackageMatchCard
          key={`${m.type}-${m.id}`}
          match={m}
          metaRight="Receive request"
          navigation={navigation}
        />
      ))}
    </View>
  );
}

// ───────────────────────── Cards ─────────────────────────

function PackageMatchCard({
  match,
  metaRight,
  navigation,
}: Readonly<{ match: PackageMatch; metaRight: string; navigation: Nav }>) {
  const isTrip = match.type === "carrier_trip";
  const person = isTrip ? match.carrier : match.sender;
  const dateLabel = isTrip
    ? formatDateLabel(match.travel_date)
    : formatDateLabel(match.delivery_by);

  const handleStartChat = useCallback(() => {
    if (!person?.id) {
      showToast({ title: "User not available", variant: "error" });
      return;
    }
    // Navigate to messages — actual createConversation happens in the chat screen
    // when MessagesScreen is wired in a follow-up.
    navigation.navigate("MessagesTab");
  }, [person?.id, navigation]);

  return (
    <Card style={styles.matchCard}>
      <View style={styles.matchTitleRow}>
        <Text style={styles.matchRoute}>
          {match.from_city} → {match.to_city}
        </Text>
        <Text style={styles.metaRight}>{metaRight}</Text>
      </View>
      <View style={styles.matchMeta}>
        <Ionicons name="calendar-outline" size={13} color={colors.mutedText} />
        <Text style={styles.matchMetaText}>{dateLabel}</Text>
        {isTrip && match.airline ? (
          <>
            <Text style={styles.metaSep}>·</Text>
            <Ionicons name="airplane-outline" size={13} color={colors.mutedText} />
            <Text style={styles.matchMetaText}>{match.airline}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.divider} />

      <View style={styles.personRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(person?.name)}</Text>
        </View>
        <View style={styles.personInfo}>
          <Text style={styles.personName} numberOfLines={2}>
            {person?.name || "Unknown user"}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color={colors.warning} />
            <Text style={styles.ratingText}>
              {person?.rating && person.rating > 0
                ? `${person.rating.toFixed(1)} rating`
                : "New"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.matchSubmeta}>
        {isTrip ? (
          <View style={styles.submetaItem}>
            <Ionicons name="cube-outline" size={13} color={colors.primary} />
            <Text style={styles.submetaText}>
              {match.luggage_capacity_kg != null
                ? `${match.luggage_capacity_kg} kg capacity`
                : "Carrier"}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.submetaItem}>
              <Ionicons name="cube-outline" size={13} color={colors.primary} />
              <Text style={styles.submetaText}>{match.category?.trim() || "anything"}</Text>
            </View>
            <View style={styles.submetaItem}>
              <Ionicons name="cash-outline" size={13} color={colors.safe} />
              <Text style={styles.submetaText}>
                USD ${match.fee_offered ?? "—"}
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, styles.secondaryAction]}
          onPress={() => showToast({ title: "Profile coming soon", variant: "info" })}
          accessibilityRole="button"
          accessibilityLabel="View profile"
        >
          <Ionicons name="person-outline" size={13} color={colors.text} />
          <Text style={styles.actionButtonText}>VIEW PROFILE</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.primaryAction]}
          onPress={handleStartChat}
          accessibilityRole="button"
          accessibilityLabel="Start chat"
        >
          <Ionicons name="chatbubble-outline" size={13} color={colors.white} />
          <Text style={[styles.actionButtonText, styles.primaryActionText]}>
            START CHAT
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

function BuddyMatchCard({
  match,
  navigation,
}: Readonly<{ match: BuddySearchMatch; navigation: Nav }>) {
  const dateFrom = match.travel_date_from || match.travel_date;
  const dateTo = match.travel_date_to || match.travel_date;
  const dateLabel =
    dateFrom === dateTo
      ? formatDateLabel(dateFrom)
      : `${formatDateLabel(dateFrom)} – ${formatDateLabel(dateTo)}`;

  const details: { label: string; value: string }[] = [
    ...(match.airline ? [{ label: "Airline", value: match.airline }] : []),
    ...(match.age != null ? [{ label: "Age", value: `${match.age} yrs` }] : []),
    ...(match.languages?.length
      ? [{ label: "Languages", value: match.languages.slice(0, 3).join(", ") }]
      : []),
    ...(match.layover ? [{ label: "Layover", value: match.layover }] : []),
  ];

  const handleStartChat = useCallback(() => {
    if (!match.user?.id) {
      showToast({ title: "User not available", variant: "error" });
      return;
    }
    navigation.navigate("MessagesTab");
  }, [match.user?.id, navigation]);

  return (
    <Card style={styles.matchCard}>
      <View style={styles.personRow}>
        <View style={[styles.avatar, styles.avatarLarger]}>
          <Text style={styles.avatarText}>{getInitials(match.user?.name)}</Text>
        </View>
        <View style={styles.personInfo}>
          <View style={styles.buddyTitleRow}>
            <Text style={styles.personName} numberOfLines={2}>
              {match.user?.name || "Travel buddy"}
            </Text>
            <View style={[styles.badge, styles.badgeSafe]}>
              <Text style={styles.badgeText}>BUDDY</Text>
            </View>
          </View>
          <View style={styles.ratingRow}>
            {match.user?.rating && match.user.rating > 0 ? (
              <>
                <Ionicons name="star" size={12} color={colors.warning} />
                <Text style={styles.ratingText}>
                  {match.user.rating.toFixed(1)} rating
                </Text>
              </>
            ) : (
              <Text style={styles.ratingText}>⭐ New member</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.travelDetailsBlock}>
        <View style={styles.travelLabelRow}>
          <Ionicons name="airplane-outline" size={11} color={colors.primary} />
          <Text style={styles.travelLabel}>TRAVEL DETAILS</Text>
        </View>
        <View style={styles.routeMetaRow}>
          <Ionicons name="location-outline" size={13} color={colors.primary} />
          <Text style={styles.routeMetaText} numberOfLines={2}>
            {match.from_city}
          </Text>
          <Ionicons name="arrow-forward" size={12} color={colors.mutedText} />
          <Text style={styles.routeMetaText} numberOfLines={2}>
            {match.to_city}
          </Text>
        </View>
        <View style={styles.routeMetaRow}>
          <Ionicons name="calendar-outline" size={12} color={colors.mutedText} />
          <Text style={styles.dateMetaText}>{dateLabel}</Text>
        </View>
        {details.length > 0 ? (
          <View style={styles.detailsGrid}>
            {details.map((d) => (
              <View key={d.label} style={styles.detailItem}>
                <Text style={styles.detailLabel}>{d.label.toUpperCase()}</Text>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {d.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {match.bio ? (
          <Text style={styles.bioText} numberOfLines={2}>
            {match.bio}
          </Text>
        ) : null}
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, styles.secondaryAction]}
          onPress={() => showToast({ title: "Profile coming soon", variant: "info" })}
          accessibilityRole="button"
          accessibilityLabel="View profile"
        >
          <Ionicons name="person-outline" size={13} color={colors.text} />
          <Text style={styles.actionButtonText}>VIEW PROFILE</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.primaryAction]}
          onPress={handleStartChat}
          accessibilityRole="button"
          accessibilityLabel="Start chat"
        >
          <Ionicons name="chatbubble-outline" size={13} color={colors.white} />
          <Text style={[styles.actionButtonText, styles.primaryActionText]}>
            START CHAT
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

// ───────────────────────── Reusable bits ─────────────────────────

interface SearchModeBannerProps {
  hasAppliedFilters: boolean;
  activeTab: ResultsTab;
  myParcelsCount: number;
  myTripsCount: number;
  myBuddyCount: number;
}

/**
 * Mirrors the small per-tab info paragraph web shows above each result tab
 * when in auto-match mode. Hidden once the user applies explicit filters
 * (handled elsewhere via the filter chips list — TODO when we add chips).
 */
function SearchModeBanner({
  hasAppliedFilters,
  activeTab,
  myParcelsCount,
  myTripsCount,
  myBuddyCount,
}: Readonly<SearchModeBannerProps>) {
  if (hasAppliedFilters) return null;

  let body: string | null = null;
  if (activeTab === "package") {
    body =
      myParcelsCount > 0
        ? `Showing carrier trips matching your ${myParcelsCount} active parcel request${myParcelsCount === 1 ? "" : "s"} (route + date).`
        : "List a parcel request to auto-see carriers on your route.";
  } else if (activeTab === "buddy") {
    body =
      myBuddyCount > 0
        ? `Showing buddies matching your ${myBuddyCount} route${myBuddyCount === 1 ? "" : "s"} (same route + travel date).`
        : "Create a buddy listing or enable Travel Buddy on a trip to auto-see companions.";
  } else {
    body =
      myTripsCount > 0
        ? `Showing receiver requests matching your ${myTripsCount} active trip${myTripsCount === 1 ? "" : "s"} (route + delivery date).`
        : "List a trip to auto-see receiver requests on your route.";
  }

  return (
    <View style={styles.banner}>
      <Ionicons name="information-circle-outline" size={13} color={colors.mutedText} />
      <Text style={styles.bannerText}>{body}</Text>
    </View>
  );
}

function CenteredSpinner({
  label,
  small,
}: Readonly<{ label: string; small?: boolean }>) {
  return (
    <View style={[styles.centered, small && styles.centeredSmall]}>
      <ActivityIndicator size={small ? "small" : "large"} color={colors.primary} />
      <Text style={styles.centeredText}>{label}</Text>
    </View>
  );
}

function ErrorBlock({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry?: () => void }>) {
  return (
    <View style={styles.centered}>
      <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
      <Text style={styles.errorTitle}>Search failed</Text>
      <Text style={styles.errorBody}>{message}</Text>
      {onRetry ? (
        <Pressable
          style={styles.retryButton}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface EmptyResultsProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

function EmptyResults({ icon, title, body }: Readonly<EmptyResultsProps>) {
  return (
    <View style={styles.emptyResults}>
      <View style={styles.emptyIconBox}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },

  header: { marginTop: 8, marginBottom: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 13, marginTop: 4, fontWeight: "500" },

  // Filters
  filtersCard: { gap: 12, padding: 16, marginBottom: 20 },
  fieldLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  fieldLabelTopGap: { marginTop: 8 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 122, 38, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  dateRow: { flexDirection: "row", gap: 8 },
  dateInputWrap: { flex: 1 },
  dateInput: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    fontWeight: "500",
  },
  lookingForCol: { gap: 10, marginTop: 2 },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.controlOutline,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    marginTop: 12,
  },
  applyButtonDisabled: { opacity: 0.7 },
  applyButtonText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  note: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 },
  noteText: { color: colors.mutedText, fontSize: 11, textAlign: "center" },

  // Tabs
  tabsRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  tabActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabLabel: { color: colors.mutedText, fontSize: 12, fontWeight: "700" },
  tabLabelActive: { color: colors.text },
  tabCount: { color: colors.mutedText, fontSize: 11, fontWeight: "600" },

  // Auto-match info banner above the result tabs
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  bannerText: {
    color: colors.mutedText,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },

  // Loading / error / empty
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  centeredSmall: { paddingVertical: 16 },
  centeredText: { color: colors.mutedText, fontSize: 13, fontWeight: "500" },

  // Nested matches inside a RouteListingCard
  nestedEmpty: { color: colors.mutedText, fontSize: 13, fontStyle: "italic", paddingVertical: 4 },
  nestedHeading: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  errorTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  errorBody: { color: colors.mutedText, fontSize: 12, textAlign: "center", maxWidth: 280 },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  retryButtonText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  emptyResults: { alignItems: "center", paddingVertical: 36, gap: 8 },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 4 },
  emptyBody: { color: colors.mutedText, fontSize: 12, textAlign: "center", maxWidth: 300 },

  // Match card
  matchCard: { padding: 14, marginBottom: 12, gap: 12 },
  matchTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  matchRoute: { color: colors.text, fontSize: 15, fontWeight: "800", flex: 1 },
  metaRight: { color: colors.mutedText, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  matchMeta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  matchMetaText: { color: colors.mutedText, fontSize: 13 },
  metaSep: { color: colors.mutedText, fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  personRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 122, 38, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLarger: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  personInfo: { flex: 1, minWidth: 0 },
  personName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingText: { color: colors.mutedText, fontSize: 12, fontWeight: "500" },

  matchSubmeta: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  submetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  submetaText: { color: colors.text, fontSize: 12, fontWeight: "600" },

  // Buddy card
  buddyTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeSafe: { backgroundColor: "rgba(34, 197, 94, 0.10)" },
  badgeText: { color: colors.safe, fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  travelDetailsBlock: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  travelLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  travelLabel: { color: colors.mutedText, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  routeMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  routeMetaText: { color: colors.text, fontSize: 13, fontWeight: "700", flexShrink: 1 },
  dateMetaText: { color: colors.mutedText, fontSize: 12 },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  detailItem: { width: "44%" },
  detailLabel: { color: colors.mutedText, fontSize: 9, fontWeight: "700", letterSpacing: 0.4 },
  detailValue: { color: colors.text, fontSize: 12, fontWeight: "700", marginTop: 2 },
  bioText: {
    color: colors.mutedText,
    fontSize: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },

  // Actions
  actionsRow: { flexDirection: "row", gap: 8 },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
  },
  secondaryAction: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryAction: { backgroundColor: colors.primary },
  actionButtonText: { color: colors.text, fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  primaryActionText: { color: colors.white },
});
