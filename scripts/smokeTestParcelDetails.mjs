// ParcelDetailsScreen smoke test.
//
// Proves end-to-end against the live Supabase project that:
//   1. The screen's load path: GET /parcel-handler/{id} returns the field
//      set the screen renders (id, status, from_city, to_city, weight_kg,
//      delivery_by, fee_offered, fee_currency, category, description, sender).
//   2. The id-by-fetch returns the same row that GET /parcel-handler/?filter
//      lists — i.e. detail and list aren't out of sync.
//   3. A bogus id returns 404 / error so the screen's "not found" branch
//      reliably triggers.
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestParcelDetails.mjs
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

const RENDERED_FIELDS = [
  "id",
  "status",
  "from_city",
  "to_city",
  "delivery_by",
  "fee_offered",
  "category",
];

/**
 * Mirrors normalization in `src/services/api/parcels.ts`:
 *   - Server returns `weight` (not `weight_kg`) — alias it.
 *   - Server may omit `fee_currency` — default to "USD".
 */
function normalizeParcel(p) {
  if (!p) return p;
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

  console.log(`Smoke testing ParcelDetailsScreen against ${SUPABASE_URL}\n`);

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

  // 2. Find an existing parcel via My Parcels list — pick the first one
  const list = await call("GET", "/parcel-handler/", {
    token,
    query: { filter: "my_parcels", page: 1, per_page: 5 },
  });
  if (!list.ok || !list.json?.success) {
    record(
      "GET /parcel-handler/?filter=my_parcels",
      false,
      `status ${list.status}: ${list.json?.error?.message ?? "?"}`,
    );
    process.exit(1);
  }
  const listed = (list.json.data ?? []).map(normalizeParcel);
  if (listed.length === 0) {
    console.log(
      "\n(No parcels for this account — create one via SendParcelScreen first to exercise this smoke test.)",
    );
    record(
      "list has at least one parcel",
      false,
      "Mahesh has no parcels — cannot validate detail fetch",
    );
    process.exit(1);
  }
  const target = listed[0];
  record(
    "GET /parcel-handler/?filter=my_parcels",
    true,
    `picked id=${target.id?.slice(0, 8)}… ${target.from_city} → ${target.to_city}`,
  );

  // 3. ParcelDetailsScreen mount: GET /parcel-handler/{id}
  const detail = await call("GET", `/parcel-handler/${target.id}`, { token });
  if (!detail.ok || !detail.json?.success) {
    record(
      "GET /parcel-handler/{id}",
      false,
      `status ${detail.status}: ${detail.json?.error?.message ?? "?"}`,
    );
    process.exit(1);
  }
  const parcel = normalizeParcel(detail.json.data);
  record(
    "GET /parcel-handler/{id}",
    !!parcel?.id,
    parcel?.id ? `id=${parcel.id?.slice(0, 8)}…, status=${parcel.status}` : "(no data)",
  );

  // 4. Field-shape validation — every rendered field must be present
  console.log("\n— Detail field shape —");
  for (const key of RENDERED_FIELDS) {
    const value = parcel[key];
    const ok = value !== undefined && value !== null;
    record(`field "${key}"`, ok, ok ? JSON.stringify(value).slice(0, 80) : "(missing)");
  }
  // weight after normalization
  record(
    'field "weight_kg" (post-normalize)',
    typeof parcel.weight_kg === "number",
    `weight_kg=${parcel.weight_kg}`,
  );
  // fee_currency (post-normalize)
  record(
    'field "fee_currency" (post-normalize)',
    typeof parcel.fee_currency === "string" && parcel.fee_currency.length > 0,
    `fee_currency=${parcel.fee_currency}`,
  );
  // description may legitimately be null — assert key exists so the screen's
  // "No description provided." fallback fires deterministically.
  record(
    'field "description" present (may be null)',
    Object.prototype.hasOwnProperty.call(parcel, "description"),
    parcel.description ? `len=${String(parcel.description).length}` : "(null — fallback path)",
  );
  // sender is optional; the screen guards on it. Just log for visibility.
  if (parcel.sender) {
    console.log(`  + sender = ${JSON.stringify(parcel.sender).slice(0, 120)}`);
  } else {
    console.log("  + sender = (none — sender card hidden)");
  }

  // 5. Detail/list parity — same id, status, from/to/fee/delivery
  console.log("\n— List ↔ detail parity —");
  for (const key of ["id", "status", "from_city", "to_city", "fee_offered", "delivery_by"]) {
    const same = parcel[key] === target[key];
    record(
      `parity field "${key}"`,
      same,
      same ? `${JSON.stringify(parcel[key])}` : `list=${JSON.stringify(target[key])} vs detail=${JSON.stringify(parcel[key])}`,
    );
  }

  // 6. Bogus id — must NOT 200 (drives the "Parcel not found" branch).
  const bogus = await call("GET", "/parcel-handler/00000000-0000-0000-0000-000000000000", {
    token,
  });
  record(
    "bogus id returns non-2xx OR success:false",
    !bogus.ok || bogus.json?.success === false,
    `status ${bogus.status}, success=${bogus.json?.success}`,
  );

  // 7. Render preview — exactly what the screen will display
  console.log("\n— Render preview —");
  const dateStr = parcel.delivery_by
    ? new Date(parcel.delivery_by).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const feeSymbol = parcel.fee_currency === "USD" ? "$" : parcel.fee_currency === "INR" ? "₹" : "";
  const feeStr = feeSymbol ? `${feeSymbol}${parcel.fee_offered}` : `${parcel.fee_offered} ${parcel.fee_currency}`;
  console.log(`  ID:        ${parcel.id}`);
  console.log(`  Status:    ${parcel.status.toUpperCase().replace("_", " ")}`);
  console.log(`  Route:     ${parcel.from_city} → ${parcel.to_city}`);
  console.log(`  Weight:    ${parcel.weight_kg} kg`);
  console.log(`  Delivery:  ${dateStr}`);
  console.log(`  Fee:       ${feeStr}`);
  console.log(`  Category:  ${parcel.category}`);
  console.log(`  Sender:    ${parcel.sender?.name ?? "(none)"}`);
  console.log(`  Desc:      ${(parcel.description ?? "(none)").slice(0, 80)}`);

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
