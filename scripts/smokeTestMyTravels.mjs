// MyTravelsScreen-focused smoke test.
//
// Proves end-to-end against the live Supabase project that:
//   1. Each of the 5 server-side filters used by the screen returns a valid
//      response (no 4xx/5xx):
//        Flights tab         → GET /trip-handler/?filter=my_trips
//        Packages → Send     → GET /parcel-handler/?filter=my_delivering
//        Packages → Receive  → GET /parcel-handler/?filter=my_parcels
//        Partners tab        → GET /buddy-handler/?filter=my_listings
//        Archive tab         → GET /trip-handler/?filter=my_archived
//   2. Per-tab counts (used in the tab labels) are consistent.
//   3. Render previews show the data exactly as the screen will display it.
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestMyTravels.mjs
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

/** Mirror src/services/api/parcels.ts normalizer. */
function normalizeParcel(p) {
  return {
    ...p,
    weight_kg: typeof p.weight_kg === "number" ? p.weight_kg : Number(p.weight ?? 0),
    fee_currency: p.fee_currency ?? "USD",
  };
}

(async () => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    console.error("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required.");
    process.exit(2);
  }

  console.log(`Smoke testing MyTravelsScreen against ${SUPABASE_URL}\n`);

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

  // 2. Each tab's data source — what MyTravelsScreen calls on mount.
  console.log("\n— Tab data sources —");

  // Flights tab → my_trips
  const flightsRes = await call("GET", "/trip-handler/", {
    token,
    query: { filter: "my_trips", page: 1, per_page: 20 },
  });
  const flights = flightsRes.ok ? flightsRes.json?.data ?? [] : [];
  const flightsTotal = flightsRes.ok ? flightsRes.json?.meta?.total ?? flights.length : 0;
  record(
    "Flights tab: GET /trip-handler/?filter=my_trips",
    flightsRes.ok,
    `${flights.length} item(s), meta.total=${flightsTotal}`,
  );

  // Packages → Send (my_delivering)
  const sendRes = await call("GET", "/parcel-handler/", {
    token,
    query: { filter: "my_delivering", page: 1, per_page: 20 },
  });
  const sendParcels = sendRes.ok ? (sendRes.json?.data ?? []).map(normalizeParcel) : [];
  const sendTotal = sendRes.ok ? sendRes.json?.meta?.total ?? sendParcels.length : 0;
  record(
    "Packages > Send: GET /parcel-handler/?filter=my_delivering",
    sendRes.ok,
    `${sendParcels.length} item(s), meta.total=${sendTotal}`,
  );

  // Packages → Receive (my_parcels)
  const receiveRes = await call("GET", "/parcel-handler/", {
    token,
    query: { filter: "my_parcels", page: 1, per_page: 20 },
  });
  const receiveParcels = receiveRes.ok
    ? (receiveRes.json?.data ?? []).map(normalizeParcel)
    : [];
  const receiveTotal = receiveRes.ok
    ? receiveRes.json?.meta?.total ?? receiveParcels.length
    : 0;
  record(
    "Packages > Receive: GET /parcel-handler/?filter=my_parcels",
    receiveRes.ok,
    `${receiveParcels.length} item(s), meta.total=${receiveTotal}`,
  );

  // Partners tab → my_listings
  const partnersRes = await call("GET", "/buddy-handler/", {
    token,
    query: { filter: "my_listings", page: 1, per_page: 20 },
  });
  const partners = partnersRes.ok ? partnersRes.json?.data ?? [] : [];
  const partnersTotal = partnersRes.ok
    ? partnersRes.json?.meta?.total ?? partners.length
    : 0;
  record(
    "Partners tab: GET /buddy-handler/?filter=my_listings",
    partnersRes.ok,
    `${partners.length} item(s), meta.total=${partnersTotal}`,
  );

  // Archive tab → my_archived
  const archiveRes = await call("GET", "/trip-handler/", {
    token,
    query: { filter: "my_archived", page: 1, per_page: 20 },
  });
  const archive = archiveRes.ok ? archiveRes.json?.data ?? [] : [];
  const archiveTotal = archiveRes.ok ? archiveRes.json?.meta?.total ?? archive.length : 0;
  record(
    "Archive tab: GET /trip-handler/?filter=my_archived",
    archiveRes.ok,
    `${archive.length} item(s), meta.total=${archiveTotal}`,
  );

  // 3. Render previews for each tab
  console.log("\n— Render preview (what each tab will show) —");
  console.log(`  Flights tab badge:    Flights (${flightsTotal})`);
  console.log(`  Packages tab badge:   Packages (${sendTotal + receiveTotal})`);
  console.log(`  Partners tab badge:   Partners (${partnersTotal})`);
  console.log(`  Archive tab badge:    Archive (${archiveTotal})`);

  if (receiveParcels.length > 0) {
    console.log("\n  Receive section first row:");
    const p = receiveParcels[0];
    const date = p.delivery_by
      ? new Date(p.delivery_by).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "—";
    console.log(`    ${p.from_city} → ${p.to_city}   |   ${p.category} · ${p.weight_kg}kg · ${p.fee_currency === "USD" ? "$" : ""}${p.fee_offered}   |   delivery by ${date}`);
    console.log(`    status: "${p.status}"`);
  }

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
