// ParcelsScreen-focused smoke test.
//
// Proves end-to-end against the live Supabase project that:
//   1. The screen's load path: GET /parcel-handler/?filter=my_parcels returns
//      the field set the screen renders (id, status, from_city, to_city,
//      weight_kg, delivery_by, fee_offered, fee_currency, category, sender).
//   2. Each filter chip the screen exposes (Open / In Transit / Delivered /
//      Disputed) round-trips correctly via the `status` query param.
//   3. The 'all' filter (no status) returns >= every status-scoped subset.
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestParcels.mjs
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
    /* non-JSON body */
  }
  return { status: resp.status, ok: resp.ok, json };
}

const RENDERED_FIELDS = [
  "id",
  "status",
  "from_city",
  "to_city",
  "weight_kg",
  "delivery_by",
  "fee_offered",
  "fee_currency",
  "category",
];

/**
 * Mirrors the normalization in `src/services/api/parcels.ts`:
 *   - Server returns `weight` (not `weight_kg`) — alias it.
 *   - Server may omit `fee_currency` — default to "USD".
 * Without this, the smoke test sees raw bytes and reports false-positive
 * "missing field" failures.
 */
function normalizeParcel(p) {
  return {
    ...p,
    weight_kg: typeof p.weight_kg === "number" ? p.weight_kg : Number(p.weight ?? 0),
    fee_currency: p.fee_currency ?? "USD",
  };
}

function normalizeListResponse(json) {
  if (Array.isArray(json?.data)) {
    json.data = json.data.map(normalizeParcel);
  }
  return json;
}

const FILTER_STATUSES = [
  { label: "All", status: undefined },
  { label: "Open", status: "open" },
  { label: "In Transit", status: "in_transit" },
  { label: "Delivered", status: "delivered" },
  { label: "Disputed", status: "disputed" },
];

(async () => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    console.error("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required.");
    process.exit(2);
  }

  console.log(`Smoke testing ParcelsScreen against ${SUPABASE_URL}\n`);

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

  // 2. ParcelsScreen mount: GET /parcel-handler/?filter=my_parcels (no status)
  const all = await call("GET", "/parcel-handler/", {
    token,
    query: { filter: "my_parcels", page: 1, per_page: 20 },
  });
  if (!all.ok || !all.json?.success) {
    record("ParcelsScreen mount: GET /parcel-handler", false, `status ${all.status}: ${all.json?.error?.message ?? "?"}`);
    process.exit(1);
  }
  normalizeListResponse(all.json);
  const allParcels = all.json.data ?? [];
  const allTotal = all.json.meta?.total ?? allParcels.length;
  record(
    "ParcelsScreen mount: GET /parcel-handler",
    true,
    `${allParcels.length} item(s) on page 1, meta.total=${allTotal}`,
  );

  // 3. Field-shape validation on the first row (only when there is data)
  if (allParcels.length > 0) {
    console.log("\n— First parcel field shape —");
    const first = allParcels[0];
    for (const key of RENDERED_FIELDS) {
      const value = first[key];
      const ok = value !== undefined;
      record(
        `field "${key}"`,
        ok,
        ok ? JSON.stringify(value).slice(0, 80) : "(missing)",
      );
    }
    if (first.sender) {
      console.log(`  + sender = ${JSON.stringify(first.sender)}`);
    } else {
      console.log("  + sender = (none)");
    }
  } else {
    console.log("\n(No parcels in list — the screen will render the rich empty state with 'Send Parcel' CTA.)");
  }

  // 4. Render preview for the first 5 parcels
  if (allParcels.length > 0) {
    console.log("\n— Render preview (first 5) —");
    for (const p of allParcels.slice(0, 5)) {
      const dateStr = p.delivery_by
        ? new Date(p.delivery_by).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "—";
      console.log(
        `  ${p.id.slice(0, 8).toUpperCase()}  [${p.status.toUpperCase().padEnd(11)}]  ${p.from_city} → ${p.to_city}  ${p.weight_kg}kg  ${dateStr}  ${p.fee_currency === "USD" ? "$" : ""}${p.fee_offered}${p.fee_currency !== "USD" ? " " + p.fee_currency : ""}`,
      );
    }
  }

  // 5. Each filter chip — verify status query routes through correctly
  console.log("\n— Filter chip round-trips —");
  let summedScoped = 0;
  for (const { label, status } of FILTER_STATUSES) {
    if (status === undefined) continue; // already done as "all" above
    const r = await call("GET", "/parcel-handler/", {
      token,
      query: { filter: "my_parcels", status, page: 1, per_page: 20 },
    });
    if (!r.ok) {
      record(`chip "${label}" (status=${status})`, false, `status ${r.status}`);
      continue;
    }
    normalizeListResponse(r.json);
    const items = r.json.data ?? [];
    const total = r.json.meta?.total ?? items.length;
    summedScoped += total;
    // Every returned item should match the requested status.
    const allMatch = items.every((p) => p.status === status);
    record(
      `chip "${label}" (status=${status})`,
      allMatch,
      `${items.length} item(s) on page, meta.total=${total}, all match status=${allMatch}`,
    );
  }

  // 6. Sanity check: scoped totals ≤ all (could be < if some statuses aren't covered, e.g. 'pending')
  record(
    "sanity: scoped totals ≤ all total",
    summedScoped <= allTotal,
    `sum(open+in_transit+delivered+disputed)=${summedScoped}, all=${allTotal}`,
  );

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
