// ListTripScreen smoke test.
//
// Proves end-to-end against the live Supabase project:
//   1. Login
//   2. POST /trip-handler/ — create a probe trip with the exact payload shape
//      ListTripScreen sends (mobile renames luggage_capacity_kg → luggage_capacity)
//   3. Field-shape audit on the created row
//   4. GET /trip-handler/?filter=my_trips — verify it shows up in My Travels
//   5. (When openToBuddy is true, verify a buddy listing was auto-created — but
//      we keep the probe simple and test buddy flag separately)
//   6. DELETE /trip-handler/{id} — clean up
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestListTrip.mjs
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

async function call(method, path, { token, body, query } = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let url = `${FUNCTIONS_URL}${path}`;
  if (query) {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ""),
      ),
    ).toString();
    if (qs) url += `?${qs}`;
  }
  const resp = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await resp.json();
  } catch {
    /* non-JSON */
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

  console.log(`Smoke testing ListTripScreen against ${SUPABASE_URL}\n`);

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
  const userId = signInData.user?.id;
  record("login", true, `user ${userId?.slice(0, 8)}…`);

  // 2. Create a probe trip — payload shape MUST match what ListTripScreen sends
  //    (server-side `luggage_capacity` field name; mobile renames before POST).
  const travelDate = new Date();
  travelDate.setDate(travelDate.getDate() + 21);
  const yyyy = travelDate.getFullYear();
  const mm = `${travelDate.getMonth() + 1}`.padStart(2, "0");
  const dd = `${travelDate.getDate()}`.padStart(2, "0");
  const travelDateStr = `${yyyy}-${mm}-${dd}`;

  const probeNotes = `[smoke-test ${new Date().toISOString()}] listtrip probe | Max parcel size: 30×20×10 cm`;
  const probePayload = {
    from_city: "Chennai, TN",
    from_country: "IN",
    to_city: "Chicago (ORD), IL",
    to_country: "US",
    any_from: false,
    any_to: false,
    travel_date: travelDateStr,
    luggage_capacity: 5, // mobile renames luggage_capacity_kg → luggage_capacity
    open_to_buddy: false,
    airline: "Air India",
    notes: probeNotes,
  };

  const created = await call("POST", "/trip-handler/", { token, body: probePayload });
  if (!created.ok || !created.json?.data?.id) {
    record(
      "POST /trip-handler/ (create probe)",
      false,
      `status ${created.status}: ${JSON.stringify(created.json?.error ?? {}).slice(0, 200)}`,
    );
    process.exit(1);
  }
  const newTrip = created.json.data;
  record(
    "POST /trip-handler/ (create probe)",
    true,
    `id=${newTrip.id?.slice(0, 8)}…, status=${newTrip.status}`,
  );

  // 3. Field-shape sanity check
  //    NOTE: server's POST /trip-handler/ doesn't echo `user_id` (it's
  //    implicit — the inserter is always the JWT subject). Neither web nor
  //    mobile screens read user_id off the trip row, so we don't audit it.
  console.log("\n— Created trip field shape —");
  for (const k of [
    "id",
    "from_city",
    "from_country",
    "to_city",
    "to_country",
    "travel_date",
    "airline",
    "open_to_buddy",
    "status",
    "created_at",
  ]) {
    const v = newTrip[k];
    const ok = v !== undefined && v !== null;
    record(`field "${k}"`, ok, ok ? JSON.stringify(v).slice(0, 80) : "(missing)");
  }
  const capVal = newTrip.luggage_capacity ?? newTrip.luggage_capacity_kg;
  record(
    'field "luggage_capacity" OR "luggage_capacity_kg"',
    capVal !== undefined && capVal !== null,
    `luggage_capacity=${newTrip.luggage_capacity ?? "(none)"}, luggage_capacity_kg=${newTrip.luggage_capacity_kg ?? "(none)"}`,
  );

  // 4. Verify it appears in My Trips
  const list = await call("GET", "/trip-handler/", {
    token,
    query: { filter: "my_trips", page: 1, per_page: 50 },
  });
  if (!list.ok) {
    record("GET /trip-handler/?filter=my_trips", false, `status ${list.status}`);
  } else {
    const found = (list.json?.data ?? []).find((p) => p.id === newTrip.id);
    record(
      "verify probe shows up in My Trips",
      !!found,
      found
        ? `route ${found.from_city} → ${found.to_city} on ${found.travel_date}`
        : "(not found)",
    );
  }

  // 5. Cleanup
  const del = await call("DELETE", `/trip-handler/${newTrip.id}`, { token });
  record(
    "DELETE /trip-handler/{id} (cleanup)",
    del.ok || del.status === 200,
    `status ${del.status}`,
  );

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
