// TripDetailsScreen smoke test.
//
// Proves end-to-end against the live Supabase project that:
//   1. POST a probe trip so we have something safe to inspect/mutate
//   2. GET /trip-handler/{id} returns the field set the screen renders
//      (id, status, from_city, to_city, travel_date, luggage_capacity,
//      offers_count). Confirms post-normalize `luggage_capacity_kg`.
//   3. PUT /trip-handler/{id} round-trips travel_date + luggage_capacity
//      (so the Edit modal's persisted fields actually save).
//   4. DELETE /trip-handler/{id} hard-soft-cancels the trip (matches the
//      "Cancel Trip" button).
//   5. Bogus id triggers the not-found branch.
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestTripDetails.mjs
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

/** Mirror mobile normalization (`tripsApi.getById`). */
function normalizeTrip(t) {
  if (!t) return t;
  return {
    ...t,
    luggage_capacity_kg:
      typeof t.luggage_capacity_kg === "number"
        ? t.luggage_capacity_kg
        : Number(t.luggage_capacity ?? 0),
  };
}

const RENDERED_FIELDS = ["id", "status", "from_city", "to_city", "travel_date"];

(async () => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    console.error("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required.");
    process.exit(2);
  }

  console.log(`Smoke testing TripDetailsScreen against ${SUPABASE_URL}\n`);

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

  // 2. Create a probe trip we can safely mutate + delete.
  const departureDate = new Date();
  departureDate.setDate(departureDate.getDate() + 14);
  const departureYmd = departureDate.toISOString().slice(0, 10);

  const probeBody = {
    from_city: "Mumbai, MH",
    from_country: "IN",
    to_city: "New York (JFK), NY",
    to_country: "US",
    travel_date: departureYmd,
    luggage_capacity: 12, // server expects `luggage_capacity` (not `_kg`)
    airline: "Air India",
    open_to_buddy: false,
    any_from: false,
    any_to: false,
  };

  const created = await call("POST", "/trip-handler/", { token, body: probeBody });
  if (!created.ok || !created.json?.data?.id) {
    record(
      "POST /trip-handler/ (create probe)",
      false,
      `status ${created.status}: ${JSON.stringify(created.json?.error ?? {}).slice(0, 200)}`,
    );
    process.exit(1);
  }
  const tripId = created.json.data.id;
  record(
    "POST /trip-handler/ (create probe)",
    true,
    `id=${tripId.slice(0, 8)}…, departure=${departureYmd}, capacity=12kg`,
  );

  // 3. ParcelDetailsScreen mount: GET /trip-handler/{id}
  const detail = await call("GET", `/trip-handler/${tripId}`, { token });
  if (!detail.ok || !detail.json?.success) {
    record(
      "GET /trip-handler/{id}",
      false,
      `status ${detail.status}: ${detail.json?.error?.message ?? "?"}`,
    );
  } else {
    const trip = normalizeTrip(detail.json.data);
    record(
      "GET /trip-handler/{id}",
      !!trip?.id,
      `id=${trip.id.slice(0, 8)}…, status=${trip.status}, capacity_kg=${trip.luggage_capacity_kg}`,
    );

    // Field-shape validation
    console.log("\n— Detail field shape —");
    for (const key of RENDERED_FIELDS) {
      const v = trip[key];
      const ok = v !== undefined && v !== null;
      record(`field "${key}"`, ok, ok ? JSON.stringify(v).slice(0, 80) : "(missing)");
    }
    // Capacity post-normalize
    record(
      'field "luggage_capacity_kg" (post-normalize)',
      typeof trip.luggage_capacity_kg === "number" && trip.luggage_capacity_kg > 0,
      `luggage_capacity_kg=${trip.luggage_capacity_kg}`,
    );
    // offers_count is rendered in the metric grid; smoke check it's a number
    record(
      'field "offers_count" is numeric',
      typeof trip.offers_count === "number",
      `offers_count=${trip.offers_count}`,
    );
  }

  // 4. PUT /trip-handler/{id} — Edit modal sends travel_date + luggage_capacity
  //    (server expects `luggage_capacity`, mobile aliases from luggage_capacity_kg).
  const newDeparture = new Date();
  newDeparture.setDate(newDeparture.getDate() + 21);
  const newDepartureYmd = newDeparture.toISOString().slice(0, 10);
  const newCapacity = 18;

  const updated = await call("PUT", `/trip-handler/${tripId}`, {
    token,
    body: {
      travel_date: newDepartureYmd,
      luggage_capacity: newCapacity,
      // notes is sent for parity with web, but trip-handler's allowedFields
      // does NOT include 'notes' (server-side gap shared with web). We assert
      // the round-trip below — if travel_date + capacity persist but notes
      // don't, the Edit modal's date/capacity work and notes is a known no-op.
      notes: "Smoke test note — should be silently ignored by server",
    },
  });

  if (!updated.ok || !updated.json?.success) {
    record(
      "PUT /trip-handler/{id} (edit)",
      false,
      `status ${updated.status}: ${updated.json?.error?.message ?? "?"}`,
    );
  } else {
    record("PUT /trip-handler/{id} (edit)", true, `status=${updated.status}`);
  }

  // 5. Re-fetch and verify travel_date + capacity round-tripped.
  const reread = await call("GET", `/trip-handler/${tripId}`, { token });
  if (reread.ok && reread.json?.data) {
    const trip = normalizeTrip(reread.json.data);
    record(
      "edit round-trip: travel_date saved",
      trip.travel_date === newDepartureYmd,
      `expected=${newDepartureYmd}, actual=${trip.travel_date}`,
    );
    record(
      "edit round-trip: luggage_capacity saved",
      trip.luggage_capacity_kg === newCapacity,
      `expected=${newCapacity}, actual=${trip.luggage_capacity_kg}`,
    );
    // Notes: server-side gap (notes not in trip-handler allowedFields). Don't
    // assert; just report so we know if this changes upstream.
    console.log(
      `  · notes round-trip: server returned ${JSON.stringify(trip.notes ?? null)} (notes is not in trip-handler allowedFields — known server-side gap)`,
    );
  } else {
    record("re-fetch after edit", false, `status ${reread.status}`);
  }

  // 6. Bogus id — should NOT 200. Drives the "Trip not found" branch.
  const bogus = await call("GET", "/trip-handler/00000000-0000-0000-0000-000000000000", {
    token,
  });
  record(
    "bogus id returns non-2xx OR success:false",
    !bogus.ok || bogus.json?.success === false,
    `status ${bogus.status}, success=${bogus.json?.success}`,
  );

  // 7. DELETE /trip-handler/{id} — Cancel Trip cleanup
  const del = await call("DELETE", `/trip-handler/${tripId}`, { token });
  record(
    "DELETE /trip-handler/{id} (cancel/cleanup)",
    del.ok || del.status === 200,
    `status ${del.status}`,
  );

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
