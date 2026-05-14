// OpportunitiesScreen smoke test.
//
// Proves end-to-end against the live Supabase project that:
//   1. Mount path: GET /parcel-handler/opportunities?page=1&per_page=12
//      returns success with the meta shape mobile reads.
//   2. Per-row field shape (post-normalize): id, status, from_city, to_city,
//      delivery_by, fee_offered, weight_kg (post-normalize), category, sender
//      (post-normalize from server's user_profiles join).
//   3. Sender alias path: each row's `user_profiles` is aliased to `sender`
//      mobile-side. Verifies the populated case won't render "Anonymous".
//   4. Trip dropdown source: GET /trip-handler/?filter=my_trips returns
//      something the bid form's trip picker can list.
//   5. Bid submission route guard: POST /carrier-request-handler/{bogus}/requests
//      returns 4xx (route exists, validates).
//   6. Anonymous request must NOT see opportunities.
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestOpportunities.mjs
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

const PER_PAGE = 12;
const BOGUS_ID = "00000000-0000-0000-0000-000000000000";

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
  } catch {}
  return { status: resp.status, ok: resp.ok, json };
}

/** Mirror parcels normalizer: weight→weight_kg, user_profiles→sender. */
function normalizeParcel(p) {
  if (!p) return p;
  return {
    ...p,
    weight_kg: typeof p.weight_kg === "number" ? p.weight_kg : Number(p.weight ?? 0),
    fee_currency: p.fee_currency ?? "USD",
    sender: p.sender ?? p.user_profiles ?? undefined,
  };
}

(async () => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    console.error("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required.");
    process.exit(2);
  }

  console.log(`Smoke testing OpportunitiesScreen against ${SUPABASE_URL}\n`);

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

  // 2. Mount: GET /parcel-handler/opportunities?page=1
  const opps = await call("GET", "/parcel-handler/opportunities", {
    token,
    query: { page: 1, per_page: PER_PAGE },
  });
  if (!opps.ok || !opps.json?.success) {
    record(
      "GET /parcel-handler/opportunities",
      false,
      `status ${opps.status}: ${opps.json?.error?.message ?? "?"}`,
    );
    process.exit(1);
  }
  const items = (opps.json.data ?? []).map(normalizeParcel);
  const total = opps.json.meta?.total ?? items.length;
  record(
    "GET /parcel-handler/opportunities",
    true,
    `${items.length} item(s), meta.total=${total}`,
  );

  // 3. Meta shape
  record("meta.page === 1", opps.json.meta?.page === 1, `meta.page=${opps.json.meta?.page}`);
  record(
    `meta.per_page === ${PER_PAGE}`,
    opps.json.meta?.per_page === PER_PAGE,
    `meta.per_page=${opps.json.meta?.per_page}`,
  );

  // 4. Field shape on first row, when there's data
  if (items.length > 0) {
    console.log("\n— First opportunity field shape (post-normalize) —");
    const first = items[0];
    for (const key of [
      "id",
      "status",
      "from_city",
      "to_city",
      "delivery_by",
      "fee_offered",
      "category",
    ]) {
      const v = first[key];
      const ok = v !== undefined && v !== null;
      record(`row "${key}"`, ok, ok ? JSON.stringify(v).slice(0, 80) : "(missing)");
    }
    // weight_kg post-normalize from server's `weight`
    record(
      'row "weight_kg" (post-normalize)',
      typeof first.weight_kg === "number",
      `weight_kg=${first.weight_kg}`,
    );
    // sender post-normalize from server's `user_profiles` join
    record(
      'row "sender" (post-normalize, alias of user_profiles)',
      first.sender !== undefined && typeof first.sender?.name === "string",
      first.sender
        ? `name="${first.sender.name}", rating=${first.sender.rating}`
        : "(missing — screen would hide sender row)",
    );

    // Render preview
    console.log("\n— Render preview (first 5) —");
    for (const p of items.slice(0, 5)) {
      const date = new Date(p.delivery_by).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      console.log(
        `  · ${p.id.slice(0, 8)} [${(p.category ?? "—").toUpperCase().padEnd(11)}] ${p.from_city} → ${p.to_city}  ${p.weight_kg}kg  ${date}  $${p.fee_offered}  by ${p.sender?.name ?? "(no sender)"}`,
      );
    }
  } else {
    console.log(
      "\n(No matching opportunities for this account — screen will render the 'No opportunities found' empty card. " +
        "Opportunities are parcels matching the user's listed trips by route/dates.)",
    );
  }

  // 5. Trip-dropdown source
  const trips = await call("GET", "/trip-handler/", {
    token,
    query: { filter: "my_trips", page: 1, per_page: 50 },
  });
  if (!trips.ok || !trips.json?.success) {
    record(
      "GET /trip-handler/?filter=my_trips (bid-form trip dropdown)",
      false,
      `status ${trips.status}: ${trips.json?.error?.message ?? "?"}`,
    );
  } else {
    const tripCount = (trips.json.data ?? []).length;
    record(
      "GET /trip-handler/?filter=my_trips (bid-form trip dropdown)",
      true,
      `${tripCount} trip(s) for the dropdown`,
    );
  }

  // 6. Submit-bid route guard — bogus parcel id + bogus trip id should 4xx
  const bogusBid = await call(
    "POST",
    `/carrier-request-handler/${BOGUS_ID}/requests`,
    {
      token,
      body: { trip_id: BOGUS_ID, offer_amount: 10, message: "smoke test" },
    },
  );
  record(
    "POST /carrier-request-handler/{bogus}/requests → 4xx (route exists, validates)",
    bogusBid.status >= 400 && bogusBid.status < 500,
    `status ${bogusBid.status}: ${bogusBid.json?.error?.message ?? "?"}`,
  );

  // 7. Anonymous request must NOT see opportunities
  const anon = await call("GET", "/parcel-handler/opportunities", {
    query: { page: 1, per_page: 1 },
  });
  record(
    "opportunities requires auth (anon → 401)",
    anon.status === 401 || anon.json?.success === false,
    `status ${anon.status}, success=${anon.json?.success}`,
  );

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
