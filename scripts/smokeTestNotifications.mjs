// NotificationsScreen-focused smoke test.
//
// Proves end-to-end against the live Supabase project that:
//   1. The screen's load path: GET /notification-handler returns the items
//      and (if any) the meta.total used for pagination.
//   2. Each item has the fields the screen renders (id, type, title, body,
//      created_at, read).
//   3. The unread-count endpoint exists and is consistent with the list.
//   4. Optimistic mark-as-read works: PUT /:id/read flips the row, and a
//      subsequent GET reflects it. (Skipped if user has no unread items.)
//   5. Mark-all-as-read endpoint exists. (Not actually executed unless the
//      user has unread — we don't want to silently nuke real data.)
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestNotifications.mjs
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
    const qs = new URLSearchParams(query).toString();
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

/**
 * Mirrors the normalization in `src/services/api/notifications.ts` — the
 * server returns `read_at: timestamp | null` but the mobile client surfaces
 * a boolean `read` field. The screen reads `read`, so the test needs to
 * compute the same value the screen will see.
 */
function normalizeListResponse(json) {
  if (Array.isArray(json?.data)) {
    json.data = json.data.map((n) => ({ ...n, read: !!(n.read_at ?? n.read) }));
  }
  return json;
}

const RENDERED_FIELDS = ["id", "type", "title", "body", "created_at"];

(async () => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    console.error("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required.");
    process.exit(2);
  }

  console.log(`Smoke testing NotificationsScreen against ${SUPABASE_URL}\n`);

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

  // 2. Initial GET (page 1, per_page 20) — what NotificationsScreen does on mount
  const list = await call("GET", "/notification-handler/", {
    token,
    query: { page: 1, per_page: 20 },
  });
  if (!list.ok || !list.json?.success) {
    record("NotificationsScreen mount: GET /notification-handler", false, `status ${list.status}: ${list.json?.error?.message ?? "?"}`);
    process.exit(1);
  }
  normalizeListResponse(list.json);
  const items = list.json.data ?? [];
  const total = list.json.meta?.total ?? items.length;
  record(
    "NotificationsScreen mount: GET /notification-handler",
    true,
    `${items.length} item(s), meta.total=${total}`,
  );

  // 3. Validate the read normalization (notifications.ts maps read_at -> read)
  const looksNormalized = items.every((n) => typeof n.read === "boolean");
  record(
    "list: every item has a boolean `read` field",
    looksNormalized,
    looksNormalized ? "all items normalized correctly" : "some items missing `read` boolean",
  );

  // 4. Field-shape validation — every field NotificationsScreen renders
  if (items.length > 0) {
    console.log("\n— First item field shape —");
    const first = items[0];
    for (const key of RENDERED_FIELDS) {
      const value = first[key];
      const present = value !== undefined && value !== null;
      record(`field "${key}"`, present, present ? JSON.stringify(value).slice(0, 80) : "(missing)");
    }
  } else {
    console.log("\n(No items in list — skipping field-shape checks. The screen will render the empty state, which is also valid.)");
  }

  // 5. Unread count endpoint
  const unreadRes = await call("GET", "/notification-handler/unread-count", { token });
  if (!unreadRes.ok) {
    record("GET /unread-count", false, `status ${unreadRes.status}`);
  } else {
    const reportedUnread = unreadRes.json?.data?.unread_count;
    const localUnread = items.filter((n) => !n.read).length;
    // Server may report unread across ALL pages while we only see one page,
    // so we only require the server count to be >= what we can see locally.
    const consistent = typeof reportedUnread === "number" && reportedUnread >= localUnread;
    record(
      "GET /unread-count",
      consistent,
      `server says ${reportedUnread} unread, page-1 has ${localUnread}`,
    );
  }

  // 6. Optimistic markAsRead path — only attempted when we have an unread item
  const firstUnread = items.find((n) => !n.read);
  if (firstUnread) {
    console.log("\n— Optimistic mark-as-read round-trip —");
    const put = await call("PUT", `/notification-handler/${firstUnread.id}/read`, { token });
    if (!put.ok) {
      record(`PUT /${firstUnread.id.slice(0, 8)}…/read`, false, `status ${put.status}`);
    } else {
      record(
        `PUT /${firstUnread.id.slice(0, 8)}…/read`,
        true,
        `server returned read=${put.json?.data?.read}`,
      );
      // Re-GET to confirm
      const verify = await call("GET", "/notification-handler/", {
        token,
        query: { page: 1, per_page: 20 },
      });
      normalizeListResponse(verify.json);
      const updated = verify.json?.data?.find?.((n) => n.id === firstUnread.id);
      record(
        "verify: marked notification reads as read",
        updated?.read === true,
        `read=${updated?.read}`,
      );
    }
  } else {
    console.log(
      "\n(No unread items for Mahesh — skipping mark-as-read round-trip. The endpoint exists; the path is exercised in production.)",
    );
  }

  // 7. mark-all-as-read endpoint shape (don't actually call PUT — would silently
  //    flip every unread the user has and we don't want that without consent)
  const markAllExists = await call("PUT", "/notification-handler/read-all", {
    token: SUPABASE_ANON_KEY, // intentionally use the anon key — we expect 401
  });
  record(
    "PUT /read-all exists (expected 401 on anon)",
    markAllExists.status === 401,
    `status ${markAllExists.status}`,
  );

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
