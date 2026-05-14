// SendParcelScreen smoke test.
//
// Proves end-to-end against the live Supabase project:
//   1. Login
//   2. POST /parcel-handler/ — create a probe parcel with the exact payload
//      shape SendParcelScreen sends (all required fields + sensible defaults)
//   3. GET /parcel-handler/?filter=my_parcels — verify the new parcel shows
//      up in the user's "My Travels → Send" list with the same fields
//   4. DELETE /parcel-handler/{id} — clean up the probe so the user's
//      inbox isn't polluted
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestSendParcel.mjs
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

  console.log(`Smoke testing SendParcelScreen against ${SUPABASE_URL}\n`);

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

  // 2. Create a probe parcel — payload MUST match what SendParcelScreen sends:
  //    server-side `weight` field name (mobile's parcelsApi.create renames
  //    weight_kg → weight before POST), all other fields verbatim.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 7);
  const yyyy = tomorrow.getFullYear();
  const mm = `${tomorrow.getMonth() + 1}`.padStart(2, "0");
  const dd = `${tomorrow.getDate()}`.padStart(2, "0");
  const deliveryBy = `${yyyy}-${mm}-${dd}`;

  const probeDescription = `[smoke-test ${new Date().toISOString()}] sendparcel probe`;
  const probePayload = {
    from_city: "Mumbai, MH",
    from_country: "IN",
    to_city: "New York (JFK), NY",
    to_country: "US",
    category: "documents",
    weight: 1.5, // mobile renames weight_kg → weight
    description: probeDescription,
    delivery_by: deliveryBy,
    fee_offered: 25,
    fee_currency: "USD",
    any_from: false,
    any_to: false,
  };

  const created = await call("POST", "/parcel-handler/", { token, body: probePayload });
  if (!created.ok || !created.json?.data?.id) {
    record(
      "POST /parcel-handler/ (create probe)",
      false,
      `status ${created.status}: ${JSON.stringify(created.json?.error ?? {}).slice(0, 200)}`,
    );
    process.exit(1);
  }
  const newParcel = created.json.data;
  record(
    "POST /parcel-handler/ (create probe)",
    true,
    `id=${newParcel.id?.slice(0, 8)}…, status=${newParcel.status}`,
  );

  // 3. Field-shape sanity check on the created row
  console.log("\n— Created parcel field shape —");
  for (const k of [
    "id",
    "sender_id",
    "from_city",
    "from_country",
    "to_city",
    "to_country",
    "category",
    "delivery_by",
    "fee_offered",
    "status",
    "created_at",
  ]) {
    const v = newParcel[k];
    const ok = v !== undefined && v !== null;
    record(`field "${k}"`, ok, ok ? JSON.stringify(v).slice(0, 80) : "(missing)");
  }
  // weight may come back as `weight` or `weight_kg` depending on edge; mobile
  // normaliser handles both. Assert at least one is present.
  const weightVal = newParcel.weight ?? newParcel.weight_kg;
  record(
    'field "weight" OR "weight_kg"',
    weightVal !== undefined && weightVal !== null,
    `weight=${newParcel.weight ?? "(none)"}, weight_kg=${newParcel.weight_kg ?? "(none)"}`,
  );

  // 4. Verify it appears in the user's My Parcels list
  const list = await call("GET", "/parcel-handler/", {
    token,
    query: { filter: "my_parcels", page: 1, per_page: 50 },
  });
  if (!list.ok) {
    record("GET /parcel-handler/?filter=my_parcels", false, `status ${list.status}`);
  } else {
    const found = (list.json?.data ?? []).find((p) => p.id === newParcel.id);
    record(
      "verify probe shows up in My Parcels",
      !!found,
      found ? `route ${found.from_city} → ${found.to_city}` : "(not found)",
    );
  }

  // 5. Cleanup — delete the probe so the user's data isn't polluted.
  const del = await call("DELETE", `/parcel-handler/${newParcel.id}`, { token });
  record(
    "DELETE /parcel-handler/{id} (cleanup)",
    del.ok || del.status === 200,
    `status ${del.status}`,
  );

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
