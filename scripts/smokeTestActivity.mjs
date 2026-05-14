// AllActivityScreen smoke test.
//
// Proves end-to-end against the live Supabase project that:
//   1. The screen's mount path: GET /feed-handler/?page=1&per_page=12 returns
//      success with the expected meta shape ({page, per_page, total}).
//   2. The "load more" path: GET /feed-handler/?page=2&per_page=12 also
//      returns success and pagination is consistent (no 5xx, total stable).
//   3. Empty-state: when total=0, the response is well-formed (success:true,
//      data: [], meta.total: 0). Mahesh has 0 feed rows so this is the path
//      we'll hit; the screen renders "No recent activity" then.
//   4. Per-row field shape on the first row, when present, includes the
//      fields the screen renders: id, title, description (nullable),
//      created_at.
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestActivity.mjs
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

const PER_PAGE = 12;
const RENDERED_FIELDS = ["id", "title", "created_at"];

const results = [];
function record(name, ok, note = "") {
  results.push({ name, ok, note });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${note ? `  — ${note}` : ""}`);
}

async function call(method, path, { token, query } = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
  };
  let url = `${FUNCTIONS_URL}${path}`;
  if (query) {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ""),
      ),
    ).toString();
    if (qs) url += `?${qs}`;
  }
  const resp = await fetch(url, { method, headers });
  let json = null;
  try {
    json = await resp.json();
  } catch {}
  return { status: resp.status, ok: resp.ok, json };
}

(async () => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    console.error("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required.");
    process.exit(2);
  }

  console.log(`Smoke testing AllActivityScreen against ${SUPABASE_URL}\n`);

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

  // 2. Mount: GET /feed-handler/?page=1&per_page=12
  const page1 = await call("GET", "/feed-handler/", {
    token,
    query: { page: 1, per_page: PER_PAGE },
  });
  if (!page1.ok || !page1.json?.success) {
    record(
      "GET /feed-handler/?page=1",
      false,
      `status ${page1.status}: ${page1.json?.error?.message ?? "?"}`,
    );
    process.exit(1);
  }
  const items1 = page1.json.data ?? [];
  const total = page1.json.meta?.total ?? 0;
  record(
    "GET /feed-handler/?page=1",
    true,
    `${items1.length} item(s), meta.total=${total}`,
  );

  // 3. Meta shape — must match { page, per_page, total }
  const meta = page1.json.meta ?? {};
  record(
    "meta.page === 1",
    meta.page === 1,
    `meta.page=${meta.page}`,
  );
  record(
    `meta.per_page === ${PER_PAGE}`,
    meta.per_page === PER_PAGE,
    `meta.per_page=${meta.per_page}`,
  );
  record(
    "meta.total is a number ≥ 0",
    typeof meta.total === "number" && meta.total >= 0,
    `meta.total=${meta.total}`,
  );

  // 4. Field-shape on the first row (only when there's data)
  if (items1.length > 0) {
    console.log("\n— First activity field shape —");
    const first = items1[0];
    for (const key of RENDERED_FIELDS) {
      const v = first[key];
      const ok = v !== undefined && v !== null;
      record(`field "${key}"`, ok, ok ? JSON.stringify(v).slice(0, 80) : "(missing)");
    }
    // description is nullable in the model — assert key exists either way so
    // the screen's null-coalesce path is deterministic.
    record(
      'field "description" present (nullable)',
      Object.prototype.hasOwnProperty.call(first, "description"),
      first.description ? `len=${String(first.description).length}` : "(null/absent)",
    );

    // Render preview
    console.log("\n— Render preview (first 5) —");
    for (const item of items1.slice(0, 5)) {
      const date = new Date(item.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      console.log(
        `  · ${date.padEnd(14)} ${item.title}${item.description ? `  — ${item.description.slice(0, 60)}` : ""}`,
      );
    }

    // 5. Load more: GET /feed-handler/?page=2 (if there's a second page)
    if (total > PER_PAGE) {
      const page2 = await call("GET", "/feed-handler/", {
        token,
        query: { page: 2, per_page: PER_PAGE },
      });
      if (!page2.ok || !page2.json?.success) {
        record(
          "GET /feed-handler/?page=2 (load more)",
          false,
          `status ${page2.status}: ${page2.json?.error?.message ?? "?"}`,
        );
      } else {
        const items2 = page2.json.data ?? [];
        record(
          "GET /feed-handler/?page=2 (load more)",
          true,
          `${items2.length} item(s)`,
        );
        record(
          "page2 total matches page1 total (no race)",
          (page2.json.meta?.total ?? 0) === total,
          `page1.total=${total}, page2.total=${page2.json.meta?.total}`,
        );
        // Pages should not overlap (server uses range with offset)
        const page1Ids = new Set(items1.map((i) => i.id));
        const overlap = items2.filter((i) => page1Ids.has(i.id)).length;
        record(
          "page1 and page2 do not overlap by id",
          overlap === 0,
          `overlap=${overlap}`,
        );
      }
    } else {
      console.log(
        `\n(Single page suffices: total=${total} ≤ per_page=${PER_PAGE} — load-more button will not render.)`,
      );
    }
  } else {
    console.log(
      "\n(No activity rows for this account — screen will render the 'No recent activity' empty card. " +
        "Activity rows are written by edge functions when events occur — parcels listed, bookings accepted, etc.)",
    );
  }

  // 6. Anonymous request must NOT see this user's feed (auth required)
  const anon = await call("GET", "/feed-handler/", {
    query: { page: 1, per_page: 1 },
  });
  record(
    "feed-handler requires auth (anon → 401/403)",
    anon.status === 401 || anon.status === 403 || (anon.json?.success === false),
    `status ${anon.status}, success=${anon.json?.success}`,
  );

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
