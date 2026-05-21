import { memo, useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { PrimaryHeaderActions } from "@/components/ui/PrimaryHeaderActions";
import { Screen } from "@/components/ui/Screen";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { CityPicker } from "@/features/search/CityPicker";
import {
  citiesForDirection,
  countryLabelForDirection,
  type Direction,
} from "@/features/search/cityLists";
import { DatePicker } from "@/features/search/DatePicker";
import { RouteListingCard } from "@/features/search/RouteListingCard";
import { MetricRow, MetricTile, RouteHeader } from "@/features/search/routeBlocks";
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
import { colors, primaryTint } from "@/theme/colors";
import { carrierTripMatchesParcel, parcelMatchesTrip } from "@/utils/routeMatch";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

type LookingForType = "travel_buddy" | "carrier" | "receive_request";
type ResultsTab = "package" | "buddy" | "receiver";

type NoticeVariant = "error" | "info" | "success" | "warning";
interface Notice {
  message: string;
  title?: string;
  variant: NoticeVariant;
}
type SetNotice = (notice: Notice | null) => void;

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

  const [direction, setDirection] = useState<Direction>("IN_TO_US");
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [lookingFor, setLookingFor] = useState<LookingForType[]>([]);
  const [activeTab, setActiveTab] = useState<ResultsTab>("package");
  const [notice, setNotice] = useState<Notice | null>(null);

  // Auto-match on mount returns results before the user touches a filter.
  const { results, loading, error, hasAppliedFilters, search, refetch } = useSearchMatches();

  // In auto-match mode results are grouped under the user's own listings —
  // one card per parcel/trip with matches nested inside (mirrors web).
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

  // Pre-compute per-listing matches at the parent so the tab counts and the
  // nested cards read from the same source (no auto-match drift).
  const carrierTripsByParcelId = useMemo(() => {
    const map = new Map<string, PackageMatch[]>();
    if (loading) return map;
    for (const parcel of sortedMyParcels) {
      map.set(
        parcel.id,
        carrierTrips.filter((m) =>
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
        ),
      );
    }
    return map;
  }, [loading, carrierTrips, sortedMyParcels]);

  const receiverRequestsByTripId = useMemo(() => {
    const map = new Map<string, PackageMatch[]>();
    if (loading) return map;
    for (const trip of sortedMyTrips) {
      map.set(
        trip.id,
        receiverRequests.filter(
          (m) =>
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
        ),
      );
    }
    return map;
  }, [loading, receiverRequests, sortedMyTrips]);

  // Auto-match counts = sum of nested matches under user listings; manual
  // filter counts = flat result length. Buddies is always flat.
  const isAutoMatch = !hasAppliedFilters;
  const packageTabCount = useMemo(() => {
    if (!isAutoMatch) return carrierTrips.length;
    let total = 0;
    for (const list of carrierTripsByParcelId.values()) total += list.length;
    return total;
  }, [isAutoMatch, carrierTrips, carrierTripsByParcelId]);

  const receiverTabCount = useMemo(() => {
    if (!isAutoMatch) return receiverRequests.length;
    let total = 0;
    for (const list of receiverRequestsByTripId.values()) total += list.length;
    return total;
  }, [isAutoMatch, receiverRequests, receiverRequestsByTripId]);

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

    const filters: SearchFilters = { per_page: 50 };
    if (fromCity) filters.from_city = fromCity;
    if (toCity) filters.to_city = toCity;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (lookingFor.length > 0) filters.looking_for = lookingFor.join(",");

    try {
      await search(filters);
    } catch {
      // Hook's error state below the tabs already surfaces this.
    }
  }, [fromCity, toCity, dateFrom, dateTo, lookingFor, search]);

  return (
    <Screen scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
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
              <Ionicons name="swap-vertical-outline" size={16} color={colors.wordmark} />
            </Pressable>
            <CityPicker
              value={toCity}
              onChange={setToCity}
              cities={toCities}
              placeholder={`To (${toCountry})`}
              disabled={loading}
            />
          </View>

          {/* Date Range — tappable fields that open a calendar sheet. */}
          <Text style={[styles.fieldLabel, styles.fieldLabelTopGap]}>DATE RANGE</Text>
          <View style={styles.dateRow}>
            <DatePicker
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="From date"
              disabled={loading}
            />
            <DatePicker
              value={dateTo}
              onChange={setDateTo}
              placeholder="To date"
              disabled={loading}
            />
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
                    {checked ? (
                      <Ionicons name="checkmark" size={14} color={colors.white} />
                    ) : null}
                  </View>
                  <Text style={styles.checkboxLabel}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Apply — primary submit CTA, label-only (matches MyTravels' AppButton recipe). */}
          <AppButton
            label={loading ? "Searching…" : "Apply Filters & Search"}
            onPress={() => void handleApply()}
            disabled={loading}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.applyButtonWrap}
          />

          <Text style={styles.noteText}>
            Max 3 searches per day. Use filters wisely for best results.
          </Text>
        </Card>

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
            buddy: buddyMatches.length,
            receiver: receiverTabCount,
          }}
          loading={loading}
        />

        {error ? (
          <ErrorBlock message={getErrorMessage(error)} onRetry={() => void refetch()} />
        ) : activeTab === "package" ? (
          <PackageTabResults
            loading={loading}
            isAutoMatch={isAutoMatch}
            myParcels={sortedMyParcels}
            myParcelsLoading={myParcelsState.loading}
            matches={carrierTrips}
            matchesByParcelId={carrierTripsByParcelId}
            navigation={navigation}
            setNotice={setNotice}
          />
        ) : activeTab === "buddy" ? (
          <BuddyTabResults
            loading={loading}
            matches={buddyMatches}
            navigation={navigation}
            setNotice={setNotice}
          />
        ) : (
          <ReceiverTabResults
            loading={loading}
            isAutoMatch={isAutoMatch}
            myTrips={sortedMyTrips}
            myTripsLoading={myTripsState.loading}
            matches={receiverRequests}
            matchesByTripId={receiverRequestsByTripId}
            navigation={navigation}
            setNotice={setNotice}
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
  const tabs: readonly { key: ResultsTab; label: string; count: number }[] = [
    { key: "package", label: "Packages", count: counts.package },
    { key: "buddy", label: "Buddies", count: counts.buddy },
    { key: "receiver", label: "Receivers", count: counts.receiver },
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
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
              {tab.label}{" "}
              {loading ? (
                <Text style={styles.tabCount}>(…)</Text>
              ) : (
                <Text style={styles.tabCount}>({tab.count})</Text>
              )}
            </Text>
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
  matchesByParcelId,
  navigation,
  setNotice,
}: Readonly<{
  loading: boolean;
  isAutoMatch: boolean;
  myParcels: Parcel[];
  myParcelsLoading: boolean;
  matches: PackageMatch[];
  /** Pre-filtered per-parcel match lists (same source as the tab count). */
  matchesByParcelId: Map<string, PackageMatch[]>;
  navigation: Nav;
  setNotice: SetNotice;
}>) {
  if (isAutoMatch) {
    if (myParcelsLoading && myParcels.length === 0)
      return (
        <View>
          <MyListingSkeleton />
          <MyListingSkeleton />
        </View>
      );
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
              dateLabel={formatTripDateRange(parcel.delivery_by)}
              secondary={
                parcel.category
                  ? { label: "CATEGORY", value: parcel.category }
                  : undefined
              }
            >
              {loading ? (
                <MatchCardSkeleton />
              ) : matched.length === 0 ? (
                <Text style={styles.nestedEmpty}>
                  No matched carriers yet for this route or date.
                </Text>
              ) : (
                <View>
                  <Text style={styles.nestedHeading}>CARRIER TRIPS</Text>
                  {matched.map((m) => (
                    <PackageMatchCard
                      key={`${m.type}-${m.id}`}
                      match={m}
                      navigation={navigation}
                      setNotice={setNotice}
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
          setNotice={setNotice}
        />
      ))}
    </View>
  );
}

function BuddyTabResults({
  loading,
  matches,
  navigation,
  setNotice,
}: Readonly<{
  loading: boolean;
  matches: BuddySearchMatch[];
  navigation: Nav;
  setNotice: SetNotice;
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
        <BuddyMatchCard key={b.id} match={b} navigation={navigation} setNotice={setNotice} />
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
  matchesByTripId,
  navigation,
  setNotice,
}: Readonly<{
  loading: boolean;
  isAutoMatch: boolean;
  myTrips: Trip[];
  myTripsLoading: boolean;
  matches: PackageMatch[];
  /** Pre-filtered per-trip match lists (same source as the tab count). */
  matchesByTripId: Map<string, PackageMatch[]>;
  navigation: Nav;
  setNotice: SetNotice;
}>) {
  if (isAutoMatch) {
    if (myTripsLoading && myTrips.length === 0)
      return (
        <View>
          <MyListingSkeleton />
          <MyListingSkeleton />
        </View>
      );
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
          const matched = matchesByTripId.get(trip.id) ?? [];
          return (
            <RouteListingCard
              key={trip.id}
              fromCity={trip.from_city}
              toCity={trip.to_city}
              kind="trip"
              dateLabel={formatTripDateRange(trip.travel_date)}
              secondary={
                trip.airline ? { label: "AIRLINE", value: trip.airline } : undefined
              }
            >
              {loading ? (
                <MatchCardSkeleton />
              ) : matched.length === 0 ? (
                <Text style={styles.nestedEmpty}>
                  No receiver requests yet for this route or date.
                </Text>
              ) : (
                <View>
                  <Text style={styles.nestedHeading}>RECEIVER REQUESTS</Text>
                  {matched.map((m) => (
                    <PackageMatchCard
                      key={`${m.type}-${m.id}`}
                      match={m}
                      navigation={navigation}
                      setNotice={setNotice}
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

  if (loading && matches.length === 0) return <MatchListSkeleton />;
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
          navigation={navigation}
          setNotice={setNotice}
        />
      ))}
    </View>
  );
}

// ───────────────────────── Cards ─────────────────────────

function PackageMatchCard({
  match,
  navigation,
  setNotice,
}: Readonly<{ match: PackageMatch; navigation: Nav; setNotice: SetNotice }>) {
  const isTrip = match.type === "carrier_trip";
  const person = isTrip ? match.carrier : match.sender;
  const dateLabel = isTrip
    ? formatDateLabel(match.travel_date)
    : formatDateLabel(match.delivery_by);

  const handleViewProfile = useCallback(() => {
    setNotice({ message: "Profile pages are coming soon.", variant: "info" });
  }, [setNotice]);

  const handleStartChat = useCallback(() => {
    if (!person?.id) {
      setNotice({
        title: "User unavailable",
        message: "This person can't be messaged right now.",
        variant: "error",
      });
      return;
    }
    navigation.navigate("MessagesTab");
  }, [person?.id, navigation, setNotice]);

  const secondary = isTrip
    ? {
        label: "CAPACITY",
        value:
          match.luggage_capacity_kg != null
            ? `${match.luggage_capacity_kg} kg`
            : "—",
      }
    : {
        label: "FEE",
        value:
          match.fee_offered != null ? `USD $${match.fee_offered}` : "—",
      };

  const inlineSubtitle = isTrip
    ? match.airline
      ? `Via ${match.airline}`
      : null
    : match.category?.trim() || null;

  return (
    <Card style={styles.matchCard}>
      <RouteHeader
        fromCity={match.from_city}
        toCity={match.to_city}
        kind={isTrip ? "trip" : "parcel"}
        compact
      />

      <MetricRow>
        <MetricTile label="DATE" value={dateLabel} compact />
        <MetricTile label={secondary.label} value={secondary.value} highlight compact />
      </MetricRow>

      {inlineSubtitle ? (
        <Text style={styles.matchSubtitle}>{inlineSubtitle}</Text>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.personRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(person?.name)}</Text>
        </View>
        <View style={styles.personInfo}>
          <Text style={styles.personName} numberOfLines={2}>
            {person?.name || "Unknown user"}
          </Text>
          <Text style={styles.ratingText}>
            {person?.rating && person.rating > 0
              ? `${person.rating.toFixed(1)} rating`
              : "New member"}
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <AppButton
          label="View profile"
          variant="secondary"
          onPress={handleViewProfile}
          style={styles.actionButtonFlex}
        />
        <AppButton
          label="Start chat"
          onPress={handleStartChat}
          gradientColors={[colors.ctaAccent, colors.ctaAccent]}
          style={styles.actionButtonFlex}
        />
      </View>
    </Card>
  );
}

function BuddyMatchCard({
  match,
  navigation,
  setNotice,
}: Readonly<{ match: BuddySearchMatch; navigation: Nav; setNotice: SetNotice }>) {
  const dateFrom = match.travel_date_from || match.travel_date;
  const dateTo = match.travel_date_to || match.travel_date;
  const dateLabel =
    dateFrom === dateTo
      ? formatDateLabel(dateFrom)
      : `${formatDateLabel(dateFrom)} – ${formatDateLabel(dateTo)}`;

  const details: { label: string; value: string }[] = [
    ...(match.age != null ? [{ label: "AGE", value: `${match.age} yrs` }] : []),
    ...(match.languages?.length
      ? [{ label: "LANGUAGES", value: match.languages.slice(0, 3).join(", ") }]
      : []),
    ...(match.layover ? [{ label: "LAYOVER", value: match.layover }] : []),
  ];

  const handleViewProfile = useCallback(() => {
    setNotice({ message: "Profile pages are coming soon.", variant: "info" });
  }, [setNotice]);

  const handleStartChat = useCallback(() => {
    if (!match.user?.id) {
      setNotice({
        title: "User unavailable",
        message: "This buddy can't be messaged right now.",
        variant: "error",
      });
      return;
    }
    navigation.navigate("MessagesTab");
  }, [match.user?.id, navigation, setNotice]);

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
            <View style={styles.badgeSafe}>
              <Text style={styles.badgeText}>BUDDY</Text>
            </View>
          </View>
          <Text style={styles.ratingText}>
            {match.user?.rating && match.user.rating > 0
              ? `${match.user.rating.toFixed(1)} rating`
              : "New member"}
          </Text>
        </View>
      </View>

      <View style={styles.travelDetailsBlock}>
        <Text style={styles.travelLabel}>TRAVEL DETAILS</Text>
        <RouteHeader fromCity={match.from_city} toCity={match.to_city} kind="trip" compact />
        <MetricRow>
          <MetricTile label="DATE" value={dateLabel} compact />
          <MetricTile label="AIRLINE" value={match.airline || "—"} highlight compact />
        </MetricRow>
        {details.length > 0 ? (
          <View style={styles.detailsGrid}>
            {details.map((d) => (
              <View key={d.label} style={styles.detailItem}>
                <Text style={styles.detailLabel}>{d.label}</Text>
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
        <AppButton
          label="View profile"
          variant="secondary"
          onPress={handleViewProfile}
          style={styles.actionButtonFlex}
        />
        <AppButton
          label="Start chat"
          onPress={handleStartChat}
          gradientColors={[colors.ctaAccent, colors.ctaAccent]}
          style={styles.actionButtonFlex}
        />
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
    <View style={styles.modeBanner}>
      <Text style={styles.modeBannerText}>{body}</Text>
    </View>
  );
}

function MatchCardSkeleton() {
  return (
    <View style={styles.skeletonMatchCard}>
      <View style={styles.skeletonRouteRow}>
        <SkeletonBlock style={styles.skeletonRouteCity} />
        <View style={styles.skeletonRouteConnector}>
          <View style={styles.skeletonRouteLine} />
          <SkeletonBlock style={styles.skeletonRouteIcon} />
          <View style={styles.skeletonRouteLine} />
        </View>
        <SkeletonBlock style={styles.skeletonRouteCity} />
      </View>
      <View style={styles.skeletonTileRow}>
        <SkeletonBlock style={styles.skeletonTile} />
        <SkeletonBlock style={styles.skeletonTile} />
      </View>
      <View style={styles.skeletonDivider} />
      <View style={styles.skeletonPersonRow}>
        <SkeletonBlock style={styles.skeletonAvatar} />
        <View style={styles.skeletonPersonInfo}>
          <SkeletonBlock style={styles.skeletonPersonName} />
          <SkeletonBlock style={styles.skeletonPersonMeta} />
        </View>
      </View>
      <View style={styles.skeletonActionsRow}>
        <SkeletonBlock style={styles.skeletonActionButton} />
        <SkeletonBlock style={styles.skeletonActionButton} />
      </View>
    </View>
  );
}

function MatchListSkeleton({ count = 3 }: Readonly<{ count?: number }>) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <MatchCardSkeleton key={i} />
      ))}
    </View>
  );
}

function MyListingSkeleton() {
  return (
    <View style={styles.skeletonListingCard}>
      <View style={styles.skeletonRouteRow}>
        <SkeletonBlock style={styles.skeletonRouteCity} />
        <View style={styles.skeletonRouteConnector}>
          <View style={styles.skeletonRouteLine} />
          <SkeletonBlock style={styles.skeletonRouteIcon} />
          <View style={styles.skeletonRouteLine} />
        </View>
        <SkeletonBlock style={styles.skeletonRouteCity} />
      </View>
      <View style={styles.skeletonTileRow}>
        <SkeletonBlock style={styles.skeletonTile} />
        <SkeletonBlock style={styles.skeletonTile} />
      </View>
    </View>
  );
}

function ErrorBlock({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry?: () => void }>) {
  return (
    <View style={styles.centered}>
      <Text style={styles.errorTitle}>Search failed</Text>
      <Text style={styles.errorBody}>{message}</Text>
      {onRetry ? (
        <AppButton
          label="Try again"
          onPress={onRetry}
          gradientColors={[colors.ctaAccent, colors.ctaAccent]}
          style={styles.retryButtonWrap}
        />
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
        <Ionicons name={icon} size={28} color={colors.wordmark} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  subtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    marginTop: 4,
  },
  bannerSlot: { marginBottom: 14 },

  // Filters
  filtersCard: { gap: 12, padding: 16, marginBottom: 18 },
  fieldLabel: {
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  fieldLabelTopGap: { marginTop: 6 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: primaryTint.fill10,
    borderWidth: 1,
    borderColor: primaryTint.stroke18,
    alignItems: "center",
    justifyContent: "center",
  },
  dateRow: { flexDirection: "row", gap: 8 },
  lookingForCol: { gap: 14, marginTop: 4 },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.controlOutline,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.wordmark, borderColor: colors.wordmark },
  checkboxLabel: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  applyButtonWrap: { marginTop: 14 },
  noteText: {
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 4,
  },

  tabsRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  tabActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabLabel: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  tabLabelActive: { color: colors.text },
  tabCount: { color: colors.subtleText, fontSize: 11, lineHeight: 15, fontWeight: "600" },

  modeBanner: { paddingHorizontal: 4, paddingBottom: 10 },
  modeBannerText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },

  // Loading / error / empty
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },

  skeletonMatchCard: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 14,
  },
  skeletonListingCard: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 14,
  },
  skeletonRouteRow: { flexDirection: "row", alignItems: "center" },
  skeletonRouteCity: { flex: 1, height: 22, marginHorizontal: 4 },
  skeletonRouteConnector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  skeletonRouteLine: { width: 14, height: 1, backgroundColor: colors.border },
  skeletonRouteIcon: { width: 20, height: 20, borderRadius: 10 },
  skeletonTileRow: { flexDirection: "row", gap: 10 },
  skeletonTile: { flex: 1, height: 70, borderRadius: 14 },
  skeletonDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  skeletonPersonRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  skeletonAvatar: { width: 40, height: 40, borderRadius: 20 },
  skeletonPersonInfo: { flex: 1, gap: 6 },
  skeletonPersonName: { width: "55%", height: 16, borderRadius: 6 },
  skeletonPersonMeta: { width: "35%", height: 12, borderRadius: 6 },
  skeletonActionsRow: { flexDirection: "row", gap: 10 },
  skeletonActionButton: { flex: 1, height: 48, borderRadius: 16 },

  // Nested matches inside a RouteListingCard
  nestedEmpty: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    paddingVertical: 4,
  },
  nestedHeading: {
    color: colors.mutedText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  errorTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  errorBody: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 280,
  },
  retryButtonWrap: { marginTop: 4, alignSelf: "stretch", maxWidth: 220 },
  emptyResults: { alignItems: "center", paddingVertical: 36, gap: 8 },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTintPrimary,
  },
  emptyTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800", marginTop: 4 },
  emptyBody: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 300,
  },

  // Match card
  matchCard: { padding: 16, marginBottom: 14, gap: 14 },
  matchSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  personRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLarger: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: colors.wordmark, fontSize: 14, lineHeight: 18, fontWeight: "800" },
  personInfo: { flex: 1, minWidth: 0 },
  personName: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  ratingText: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500", marginTop: 2 },

  // Buddy card
  buddyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  badgeSafe: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  badgeText: { color: colors.safe, fontSize: 9, lineHeight: 12, fontWeight: "800", letterSpacing: 0.4 },
  travelDetailsBlock: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  travelLabel: {
    color: colors.subtleText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  detailItem: { width: "44%" },
  detailLabel: {
    color: colors.mutedText,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  detailValue: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  bioText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },

  actionsRow: { flexDirection: "row", gap: 10 },
  actionButtonFlex: { flex: 1 },
});
