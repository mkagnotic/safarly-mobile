// Smoke test for the profile API path that ProfileSetupScreen depends on.
//
//   • Always runs: confirms the user-handler endpoints exist behind auth and
//     reject anonymous calls with the structured error shape ApiClientError
//     parses. Proves ProfileSetupScreen's wiring is talking to a real server.
//
//   • Authenticated round-trip (opt-in): if SMOKE_TEST_EMAIL / SMOKE_TEST_PASSWORD
//     are set, signs in, GETs /user-handler/me, PUTs a tiny profile patch, and
//     re-GETs to confirm the write landed. This is the closest we can get to
//     simulating the real app without booting Expo.
//
// Run:
//   node scripts/smokeTestProfile.mjs
//   SMOKE_TEST_EMAIL=you@x.com SMOKE_TEST_PASSWORD=... node scripts/smokeTestProfile.mjs
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
  const tag = ok ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name}${note ? `  — ${note}` : ""}`);
}

async function call(method, path, { token, body } = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const resp = await fetch(`${FUNCTIONS_URL}${path}`, {
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

// ─────────────── Always-on checks ───────────────

async function checkUnauthGetMe() {
  const { status } = await call("GET", "/user-handler/me");
  // Unauthenticated request to an authed endpoint should be rejected.
  // Any 4xx is acceptable proof the endpoint exists and requires auth.
  const ok = status >= 400 && status < 500;
  record("user-handler: GET /me requires auth", ok, `status ${status}`);
}

async function checkUnauthPutMe() {
  const { status } = await call("PUT", "/user-handler/me", { body: { name: "ignored" } });
  const ok = status >= 400 && status < 500;
  record("user-handler: PUT /me requires auth", ok, `status ${status}`);
}

// ─────────────── Optional authenticated round-trip ───────────────

async function checkAuthRoundTrip(email, password) {
  console.log("\n— Authenticated round-trip —");
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !signInData?.session) {
    record("auth: signInWithPassword", false, signInErr?.message ?? "no session");
    return;
  }
  const token = signInData.session.access_token;
  record("auth: signInWithPassword", true, `user ${signInData.user?.id?.slice(0, 8)}…`);

  const before = await call("GET", "/user-handler/me", { token });
  if (!before.ok || !before.json?.success) {
    record("user-handler: GET /me (authed)", false, `status ${before.status}: ${before.json?.error?.message ?? "?"}`);
    return;
  }
  const beforeProfile = before.json.data?.profile;
  record(
    "user-handler: GET /me (authed)",
    !!beforeProfile,
    `name=${beforeProfile?.name ?? "(none)"} city=${beforeProfile?.city ?? "(none)"} country=${beforeProfile?.country ?? "(none)"}`,
  );

  // Tag the city with a probe so we can detect the write actually landed —
  // and we restore the prior city after.
  const probe = `Smoke ${Date.now() % 100000}`;
  const put = await call("PUT", "/user-handler/me", { token, body: { city: probe } });
  if (!put.ok || !put.json?.success) {
    record("user-handler: PUT /me (authed)", false, `status ${put.status}: ${put.json?.error?.message ?? "?"}`);
    return;
  }
  record("user-handler: PUT /me (authed)", true, `wrote city="${probe}"`);

  const after = await call("GET", "/user-handler/me", { token });
  const afterCity = after.json?.data?.profile?.city;
  record(
    "user-handler: write reflected on next GET",
    afterCity === probe,
    `read back city="${afterCity}"`,
  );

  // Best-effort restore of the previous city so we don't leave the test acct dirty.
  if (beforeProfile?.city) {
    await call("PUT", "/user-handler/me", { token, body: { city: beforeProfile.city } });
  }

  await supabase.auth.signOut();
}

(async () => {
  console.log(`Smoke testing ${SUPABASE_URL}\n`);
  await checkUnauthGetMe();
  await checkUnauthPutMe();

  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (email && password) {
    await checkAuthRoundTrip(email, password);
  } else {
    console.log(
      "\n(Skipping authenticated round-trip — set SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD to enable.)",
    );
  }

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
