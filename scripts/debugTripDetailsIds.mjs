// Debug: list Mahesh's real trips and call GET /trip-handler/{id} for each.
// Goal: prove the screen will get a valid response for every list-row id.
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
  try { json = await resp.json(); } catch {}
  return { status: resp.status, ok: resp.ok, json };
}

(async () => {
  const { data: signInData } = await supabase.auth.signInWithPassword({
    email: process.env.SMOKE_TEST_EMAIL ?? "mahesh.k@agnotic.com",
    password: process.env.SMOKE_TEST_PASSWORD ?? "1234567",
  });
  const token = signInData.session.access_token;

  // List my_trips (= active flights)
  const list = await call("GET", "/trip-handler/", {
    token,
    query: { filter: "my_trips", page: 1, per_page: 20 },
  });
  console.log(`my_trips total=${list.json?.meta?.total ?? 0}`);
  console.log(`raw row count: ${list.json?.data?.length ?? 0}`);
  console.log(`first row keys: ${Object.keys((list.json?.data ?? [])[0] ?? {}).join(", ")}`);
  console.log("");

  for (const t of list.json?.data ?? []) {
    console.log(`Row: id="${t.id}"  ${t.from_city} → ${t.to_city}  status=${t.status}  travel_date=${t.travel_date}`);
    // The exact call mobile makes
    const r = await call("GET", `/trip-handler/${t.id}`, { token });
    console.log(`  GET /trip-handler/${t.id}  → status=${r.status} success=${r.json?.success ?? "?"} data.id=${r.json?.data?.id ?? "(none)"}`);
    if (!r.ok) {
      console.log(`  error payload: ${JSON.stringify(r.json)}`);
    }
  }

  // my_archived too
  console.log("\n--- my_archived ---");
  const arch = await call("GET", "/trip-handler/", {
    token,
    query: { filter: "my_archived", page: 1, per_page: 20 },
  });
  console.log(`my_archived total=${arch.json?.meta?.total ?? 0}`);
  for (const t of arch.json?.data ?? []) {
    console.log(`Row: id="${t.id}"  ${t.from_city} → ${t.to_city}  status=${t.status}`);
    const r = await call("GET", `/trip-handler/${t.id}`, { token });
    console.log(`  GET → status=${r.status} success=${r.json?.success ?? "?"}`);
  }

  await supabase.auth.signOut();
})();
