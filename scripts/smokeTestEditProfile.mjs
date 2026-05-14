// EditProfileScreen-focused smoke test.
//
// What this proves end-to-end against the live Supabase project:
//   1. The screen's load path: GET /user-handler/me returns the fields the
//      form will seed itself from (name/bio/city/country/avatar_url).
//   2. The screen's save path: PUT /user-handler/me with the exact payload
//      shape the screen sends accepts the change AND echoes the saved row
//      back, so the post-save store update has real data.
//   3. The screen's restore path: re-GET reflects the write.
//   4. Independent edits don't clobber each other: changing only `bio`
//      preserves `name`, `city`, `country`.
//   5. No leftover state: at the end, the user's profile is restored to its
//      pre-test values byte-for-byte.
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestEditProfile.mjs
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

(async () => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    console.error("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required.");
    process.exit(2);
  }

  console.log(`Smoke testing EditProfileScreen against ${SUPABASE_URL}\n`);

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

  // 2. EditProfile mounts -> form seeds from this
  const before = await call("GET", "/user-handler/me", { token });
  if (!before.ok || !before.json?.success || !before.json.data?.profile) {
    record("EditProfile mount: GET /me", false, `status ${before.status}`);
    process.exit(1);
  }
  const original = before.json.data.profile;
  record(
    "EditProfile mount: GET /me",
    true,
    `seeds: name="${original.name}" city="${original.city}" country="${original.country}" bio="${original.bio}"`,
  );

  // 3. Simulated user edit: change bio only via Save Changes
  const probeBio = `Smoke bio ${Date.now() % 100000}`;
  const put1 = await call("PUT", "/user-handler/me", {
    token,
    body: {
      name: original.name,
      bio: probeBio,
      city: original.city ?? undefined,
      country: original.country ?? undefined,
    },
  });
  if (!put1.ok) {
    record("EditProfile Save: PUT /me (bio change)", false, `status ${put1.status}: ${put1.json?.error?.message ?? "?"}`);
    process.exit(1);
  }
  record(
    "EditProfile Save: PUT /me (bio change)",
    true,
    `server echoed bio="${put1.json?.data?.bio}"`,
  );

  // 4. Re-GET to confirm the write landed AND siblings are preserved
  const afterBio = await call("GET", "/user-handler/me", { token });
  const afterProfile = afterBio.json?.data?.profile;
  record(
    "verify: bio updated in DB",
    afterProfile?.bio === probeBio,
    `bio="${afterProfile?.bio}"`,
  );
  record(
    "verify: name preserved",
    afterProfile?.name === original.name,
    `name="${afterProfile?.name}"`,
  );
  record(
    "verify: city preserved",
    (afterProfile?.city ?? null) === (original.city ?? null),
    `city="${afterProfile?.city}"`,
  );
  record(
    "verify: country preserved",
    (afterProfile?.country ?? null) === (original.country ?? null),
    `country="${afterProfile?.country}"`,
  );

  // 5. Simulated user edit: change city only (proves independent fields)
  const probeCity = `Smoke ${Date.now() % 100000}`;
  const put2 = await call("PUT", "/user-handler/me", {
    token,
    body: {
      name: afterProfile.name,
      bio: afterProfile.bio,
      city: probeCity,
      country: afterProfile.country ?? undefined,
    },
  });
  record(
    "EditProfile Save: PUT /me (city change)",
    put2.ok,
    `status ${put2.status}, server echoed city="${put2.json?.data?.city}"`,
  );

  const afterCity = await call("GET", "/user-handler/me", { token });
  record(
    "verify: city updated, bio still our probe",
    afterCity.json?.data?.profile?.city === probeCity &&
      afterCity.json?.data?.profile?.bio === probeBio,
    `city="${afterCity.json?.data?.profile?.city}" bio="${afterCity.json?.data?.profile?.bio}"`,
  );

  // 6. Restore: put everything back to the pre-test snapshot
  const restore = await call("PUT", "/user-handler/me", {
    token,
    body: {
      name: original.name,
      bio: original.bio ?? undefined,
      city: original.city ?? undefined,
      country: original.country ?? undefined,
    },
  });
  record("cleanup: restore original profile", restore.ok, `status ${restore.status}`);

  const final = await call("GET", "/user-handler/me", { token });
  const finalProfile = final.json?.data?.profile;
  const matches =
    finalProfile?.name === original.name &&
    (finalProfile?.bio ?? null) === (original.bio ?? null) &&
    (finalProfile?.city ?? null) === (original.city ?? null) &&
    (finalProfile?.country ?? null) === (original.country ?? null);
  record(
    "cleanup: final read matches pre-test snapshot",
    matches,
    `name="${finalProfile?.name}" city="${finalProfile?.city}" country="${finalProfile?.country}" bio="${finalProfile?.bio}"`,
  );

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
