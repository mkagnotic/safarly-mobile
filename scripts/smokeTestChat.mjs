// Chat round-trip smoke test (OfferChatScreen).
//
// Proves end-to-end against the live Supabase project that:
//   1. List the user's conversations to pick one with at least one prior message.
//   2. GET /message-handler/conversations/:id/messages returns the messages
//      with the field set the screen renders.
//   3. POST /message-handler/conversations/:id/messages sends a probe text and
//      we get the message id back.
//   4. The next GET reflects the new probe message.
//   5. POST /:id/mark-delivered exists behind auth.
//   6. PUT /:id/unmatch + POST /:id/block + DELETE /:id/block exist behind auth.
//
// Cleanup: deletes nothing (server has no message-delete endpoint exposed); the
// probe message will appear in your inbox as "[smoke-test ...]" — easy to ignore
// or delete manually from the web UI.
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestChat.mjs
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

  console.log(`Smoke testing OfferChatScreen against ${SUPABASE_URL}\n`);

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

  // 2. List conversations to pick one with prior history
  const list = await call("GET", "/message-handler/conversations", {
    token,
    query: { page: 1, per_page: 50 },
  });
  if (!list.ok) {
    record("list conversations", false, `status ${list.status}`);
    process.exit(1);
  }
  const convs = list.json?.data ?? [];
  // Prefer a conversation we don't have ourselves on both sides + has last_message_at
  const target = convs.find(
    (c) =>
      c.participant_1 !== c.participant_2 &&
      c.participant?.id !== userId &&
      c.last_message_at,
  );
  if (!target) {
    record("pick a target conversation", false, "no eligible conversation found");
    process.exit(1);
  }
  record(
    "pick a target conversation",
    true,
    `${target.participant?.name ?? "?"}  (${target.id.slice(0, 8)}…, status=${target.match_status})`,
  );

  // 3. GET messages
  const beforeMsgs = await call(
    "GET",
    `/message-handler/conversations/${target.id}/messages`,
    { token, query: { limit: 50 } },
  );
  if (!beforeMsgs.ok) {
    record("GET /:id/messages", false, `status ${beforeMsgs.status}`);
    process.exit(1);
  }
  const beforeList = beforeMsgs.json?.data?.messages ?? [];
  record(
    "GET /:id/messages",
    true,
    `${beforeList.length} message(s) loaded, has_more=${beforeMsgs.json?.data?.has_more}`,
  );

  // 4. Field-shape of first message (the screen will render these fields).
  //    Server may return `from_user_id` OR `sender_id` (or both) — the screen
  //    checks both via `m.sender_id === user.id || m.from_user_id === user.id`,
  //    so we accept either here.
  if (beforeList.length > 0) {
    console.log("\n— First message field shape (what the bubble renders) —");
    const m = beforeList[0];
    for (const k of ["id", "conversation_id", "text", "created_at"]) {
      const v = m[k];
      const ok = v !== undefined && v !== null;
      record(`field "${k}"`, ok, ok ? JSON.stringify(v).slice(0, 80) : "(missing)");
    }
    const hasOwner = m.sender_id !== undefined || m.from_user_id !== undefined;
    record(
      `field "sender_id" OR "from_user_id"`,
      hasOwner,
      `sender_id=${m.sender_id ?? "(none)"}, from_user_id=${m.from_user_id ?? "(none)"}`,
    );
    console.log(`  + attachment_url = ${m.attachment_url ?? "(none)"}`);
    console.log(`  + attachment_type = ${m.attachment_type ?? "(none)"}`);
    console.log(`  + sender = ${m.sender ? JSON.stringify({ name: m.sender.name }) : "(none)"}`);
  }

  // 5. mark-delivered (fire-and-forget, but verify endpoint is alive)
  const delivered = await call(
    "POST",
    `/message-handler/conversations/${target.id}/mark-delivered`,
    { token },
  );
  record(
    "POST /:id/mark-delivered",
    delivered.ok || delivered.status === 200,
    `status ${delivered.status}`,
  );

  // 6. Send a probe text message
  const probeText = `[smoke-test ${new Date().toISOString()}] hi from chat smoke test`;
  const sent = await call(
    "POST",
    `/message-handler/conversations/${target.id}/messages`,
    { token, body: { text: probeText } },
  );
  if (!sent.ok) {
    record("POST /:id/messages (probe send)", false, `status ${sent.status}: ${sent.json?.error?.message ?? "?"}`);
    process.exit(1);
  }
  const sentMsg = sent.json?.data;
  record(
    "POST /:id/messages (probe send)",
    !!sentMsg?.id,
    `created id=${sentMsg?.id?.slice(0, 8) ?? "?"}…, text echoed=${sentMsg?.text === probeText}`,
  );

  // 7. Re-GET — verify the probe is now in the list
  const afterMsgs = await call(
    "GET",
    `/message-handler/conversations/${target.id}/messages`,
    { token, query: { limit: 50 } },
  );
  const afterList = afterMsgs.json?.data?.messages ?? [];
  const found = afterList.find((m) => m.text === probeText);
  record(
    "verify probe message appears on next GET",
    !!found,
    found ? `id=${found.id.slice(0, 8)}…, sender=${found.sender_id?.slice(0, 8)}…` : "(not found)",
  );

  // 8. Action endpoints exist behind auth — anon → 401 (don't actually call as Mahesh).
  console.log("\n— Action endpoints exist (anon → 401 expected) —");
  const u1 = await call("PUT", `/message-handler/conversations/${target.id}/unmatch`);
  record("PUT /:id/unmatch requires auth", u1.status === 401, `status ${u1.status}`);
  const b1 = await call("POST", `/message-handler/conversations/${target.id}/block`);
  record("POST /:id/block requires auth", b1.status === 401, `status ${b1.status}`);
  const b2 = await call("DELETE", `/message-handler/conversations/${target.id}/block`);
  record("DELETE /:id/block requires auth", b2.status === 401, `status ${b2.status}`);

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
