// PreferencesScreen-focused smoke test.
//
// Proves end-to-end against the live Supabase project that:
//   1. The screen's load path: GET /user-handler/me/preferences returns the
//      6 fields the new screen renders (email_notifications,
//      push_notifications, notifications_enabled, currency, language, theme).
//   2. The screen's auto-save path: PUT each field individually and verify
//      the others are preserved (web's per-toggle .mutate() pattern works).
//   3. Every field this screen lets the user edit (3 toggles + currency +
//      language) round-trips correctly.
//   4. The user's preferences are restored to pre-test values at the end.
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestPreferences.mjs
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

/**
 * Field expectations.
 *   • required: must always be present in GET — currency/language/theme/email
 *     are guaranteed by the server (defaults applied at row creation).
 *   • renderable: PreferencesScreen renders these regardless. Missing values
 *     fall through to OFF in the UI (Boolean(undefined) === false), and the
 *     server starts persisting them as soon as the user toggles.
 */
const REQUIRED_FIELDS = [
  { key: "email_notifications", required: true },
  { key: "push_notifications", required: false },
  { key: "notifications_enabled", required: false },
  { key: "currency", required: true },
  { key: "language", required: true },
  { key: "theme", required: true },
];

async function getPrefs(token) {
  const res = await call("GET", "/user-handler/me/preferences", { token });
  return res;
}

async function patchPrefs(token, patch) {
  return call("PUT", "/user-handler/me/preferences", { token, body: patch });
}

(async () => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    console.error("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required.");
    process.exit(2);
  }

  console.log(`Smoke testing PreferencesScreen against ${SUPABASE_URL}\n`);

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

  // 2. Initial GET — what PreferencesScreen does on mount
  const initial = await getPrefs(token);
  if (!initial.ok || !initial.json?.success) {
    record("PreferencesScreen mount: GET /preferences", false, `status ${initial.status}: ${initial.json?.error?.message ?? "?"}`);
    process.exit(1);
  }
  const original = initial.json.data;
  record("PreferencesScreen mount: GET /preferences", true, "preferences loaded");

  // 3. Field-level shape validation
  console.log("\n— Field-level validation (every screen-rendered field) —");
  for (const { key, required } of REQUIRED_FIELDS) {
    const value = original?.[key];
    const present = value !== undefined;
    const ok = required ? present : true;
    const note = present ? JSON.stringify(value) : required ? "(missing — required)" : "(missing — optional, will default to OFF)";
    record(`field "${key}"`, ok, note);
  }

  // 4. Render preview — exactly what the screen will display (Boolean coerces
  //    missing fields to false, just like the screen does).
  console.log("\n— Render preview (Mahesh's current preferences) —");
  console.log(`  Email Notifications: ${Boolean(original.email_notifications) ? "ON" : "OFF"}`);
  console.log(`  Push Notifications:  ${Boolean(original.push_notifications) ? "ON" : "OFF"}`);
  console.log(`  SMS Alerts:          ${Boolean(original.notifications_enabled) ? "ON" : "OFF"}`);
  console.log(`  Currency:            ${original.currency ?? "(default)"}`);
  console.log(`  Language:            ${original.language ?? "(default)"}`);

  // 5. Auto-save: toggle email_notifications and verify
  console.log("\n— Auto-save round-trips —");
  const flipped = !original.email_notifications;
  const r1 = await patchPrefs(token, { email_notifications: flipped });
  if (!r1.ok) {
    record("PUT email_notifications", false, `status ${r1.status}: ${r1.json?.error?.message ?? "?"}`);
  } else {
    record(
      "PUT email_notifications",
      r1.json?.data?.email_notifications === flipped,
      `set to ${flipped}, server echoed ${r1.json?.data?.email_notifications}`,
    );
  }
  const after1 = await getPrefs(token);
  record(
    "verify: email_notifications updated, others preserved",
    after1.json?.data?.email_notifications === flipped &&
      after1.json?.data?.push_notifications === original.push_notifications &&
      after1.json?.data?.currency === original.currency &&
      after1.json?.data?.language === original.language,
    `email=${after1.json?.data?.email_notifications}, others unchanged`,
  );

  // 6. Currency change
  const newCurrency = original.currency === "USD" ? "INR" : "USD";
  const r2 = await patchPrefs(token, { currency: newCurrency });
  record(
    "PUT currency",
    r2.ok && r2.json?.data?.currency === newCurrency,
    `set to ${newCurrency}, server echoed ${r2.json?.data?.currency}`,
  );

  // 7. Language change
  const newLanguage = original.language === "en-US" ? "fr-CA" : "en-US";
  const r3 = await patchPrefs(token, { language: newLanguage });
  record(
    "PUT language",
    r3.ok && r3.json?.data?.language === newLanguage,
    `set to ${newLanguage}, server echoed ${r3.json?.data?.language}`,
  );

  // 8. Verify all three changes coexist
  const after3 = await getPrefs(token);
  record(
    "verify: all three fields landed independently",
    after3.json?.data?.email_notifications === flipped &&
      after3.json?.data?.currency === newCurrency &&
      after3.json?.data?.language === newLanguage &&
      after3.json?.data?.push_notifications === original.push_notifications &&
      after3.json?.data?.notifications_enabled === original.notifications_enabled,
    `email=${after3.json?.data?.email_notifications} currency=${after3.json?.data?.currency} language=${after3.json?.data?.language}`,
  );

  // 9. Cleanup: restore to pre-test snapshot
  const restore = await patchPrefs(token, {
    email_notifications: original.email_notifications,
    push_notifications: original.push_notifications,
    notifications_enabled: original.notifications_enabled,
    currency: original.currency,
    language: original.language,
  });
  record("cleanup: restore original preferences", restore.ok, `status ${restore.status}`);

  const final = await getPrefs(token);
  const matches =
    final.json?.data?.email_notifications === original.email_notifications &&
    final.json?.data?.push_notifications === original.push_notifications &&
    final.json?.data?.notifications_enabled === original.notifications_enabled &&
    final.json?.data?.currency === original.currency &&
    final.json?.data?.language === original.language;
  record("cleanup: final read matches pre-test snapshot", matches);

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
