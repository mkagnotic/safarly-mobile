// ProfileScreen-focused smoke test.
//
// What this proves:
//   • The fields the new mobile ProfileScreen renders (`name`, `bio`,
//     `avatar_url`, `rating`, `total_trips`, `total_deliveries`,
//     `kyc_status`) are actually returned by `/user-handler/me` for the
//     given user, with the right shape.
//   • Pull-to-refresh path: a second GET reads the same values back.
//   • Sign-out path: `supabase.auth.signOut()` succeeds and the next /me
//     call rejects with 401 (proving the session is gone — what the mobile
//     RootNavigator relies on to bounce back to Login).
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestProfileScreen.mjs
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

async function getMe(token) {
  const resp = await fetch(`${FUNCTIONS_URL}/user-handler/me`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
    },
  });
  let json = null;
  try {
    json = await resp.json();
  } catch {
    /* non-JSON body */
  }
  return { status: resp.status, ok: resp.ok, json };
}

const REQUIRED_FIELDS = [
  // Field name → must be present (not undefined)
  { key: "name", optional: false },
  { key: "bio", optional: true }, // bio can be null on a fresh profile
  { key: "avatar_url", optional: true }, // null when no upload yet
  { key: "rating", optional: false }, // server returns 0 for new users, not null
  { key: "total_trips", optional: false },
  { key: "total_deliveries", optional: false },
  { key: "kyc_status", optional: false },
];

(async () => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    console.error("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required.");
    process.exit(2);
  }

  console.log(`Smoke testing ProfileScreen against ${SUPABASE_URL}\n`);

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

  // 2. First GET — what ProfileScreen does on mount
  const first = await getMe(token);
  if (!first.ok || !first.json?.success) {
    record("ProfileScreen mount: GET /me", false, `status ${first.status}`);
    process.exit(1);
  }
  const profile = first.json.data?.profile;
  record("ProfileScreen mount: GET /me", !!profile, profile ? "profile present" : "no profile");

  // 3. Field-level shape validation — every ProfileScreen field must be defined
  console.log("\n— Field-level validation (what the screen renders) —");
  let allFieldsOK = true;
  for (const { key, optional } of REQUIRED_FIELDS) {
    const value = profile?.[key];
    const ok = optional ? value !== undefined : value !== undefined && value !== null;
    if (!ok) allFieldsOK = false;
    const display = value === null ? "(null)" : value === undefined ? "(undefined)" : JSON.stringify(value);
    record(`field "${key}"`, ok, display);
  }

  // 4. Render preview — what the user will see on the screen
  if (allFieldsOK) {
    console.log("\n— Render preview —");
    const initials = profile.name
      ? profile.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
      : "??";
    console.log(`  Avatar:           ${profile.avatar_url ?? `[initials ${initials}]`}`);
    console.log(`  Name:             ${profile.name}`);
    console.log(`  Bio:              ${profile.bio ?? "(empty)"}`);
    console.log(`  Rating row:       ⭐ ${Number(profile.rating).toFixed(1)} • ${profile.total_trips} trips • ${profile.total_deliveries} deliveries`);
    console.log(`  KYC badge shown:  ${profile.kyc_status === "verified" ? "yes" : "no"} (status="${profile.kyc_status}")`);
  }

  // 5. Pull-to-refresh path
  const second = await getMe(token);
  record(
    "pull-to-refresh: second GET /me",
    second.ok && JSON.stringify(second.json?.data?.profile) === JSON.stringify(profile),
    "consistent with first read",
  );

  // 6. Sign-out path
  const { error: signOutErr } = await supabase.auth.signOut();
  if (signOutErr) {
    record("signOut", false, signOutErr.message);
  } else {
    record("signOut", true);
    // After signOut the token is invalidated server-side; a stale-token GET
    // should now 401 (which is what RootNavigator relies on).
    const after = await getMe(token);
    record(
      "after signOut: GET /me rejects",
      after.status === 401,
      `status ${after.status}`,
    );
  }

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
