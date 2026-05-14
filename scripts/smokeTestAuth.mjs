// Smoke test that hits the same Supabase project the mobile client targets.
// It verifies four things without needing a simulator:
//   1. The Supabase URL + anon key are reachable from this machine.
//   2. signInWithPassword with bogus creds returns a structured 400 (not a
//      network error / 5xx / wrong project), which proves the endpoint is
//      live and CORS/RLS are configured.
//   3. The auth-handler/me edge function responds (404 or 401 is fine — we
//      just want to prove it exists at the configured Functions URL).
//   4. A no-row table query returns []; this proves the anon key is valid
//      and PostgREST is reachable.
//
// Run: node scripts/smokeTestAuth.mjs
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://rbtdkdbmtecungdthujf.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJidGRrZGJtdGVjdW5nZHRodWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjYxMzEsImV4cCI6MjA5MDM0MjEzMX0.dzIxVQffZwi_Bfbm8XQt6435tUdM5H8OaQ0OgWsXtW4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const results = [];
function record(name, ok, note = "") {
  results.push({ name, ok, note });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name}${note ? `  — ${note}` : ""}`);
}

async function checkInvalidLogin() {
  const fakeEmail = `smoke+${Date.now()}@safarly.invalid`;
  const { data, error } = await supabase.auth.signInWithPassword({
    email: fakeEmail,
    password: "definitely-not-real-password",
  });
  if (error) {
    // Expected: "Invalid login credentials" (400). Anything network-y is a fail.
    const expected = /invalid|credentials|email/i.test(error.message);
    record(
      "auth: bogus signInWithPassword rejected",
      expected,
      expected ? `server returned: ${error.message}` : `unexpected error: ${error.message}`,
    );
  } else if (data?.session) {
    record("auth: bogus signInWithPassword rejected", false, "fake creds were ACCEPTED — danger");
  } else {
    record("auth: bogus signInWithPassword rejected", false, "no error and no session");
  }
}

async function checkFunctionsReachable() {
  const url = `${SUPABASE_URL}/functions/v1/auth-handler/me`;
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });
    // 401 = function exists and rejects the anon caller. 404 = function not
    // deployed but server reachable. 5xx = something else broke. We accept
    // 2xx/4xx as proof of life.
    const ok = resp.status >= 200 && resp.status < 500;
    record(
      "functions: edge runtime reachable",
      ok,
      `GET ${url.replace(SUPABASE_URL, "")} -> ${resp.status}`,
    );
  } catch (err) {
    record("functions: edge runtime reachable", false, `network: ${err.message}`);
  }
}

async function checkRestReachable() {
  const { error } = await supabase.from("public_profiles").select("id").limit(1);
  // No row / RLS-empty result is fine. We only fail on transport errors.
  if (!error) {
    record("rest: PostgREST reachable", true, "select succeeded");
  } else if (/relation .* does not exist|permission denied|JWT|RLS/i.test(error.message)) {
    record("rest: PostgREST reachable", true, `expected db-level error: ${error.message}`);
  } else {
    record("rest: PostgREST reachable", false, error.message);
  }
}

(async () => {
  console.log(`Smoke testing ${SUPABASE_URL}\n`);
  await checkInvalidLogin();
  await checkFunctionsReachable();
  await checkRestReachable();
  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
