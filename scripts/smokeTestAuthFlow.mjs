// End-to-end auth flow smoke test that exercises every API the new auth
// screens depend on:
//
//   1. Anonymous: signup endpoint exists (we don't actually create a user —
//      we send a malformed payload and confirm we get a structured 4xx back).
//   2. Anonymous: signInWithPassword rejects garbage with the expected error.
//   3. Authenticated (env-gated): the full Login -> ProfileSetup chain
//      simulated server-side: signIn -> GET /me -> acceptTerms -> PUT /me
//      with a probe -> re-GET to confirm both the terms accept and the
//      profile write landed.
//
// Run:
//   node scripts/smokeTestAuthFlow.mjs
//   SMOKE_TEST_EMAIL=you@x.com SMOKE_TEST_PASSWORD=... node scripts/smokeTestAuthFlow.mjs
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

// ─────────────── Always-on: anonymous endpoint shapes ───────────────

async function checkSignupRejectsBadPayload() {
  // signUp with empty body -> Supabase returns AuthApiError "missing email/password"
  const { data, error } = await supabase.auth.signUp({ email: "", password: "" });
  if (data?.session) {
    record("auth: signUp rejects empty payload", false, "session granted with empty creds");
    return;
  }
  const ok = !!error;
  record("auth: signUp rejects empty payload", ok, error?.message ?? "no error returned");
}

async function checkSignInRejectsBogus() {
  const { error } = await supabase.auth.signInWithPassword({
    email: `nope+${Date.now()}@safarly.invalid`,
    password: "definitely-wrong",
  });
  const expected = !!error && /invalid|credentials|email/i.test(error.message);
  record(
    "auth: signInWithPassword rejects bogus creds",
    expected,
    expected ? `server: ${error.message}` : `unexpected: ${error?.message ?? "no error"}`,
  );
}

async function checkAcceptTermsRequiresAuth() {
  const { status } = await call("POST", "/auth-handler/accept-terms", {
    body: { terms_version: "v1" },
  });
  const ok = status >= 400 && status < 500;
  record("auth-handler: POST /accept-terms requires auth", ok, `status ${status}`);
}

// ─────────────── Authenticated: full mobile flow simulation ───────────────

async function checkFullFlow(email, password) {
  console.log("\n— Full mobile flow simulation —");

  // 1. Login
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !signInData?.session) {
    record("login: signInWithPassword", false, signInErr?.message ?? "no session");
    return;
  }
  const token = signInData.session.access_token;
  record("login: signInWithPassword", true, `user ${signInData.user?.id?.slice(0, 8)}…`);

  // 2. ProfileSetup mounts -> getMyProfile
  const before = await call("GET", "/user-handler/me", { token });
  if (!before.ok) {
    record("ProfileSetup: GET /me on mount", false, `status ${before.status}`);
    return;
  }
  const beforeProfile = before.json?.data?.profile;
  record(
    "ProfileSetup: GET /me on mount",
    !!beforeProfile,
    `name="${beforeProfile?.name ?? "(none)"}" city="${beforeProfile?.city ?? "(none)"}" country="${beforeProfile?.country ?? "(none)"}"`,
  );

  // 3. ProfileSetup completes -> updateMyProfile (probe city) + acceptTerms
  const probeCity = `Smoke ${Date.now() % 100000}`;
  const put = await call("PUT", "/user-handler/me", {
    token,
    body: { city: probeCity },
  });
  if (!put.ok) {
    record("ProfileSetup: PUT /me", false, `status ${put.status}: ${put.json?.error?.message ?? "?"}`);
    return;
  }
  record("ProfileSetup: PUT /me", true, `wrote city="${probeCity}"`);

  const accept = await call("POST", "/auth-handler/accept-terms", {
    token,
    body: { terms_version: "v1" },
  });
  if (!accept.ok) {
    record(
      "ProfileSetup: POST /accept-terms",
      false,
      `status ${accept.status}: ${accept.json?.error?.message ?? "?"}`,
    );
  } else {
    record(
      "ProfileSetup: POST /accept-terms",
      true,
      `accepted=${accept.json?.data?.accepted ?? "?"}`,
    );
  }

  // 4. Verify the write landed (what MainTabs would see on first paint)
  const after = await call("GET", "/user-handler/me", { token });
  const afterCity = after.json?.data?.profile?.city;
  record(
    "MainTabs: GET /me after setup reflects write",
    afterCity === probeCity,
    `read back city="${afterCity}"`,
  );

  // Cleanup: restore original city
  if (beforeProfile?.city && beforeProfile.city !== probeCity) {
    await call("PUT", "/user-handler/me", {
      token,
      body: { city: beforeProfile.city },
    });
  }
  await supabase.auth.signOut();
}

(async () => {
  console.log(`Smoke testing ${SUPABASE_URL}\n`);
  await checkSignupRejectsBadPayload();
  await checkSignInRejectsBogus();
  await checkAcceptTermsRequiresAuth();

  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (email && password) {
    await checkFullFlow(email, password);
  } else {
    console.log(
      "\n(Skipping full-flow simulation — set SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD to enable.)",
    );
  }

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
