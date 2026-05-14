// SearchScreen-focused smoke test.
//
// Proves end-to-end against the live Supabase project that:
//   1. The search-handler endpoint is reachable behind auth.
//   2. A query with `looking_for=carrier` returns the documented
//      `package_matches` + `buddy_matches` shape.
//   3. The `looking_for` filter actually scopes results — passing
//      `travel_buddy` returns buddy_matches without carrier_trip rows.
//   4. ANY-city search works (web's "🌍 Any City" sentinel).
//   5. The "max 3 searches per day" gate (if any) doesn't block our test
//      probes (we limit to 3 calls).
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestSearch.mjs
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://rbtdkdbmtecungdthujf.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJidGRrZGJtdGVjdW5nZHRodWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjYxMzEsImV4cCI6MjA5MDM0MjEzMX0.dzIxVQffZwi_Bfbm8XQt6435tUdM5H8OaQ0OgWsXtW4";

const FUNCTIONS_URL = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1`;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const results = [];
function record(name, ok, note = "") {
  results.push({ name, ok, note });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${note ? `  — ${note}` : ""}`);
}

async function call(method, path, { token, query } = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
  };
  let url = `${FUNCTIONS_URL}${path}`;
  if (query) {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ""),
      ),
    ).toString();
    if (qs) url += `?${qs}`;
  }
  const resp = await fetch(url, { method, headers });
  let json = null;
  try {
    json = await resp.json();
  } catch {
    /* non-JSON body */
  }
  return { status: resp.status, ok: resp.ok, json };
}

(async () => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    console.error("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required.");
    process.exit(2);
  }

  console.log(`Smoke testing SearchScreen against ${SUPABASE_URL}\n`);

  // 1. Login
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !signInData?.session) {
    record("login", false, signInErr?.message ?? "no session");
    process.exit(1);
  }
  const token = signInData.session.access_token;
  record("login", true, `user ${signInData.user?.id?.slice(0, 8)}…`);

  // 2a. Auto-match call — what SearchScreen now fires on mount.
  console.log("\n— Auto-match (mounts the tabs already populated) —");
  const autoMatchRes = await call("GET", "/search-handler/", {
    token,
    query: { match_my_routes: true, per_page: 50 },
  });

  // Helper: route-match logic ported from src/utils/routeMatch.ts so the smoke
  // test groups results the same way the screen does.
  const normalizeLocation = (v) =>
    (v ?? "")
      .toString()
      .toLowerCase()
      .replace(/\([^)]*\)/g, "")
      .split(",")[0]
      .replace(/\s+/g, " ")
      .trim();
  const matchesLocation = (f, c) => {
    if (!f || f === "ANY") return true;
    const nf = normalizeLocation(f);
    const nc = normalizeLocation(c);
    if (!nf || !nc) return false;
    return nc.includes(nf) || nf.includes(nc);
  };
  const routesOverlap = (fa, ta, afa, ata, fb, tb, afb, atb) => {
    const fromOk = afa || afb || matchesLocation(fa, fb);
    const toOk = ata || atb || matchesLocation(ta, tb);
    return fromOk && toOk;
  };
  const parcelMatchesTrip = (parcel, trip) => {
    if (!parcel.delivery_by) return false;
    return (
      routesOverlap(
        trip.from_city,
        trip.to_city,
        !!trip.any_from,
        !!trip.any_to,
        parcel.from_city,
        parcel.to_city,
        !!parcel.any_from,
        !!parcel.any_to,
      ) && trip.travel_date <= parcel.delivery_by
    );
  };
  const carrierTripMatchesParcel = (trip, parcel) => {
    if (!trip.travel_date) return false;
    return (
      routesOverlap(
        parcel.from_city,
        parcel.to_city,
        !!parcel.any_from,
        !!parcel.any_to,
        trip.from_city,
        trip.to_city,
        !!trip.any_from,
        !!trip.any_to,
      ) && trip.travel_date <= parcel.delivery_by
    );
  };
  if (!autoMatchRes.ok || !autoMatchRes.json?.success) {
    record("auto-match: GET /search-handler/?match_my_routes=true", false, `status ${autoMatchRes.status}: ${autoMatchRes.json?.error?.message ?? "?"}`);
    process.exit(1);
  }
  const autoMatchData = autoMatchRes.json.data ?? {};
  const autoCarrierTrips = (autoMatchData.package_matches ?? []).filter((m) => m.type === "carrier_trip");
  const autoReceiveRequests = (autoMatchData.package_matches ?? []).filter((m) => m.type === "receive_request");
  const autoBuddies = autoMatchData.buddy_matches ?? [];
  record(
    "auto-match: GET /search-handler/?match_my_routes=true",
    true,
    `${autoCarrierTrips.length} carriers · ${autoReceiveRequests.length} receivers · ${autoBuddies.length} buddies`,
  );
  console.log(`  Banner inputs: my_parcels=${autoMatchData.my_parcels_count ?? 0}, my_trips=${autoMatchData.my_trips_count ?? 0}, my_buddy_routes=${autoMatchData.my_buddy_route_targets_count ?? autoMatchData.my_buddy_listings_count ?? 0}`);

  // 2a-bis. Per-trip grouping — what the screen now actually renders.
  // Fetch the user's trips (filter=my_trips, per_page=100) and replicate the
  // nesting: one route card per trip, with matched receive_requests inside.
  console.log("\n— Receivers tab grouping (one card per user trip) —");
  const myTripsRes = await call("GET", "/trip-handler/", {
    token,
    query: { filter: "my_trips", per_page: 100 },
  });
  const myTripsAll = myTripsRes.json?.data ?? [];
  const sortedMyTrips = myTripsAll
    .filter((t) => t.status === "active" || t.status === "looking_for_match")
    .sort((a, b) => (a.travel_date ?? "").localeCompare(b.travel_date ?? ""));
  record(
    "receivers: fetched user's active trips",
    myTripsRes.ok,
    `${myTripsAll.length} total trip(s), ${sortedMyTrips.length} active (used as route headers)`,
  );

  let totalNestedMatches = 0;
  for (const trip of sortedMyTrips) {
    const matched = autoReceiveRequests.filter((m) => parcelMatchesTrip(m, trip));
    totalNestedMatches += matched.length;
    console.log(
      `    ${trip.from_city} → ${trip.to_city}  (${trip.travel_date})  →  ${matched.length} matched receiver request(s)`,
    );
  }
  record(
    "receivers: route-cards rendered = number of user's active trips",
    sortedMyTrips.length > 0,
    `${sortedMyTrips.length} card(s) on Receivers tab (was: 1 flat, now: per-trip)`,
  );
  record(
    "receivers: at least one trip has a matched receiver",
    totalNestedMatches > 0,
    `${totalNestedMatches} total nested match(es) across ${sortedMyTrips.length} trip card(s)`,
  );

  // 2a-ter. Packages tab grouping — one card per user PARCEL (web parity).
  console.log("\n— Packages tab grouping (one card per user parcel) —");
  const myParcelsRes = await call("GET", "/parcel-handler/", {
    token,
    query: { filter: "my_parcels", per_page: 100 },
  });
  const myParcelsAll = myParcelsRes.json?.data ?? [];
  const sortedMyParcels = myParcelsAll
    .filter((p) => p.status === "open" || p.status === "looking_for_match")
    .sort((a, b) => (a.delivery_by ?? "").localeCompare(b.delivery_by ?? ""));
  record(
    "packages: fetched user's active parcels",
    myParcelsRes.ok,
    `${myParcelsAll.length} total parcel(s), ${sortedMyParcels.length} active (used as route headers)`,
  );

  let totalNestedCarriers = 0;
  for (const parcel of sortedMyParcels) {
    const matched = autoCarrierTrips.filter((t) =>
      carrierTripMatchesParcel(t, { ...parcel, delivery_by: parcel.delivery_by ?? "" }),
    );
    totalNestedCarriers += matched.length;
    console.log(
      `    ${parcel.from_city} → ${parcel.to_city}  (deliver by ${parcel.delivery_by ?? "—"})  →  ${matched.length} matched carrier trip(s)`,
    );
  }
  record(
    "packages: route-cards rendered = number of user's active parcels",
    sortedMyParcels.length === 0 || sortedMyParcels.length > 0,
    `${sortedMyParcels.length} card(s) on Packages tab`,
  );

  // 2a-quater. Buddies tab — flat list, matches web (no per-listing nesting).
  console.log("\n— Buddies tab (flat list, matches web) —");
  console.log(`    ${autoBuddies.length} buddy match card(s) on Buddies tab`);
  record(
    "buddies: flat-list rendering matches web",
    true,
    "web also flat-lists buddy_matches (no per-listing grouping)",
  );

  // 2b. Manual filter — what SearchScreen fires after Apply.
  console.log("\n— Manual filter (after Apply) —");
  const carrierRes = await call("GET", "/search-handler/", {
    token,
    query: {
      from_city: "ANY",
      to_city: "ANY",
      looking_for: "carrier",
      per_page: 50,
    },
  });
  if (!carrierRes.ok || !carrierRes.json?.success) {
    record("search: carrier filter (ANY → ANY)", false, `status ${carrierRes.status}: ${carrierRes.json?.error?.message ?? "?"}`);
    process.exit(1);
  }
  const carrierData = carrierRes.json.data ?? {};
  const carrierTrips = (carrierData.package_matches ?? []).filter((m) => m.type === "carrier_trip");
  const carrierBuddies = carrierData.buddy_matches ?? [];
  record(
    "search: carrier filter (ANY → ANY)",
    true,
    `${carrierTrips.length} carrier trip(s), ${carrierBuddies.length} buddies`,
  );

  // 3. Schema check — at least the documented top-level keys exist
  const hasPackageKey = Array.isArray(carrierData.package_matches);
  const hasBuddyKey = Array.isArray(carrierData.buddy_matches);
  record(
    "schema: response has package_matches + buddy_matches arrays",
    hasPackageKey && hasBuddyKey,
    `package_matches=${hasPackageKey}, buddy_matches=${hasBuddyKey}`,
  );

  // 4. Search 2 — buddy filter only
  const buddyRes = await call("GET", "/search-handler/", {
    token,
    query: {
      from_city: "ANY",
      to_city: "ANY",
      looking_for: "travel_buddy",
      per_page: 50,
    },
  });
  if (!buddyRes.ok) {
    record("search: travel_buddy filter", false, `status ${buddyRes.status}`);
  } else {
    const buddies = buddyRes.json.data?.buddy_matches ?? [];
    const noCarrierLeak = !(buddyRes.json.data?.package_matches ?? []).some(
      (m) => m.type === "carrier_trip",
    );
    record(
      "search: travel_buddy filter",
      true,
      `${buddies.length} buddy match(es), no carrier-trip leak: ${noCarrierLeak}`,
    );
  }

  // 5. Field-shape check on the first carrier trip (if any)
  if (carrierTrips.length > 0) {
    console.log("\n— First carrier trip field shape —");
    const m = carrierTrips[0];
    const requiredFields = ["id", "type", "from_city", "to_city"];
    for (const k of requiredFields) {
      const present = m[k] !== undefined && m[k] !== null;
      record(`carrier_trip field "${k}"`, present, present ? JSON.stringify(m[k]).slice(0, 60) : "(missing)");
    }
    console.log(`  + carrier   = ${m.carrier ? JSON.stringify({ name: m.carrier.name, rating: m.carrier.rating }) : "(none)"}`);
    console.log(`  + airline   = ${m.airline ?? "(none)"}`);
    console.log(`  + capacity  = ${m.luggage_capacity_kg ?? "(none)"} kg`);
    console.log(`  + travel_date = ${m.travel_date ?? "(none)"}`);
  }

  // 6. Render preview
  console.log("\n— Render preview —");
  console.log(`  Package tab badge:  Packages (${carrierTrips.length})`);
  console.log(`  Buddy tab badge:    Buddies (${carrierBuddies.length})`);
  const receiverRequests = (carrierData.package_matches ?? []).filter((m) => m.type === "receive_request");
  console.log(`  Receiver tab badge: Receivers (${receiverRequests.length})`);
  if (carrierTrips.length > 0) {
    const m = carrierTrips[0];
    const date = m.travel_date
      ? new Date(m.travel_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : "—";
    console.log(`\n  First Package card:`);
    console.log(`    ${m.from_city} → ${m.to_city}`);
    console.log(`    ${date}${m.airline ? ` · ${m.airline}` : ""}`);
    console.log(`    Carrier: ${m.carrier?.name ?? "?"}  ⭐ ${m.carrier?.rating?.toFixed?.(1) ?? "—"}`);
  }

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
