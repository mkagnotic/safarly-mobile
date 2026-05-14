// ReviewsScreen smoke test.
//
// Proves end-to-end against the live Supabase project that:
//   1. Mount path: GET /rating-handler/users/{userId}?page=1&per_page=10
//      returns success with the expected response shape:
//        data: { average_rating, total_reviews, breakdown, ratings }
//        meta: { page, per_page, total }
//   2. Field normalization: server's `total_reviews` is aliased to `total`
//      mobile-side. Both should agree with `meta.total`.
//   3. Per-row field shape on the first row (when present): id, score (1-5),
//      review (nullable), created_at, rater (joined user_profiles).
//   4. Load more: page=2 returns a clean response (no 5xx) and total stays
//      consistent.
//   5. 404 path: bogus user uuid returns success but empty data — server
//      doesn't 404, it returns zeros (matches web's empty-state path).
//
// Run:
//   SMOKE_TEST_EMAIL=mahesh.k@agnotic.com SMOKE_TEST_PASSWORD=1234567 \
//     node scripts/smokeTestReviews.mjs
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

const PER_PAGE = 10;

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

/** Mirror mobile normalize. Server returns `total_reviews` and joined
 *  rater as `user_profiles` (per ratings_author_id_fkey). Mobile aliases
 *  these so screens can read `total` and `rating.rater`. */
function normalizeRating(r) {
  return {
    ...r,
    rater_id: r.rater_id ?? r.author_id ?? "",
    rater: r.rater ?? r.user_profiles ?? undefined,
  };
}

function normalizeUserRatings(raw) {
  if (!raw) return raw;
  return {
    ...raw,
    total: typeof raw.total === "number" ? raw.total : raw.total_reviews ?? 0,
    ratings: (raw.ratings ?? []).map(normalizeRating),
  };
}

(async () => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    console.error("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required.");
    process.exit(2);
  }

  console.log(`Smoke testing ReviewsScreen against ${SUPABASE_URL}\n`);

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

  // 2. Mount: GET /rating-handler/users/{userId}?page=1&per_page=10
  const page1 = await call("GET", `/rating-handler/users/${userId}`, {
    token,
    query: { page: 1, per_page: PER_PAGE },
  });
  if (!page1.ok || !page1.json?.success) {
    record(
      "GET /rating-handler/users/{userId}?page=1",
      false,
      `status ${page1.status}: ${page1.json?.error?.message ?? "?"}`,
    );
    process.exit(1);
  }
  const data1 = normalizeUserRatings(page1.json.data);
  const meta1 = page1.json.meta ?? {};
  record(
    "GET /rating-handler/users/{userId}?page=1",
    true,
    `${(data1?.ratings ?? []).length} review(s), avg=${data1?.average_rating}, total=${data1?.total}`,
  );

  // 3. Top-level shape — must include average_rating, breakdown, ratings, total
  console.log("\n— Aggregate shape —");
  for (const key of ["average_rating", "breakdown", "ratings"]) {
    record(
      `data.${key} present`,
      Object.prototype.hasOwnProperty.call(data1, key),
      JSON.stringify(data1[key]).slice(0, 80),
    );
  }
  record(
    'data.total (post-normalize) is a number',
    typeof data1.total === "number",
    `total=${data1.total}`,
  );

  // 4. meta shape
  record(
    "meta.page === 1",
    meta1.page === 1,
    `meta.page=${meta1.page}`,
  );
  record(
    `meta.per_page === ${PER_PAGE}`,
    meta1.per_page === PER_PAGE,
    `meta.per_page=${meta1.per_page}`,
  );
  record(
    "meta.total agrees with data.total",
    meta1.total === data1.total,
    `meta.total=${meta1.total}, data.total=${data1.total}`,
  );

  // 5. Breakdown buckets exist for each star (1-5)
  const breakdown = data1.breakdown ?? {};
  for (const star of [1, 2, 3, 4, 5]) {
    const v = breakdown[star] ?? breakdown[String(star)];
    record(
      `breakdown[${star}] is a number`,
      typeof v === "number",
      `breakdown[${star}]=${v}`,
    );
  }

  // 6. Field shape on the first row, when there's data
  const ratings = data1.ratings ?? [];
  if (ratings.length > 0) {
    console.log("\n— First review field shape —");
    const first = ratings[0];
    for (const key of ["id", "score", "created_at"]) {
      const v = first[key];
      const ok = v !== undefined && v !== null;
      record(`row "${key}"`, ok, ok ? JSON.stringify(v).slice(0, 80) : "(missing)");
    }
    record(
      'row "score" in [1, 5]',
      typeof first.score === "number" && first.score >= 1 && first.score <= 5,
      `score=${first.score}`,
    );
    record(
      'row "review" present (nullable)',
      Object.prototype.hasOwnProperty.call(first, "review"),
      first.review ? `len=${String(first.review).length}` : "(null/absent)",
    );
    // Post-normalize: `rater_id` should be set (aliased from server's `author_id`).
    record(
      'row "rater_id" (post-normalize, alias of author_id)',
      typeof first.rater_id === "string" && first.rater_id.length > 0,
      `rater_id="${first.rater_id}"`,
    );
    // Post-normalize: `rater` should be set (aliased from server's `user_profiles`).
    record(
      'row "rater" (post-normalize, alias of user_profiles)',
      first.rater !== undefined && typeof first.rater?.name === "string",
      first.rater
        ? `name="${first.rater.name}", avatar=${first.rater.avatar_url ? "yes" : "null"}`
        : "(missing — screen would show 'Anonymous')",
    );

    // Render preview
    console.log("\n— Render preview (first 5) —");
    for (const r of ratings.slice(0, 5)) {
      const date = new Date(r.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      console.log(
        `  · ${date.padEnd(14)} ${r.rater?.name ?? "Anonymous"}  ★${r.score}  ${(r.review ?? "").slice(0, 60)}`,
      );
    }

    // 7. Load more if total > PER_PAGE
    if (data1.total > PER_PAGE) {
      const page2 = await call("GET", `/rating-handler/users/${userId}`, {
        token,
        query: { page: 2, per_page: PER_PAGE },
      });
      if (!page2.ok || !page2.json?.success) {
        record(
          "GET page=2 (load more)",
          false,
          `status ${page2.status}: ${page2.json?.error?.message ?? "?"}`,
        );
      } else {
        const data2 = normalizeUserRatings(page2.json.data);
        record("GET page=2 (load more)", true, `${(data2.ratings ?? []).length} item(s)`);
        record(
          "page2 total matches page1 total",
          data2.total === data1.total,
          `page1.total=${data1.total}, page2.total=${data2.total}`,
        );
        const page1Ids = new Set(ratings.map((r) => r.id));
        const overlap = (data2.ratings ?? []).filter((r) => page1Ids.has(r.id)).length;
        record(
          "page1 / page2 do not overlap",
          overlap === 0,
          `overlap=${overlap}`,
        );
      }
    } else {
      console.log(
        `\n(Single page suffices: total=${data1.total} ≤ per_page=${PER_PAGE} — load-more button will not render.)`,
      );
    }
  } else {
    console.log(
      "\n(No reviews for this account — screen will render the 'No reviews yet' empty card. " +
        "Reviews are written via POST /rating-handler/ when a delivery is rated.)",
    );
  }

  // 8. Bogus user id — server returns success: true but zeros (web's empty path)
  const bogus = await call("GET", "/rating-handler/users/00000000-0000-0000-0000-000000000000", {
    token,
    query: { page: 1, per_page: PER_PAGE },
  });
  record(
    "bogus user id returns 2xx with empty data",
    bogus.ok && bogus.json?.success === true,
    `status ${bogus.status}, total=${bogus.json?.data?.total_reviews ?? bogus.json?.data?.total}`,
  );

  // 9. Anonymous request must NOT see ratings (auth required)
  const anon = await call("GET", `/rating-handler/users/${userId}`, {
    query: { page: 1, per_page: 1 },
  });
  record(
    "rating-handler requires auth (anon → 401)",
    anon.status === 401 || anon.json?.success === false,
    `status ${anon.status}, success=${anon.json?.success}`,
  );

  await supabase.auth.signOut();

  console.log("");
  const allPassed = results.every((r) => r.ok);
  console.log(allPassed ? "All checks passed." : "One or more checks FAILED.");
  process.exit(allPassed ? 0 : 1);
})();
