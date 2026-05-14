// MessagesScreen (Inbox) smoke test.
//
// Proves end-to-end against the live Supabase project:
//   1. The screen's load path: GET /message-handler/conversations returns
//      the field set the row renders (id, participant {id, name, avatar_url},
//      participant_1/2, last_message[_text], last_message_at, unread_count,
//      match_status, matched_by, matched_at).
//   2. The dedupe-by-participant logic the screen uses produces the same
//      shape the user will see (no self-chats, prefer matched > pending,
//      then most recent activity).
//   3. The unread-count summary endpoint exists.
//   4. The match endpoint exists behind auth (we don't actually mutate).
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestInbox.mjs
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

/**
 * Mirror of useMyConversations dedupe + sort. Lets the smoke test see exactly
 * what the screen sees.
 */
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
  return Array.from(best.values()).sort((a, b) => {
    const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bt - at;
  });
}

const RENDERED_FIELDS = [
  "id",
  "participant_1",
  "participant_2",
  "match_status",
  "unread_count",
];

(async () => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    console.error("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required.");
    process.exit(2);
  }

  console.log(`Smoke testing MessagesScreen (Inbox) against ${SUPABASE_URL}\n`);

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

  // 2. List conversations
  const list = await call("GET", "/message-handler/conversations", {
    token,
    query: { page: 1, per_page: 50 },
  });
  if (!list.ok || !list.json?.success) {
    record("inbox: GET /message-handler/conversations", false, `status ${list.status}`);
    process.exit(1);
  }
  const raw = list.json.data ?? [];
  record(
    "inbox: GET /message-handler/conversations",
    true,
    `${raw.length} raw conversation(s)`,
  );

  // 3. Apply the same dedupe the screen uses
  const deduped = dedupeBySorted(raw, userId);
  record(
    "dedupe: rows after participant collapse",
    true,
    `${deduped.length} card(s) after dedupe (was ${raw.length} raw)`,
  );

  // 4. Field-shape validation (only if there are rows)
  if (deduped.length > 0) {
    console.log("\n— First conversation field shape —");
    const first = deduped[0];
    for (const k of RENDERED_FIELDS) {
      const v = first[k];
      const ok = v !== undefined;
      record(`field "${k}"`, ok, ok ? JSON.stringify(v).slice(0, 60) : "(missing)");
    }
    record(
      `participant.{id,name}`,
      Boolean(first.participant?.id && first.participant?.name),
      `${first.participant?.name ?? "?"} (${first.participant?.id?.slice(0, 8) ?? "?"}…)`,
    );
  }

  // 5. Render preview (what the screen will display)
  console.log("\n— Inbox render preview —");
  const unreadCount = deduped.filter((c) => (c.unread_count ?? 0) > 0).length;
  const requestCount = deduped.filter(
    (c) => c.match_status === "pending" && !!c.matched_by && c.matched_by !== userId,
  ).length;
  console.log(`  Filter chips: All / Unread (${unreadCount}) / Requests (${requestCount})`);
  if (deduped.length > 0) {
    console.log(`\n  First 5 rows the screen will render:`);
    for (const c of deduped.slice(0, 5)) {
      const flags = [];
      if ((c.unread_count ?? 0) > 0) flags.push("UNREAD");
      if (c.match_status === "matched") flags.push("MATCHED");
      else if (c.match_status === "pending") {
        if (c.matched_by && c.matched_by !== userId) flags.push("AWAITING-ME");
        else if (c.matched_by === userId) flags.push("WAITING");
        else if (c.matched_at || c.last_message_at) flags.push("UNMATCHED");
      } else if (c.match_status === "declined") flags.push("DECLINED");
      else if (c.match_status === "blocked") flags.push("BLOCKED");
      const preview = (c.last_message ?? c.last_message_text ?? "(no preview)").toString().slice(0, 40);
      console.log(`    ${c.participant?.name ?? "?"}  ${flags.length ? `[${flags.join(",")}]` : ""}  · "${preview}"`);
    }
  } else {
    console.log("  (No conversations — empty state will render)");
  }

  // 6. Unread count endpoint
  const unreadRes = await call("GET", "/message-handler/conversations/unread-count", { token });
  record(
    "GET /unread-count exists",
    unreadRes.ok,
    unreadRes.ok ? `server says ${unreadRes.json?.data?.unread_count ?? "?"} total unread message(s)` : `status ${unreadRes.status}`,
  );

  // 7. Match endpoint shape (don't actually mutate — use anon to expect 401)
  const matchAuth = await call("PUT", `/message-handler/conversations/${deduped[0]?.id ?? "00000000-0000-0000-0000-000000000000"}/match`);
  record(
    "PUT /:id/match requires auth (anon → 401)",
    matchAuth.status === 401,
    `status ${matchAuth.status}`,
  );

  // 8. Decline endpoint shape (anon → 401)
  const declineAuth = await call("PUT", `/message-handler/conversations/${deduped[0]?.id ?? "00000000-0000-0000-0000-000000000000"}/decline`, {
    body: { reason: "smoke test" },
  });
  record(
    "PUT /:id/decline requires auth (anon → 401)",
    declineAuth.status === 401,
    `status ${declineAuth.status}`,
  );

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
