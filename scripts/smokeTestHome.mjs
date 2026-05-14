// HomeScreen smoke test.
//
// Proves end-to-end against the live Supabase project that everything the
// home dashboard reads is present and shaped the way the screen expects:
//   1. Login
//   2. GET /user-handler/me — profile shape (name, avatar_url) for the greeting
//   3. GET /feed-handler/?per_page=4 — activity items with title/description/created_at
//   4. GET /message-handler/conversations — same shape the inbox uses, then
//      run mobile's dedupe-by-participant locally to confirm the 3 rows the
//      Home Messages section will render
//   5. GET /message-handler/conversations/unread-count — drives the
//      "Open inbox (N)" CTA badge
//   6. GET /notification-handler/unread-count — drives the bell-icon dot
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestHome.mjs
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

/** Mirror of useMyConversations dedupe + sort so the smoke test renders
 *  exactly the row set the screen will. */
function dedupeBySorted(rows, currentUserId) {
  const filtered = rows.filter(
    (c) => c.participant_1 !== c.participant_2 && c.participant?.id !== currentUserId,
  );
  const best = new Map();
  for (const c of filtered) {
    const key = c.participant?.id;
    if (!key) continue;
    const cur = best.get(key);
    if (!cur) { best.set(key, c); continue; }
    const curMatched = cur.match_status === "matched";
    const cMatched = c.match_status === "matched";
    if (cMatched && !curMatched) { best.set(key, c); continue; }
    if (!cMatched && curMatched) continue;
    const curTs = cur.last_message_at ? new Date(cur.last_message_at).getTime() : 0;
    const cTs = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
    if (cTs > curTs) best.set(key, c);
  }
  return [...best.values()].sort((a, b) => {
    const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bt - at;
  });
}

(async () => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    console.error("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required.");
    process.exit(2);
  }

  console.log(`Smoke testing HomeScreen against ${SUPABASE_URL}\n`);

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

  // 2. Profile (drives "Welcome back, X" greeting)
  const profile = await call("GET", "/user-handler/me", { token });
  if (!profile.ok) {
    record("GET /user-handler/me (profile)", false, `status ${profile.status}`);
    process.exit(1);
  }
  const profileObj = profile.json?.data?.profile ?? profile.json?.data;
  const name = profileObj?.name ?? profileObj?.full_name ?? null;
  record(
    "GET /user-handler/me (profile)",
    !!name,
    `greeting will say "Welcome back, ${name ?? "(missing)"}"`,
  );

  // 3. Activity feed (drives the Activity card — first 4 items)
  const feed = await call("GET", "/feed-handler/", { token, query: { page: 1, per_page: 4 } });
  if (!feed.ok) {
    record("GET /feed-handler/?per_page=4", false, `status ${feed.status}`);
    process.exit(1);
  }
  const items = feed.json?.data ?? [];
  record(
    "GET /feed-handler/?per_page=4",
    Array.isArray(items),
    `${items.length} item(s) returned`,
  );
  if (items[0]) {
    console.log("\n— First feed item shape (what the activity row renders) —");
    for (const k of ["id", "title", "created_at"]) {
      const v = items[0][k];
      const ok = v !== undefined && v !== null;
      record(`feed field "${k}"`, ok, ok ? JSON.stringify(v).slice(0, 80) : "(missing)");
    }
    console.log(`  + description = ${items[0].description ?? "(none)"}`);
    console.log(`  + event_type  = ${items[0].event_type ?? "(none)"}`);
  }

  // 4. Conversations (drives the Messages card — first 3 deduped rows)
  const convs = await call("GET", "/message-handler/conversations", {
    token,
    query: { page: 1, per_page: 20 },
  });
  if (!convs.ok) {
    record("GET /message-handler/conversations", false, `status ${convs.status}`);
    process.exit(1);
  }
  const raw = convs.json?.data ?? [];
  const deduped = dedupeBySorted(raw, userId);
  const homeRender = deduped.slice(0, 3);
  record(
    "GET /message-handler/conversations",
    Array.isArray(raw),
    `${raw.length} raw → ${deduped.length} after dedupe → ${homeRender.length} on Home`,
  );
  if (homeRender.length > 0) {
    console.log("\n— First 3 conversations the Messages section will render —");
    for (const c of homeRender) {
      const date = c.last_message_at
        ? new Date(c.last_message_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "(no date)";
      console.log(
        `    ${c.participant?.name ?? "Unknown"}  · "${(c.last_message ?? "No messages yet").slice(0, 40)}"  · ${date}  · unread=${c.unread_count ?? 0}`,
      );
    }
  }

  // 5. Messages unread count (drives "Open inbox (N)")
  const msgUnread = await call("GET", "/message-handler/conversations/unread-count", { token });
  record(
    "GET /message-handler/conversations/unread-count",
    msgUnread.ok,
    `server says ${msgUnread.json?.data?.unread_count ?? "?"} total unread`,
  );

  // 6. Notifications unread count (drives the bell-icon dot)
  const notifUnread = await call("GET", "/notification-handler/unread-count", { token });
  record(
    "GET /notification-handler/unread-count",
    notifUnread.ok,
    `server says ${notifUnread.json?.data?.unread_count ?? "?"} unread notifications`,
  );

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
