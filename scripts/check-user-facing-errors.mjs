#!/usr/bin/env node
/**
 * Guard: technical text must never reach a user.
 *
 * Three client-reported incidents, one bug class - an internal string rendered
 * verbatim in a toast:
 *
 *   1. `column reference "booking_id" is ambiguous` on a mid-trip cancellation. The
 *      backend scrubber had `column "` in its denylist; Postgres actually says
 *      `column reference "`, so it slipped past.
 *   2. `Unable to exchange external code: 4/0A` on Google sign-in. `mapOAuthError`
 *      ended with `return raw`, so anything unrecognised was shown as-is.
 *   3. The gap the first two shared: the edge functions scrub their own output, but
 *      both apps also call Supabase auth and storage DIRECTLY. Those errors never
 *      touch an edge function - they went to `getErrorMessage`, which returned
 *      `error.message` unchanged.
 *
 * This checks every gate that text passes through on its way to a person:
 *
 *   1. src/lib/userFacingError.js - the client sanitiser. Imported and RUN here
 *      against real raw samples, so the guard tests the shipping code rather than a
 *      copy of its rules that could drift.
 *   2. `getErrorMessage` routes through it.
 *   3. `mapOAuthError` never falls through to the raw provider text.
 *   4. No toast renders a raw `.message`, going around gate 1.
 *   5. `_shared/errors.ts` catches raw database output server-side (web repo only).
 *   6. When both repos are checked out side by side, their sanitisers have the same
 *      CONTENT, so proving one proves the other. Line endings are ignored: the repos
 *      are cloned independently, so on Windows one copy can be CRLF and the other LF
 *      while both are the same file in Git.
 *
 * This file is kept identical in the web and mobile repos and works from either. In
 * CI only one repo is checked out, so the cross-repo gate reports itself as skipped
 * instead of failing; each repo's own CI covers its own side.
 *
 * Run: `npm run check:errors`
 */

import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const HERE = process.cwd();

// The web repo is the one carrying the edge functions. Everything else is mobile.
const IS_WEB = existsSync(join(HERE, "supabase", "functions", "_shared", "errors.ts"));
const SELF = IS_WEB ? "web" : "mobile";
const SIBLING_ROOT = IS_WEB
  ? join(HERE, "..", "..", "mobile app", "safarly-mobile")
  : join(HERE, "..", "..", "web app", "safarly_web");
const SIBLING = IS_WEB ? "mobile" : "web";

const failures = [];
const skipped = [];
const note = (m) => failures.push(m);

const sanitiserPath = (root) => join(root, "src", "lib", "userFacingError.js");
const fallbackPath = (root) => join(root, "src", "lib", "errorFallback.js");

/** True when the two files DIFFER in content, ignoring line endings / trailing newline. */
const contentDiffers = (a, b) =>
  a.replace(/\r\n/g, "\n").trimEnd() !== b.replace(/\r\n/g, "\n").trimEnd();

/** Real machine output. None of these may ever be shown unchanged. */
const MUST_SCRUB = [
  // --- the reported incidents ---
  'column reference "booking_id" is ambiguous',
  "Unable to exchange external code: 4/0A",
  // The API client's placeholder when an error body carries no message. Found on
  // screen during acceptance testing as "Request failed with status 403".
  "Request failed with status 403",
  "Request failed with status 500",
  // --- Postgres / PostgREST ---
  'duplicate key value violates unique constraint "bookings_pkey"',
  'null value in column "sender_id" violates not-null constraint',
  'invalid input syntax for type uuid: "not-a-uuid"',
  'relation "public.bookings" does not exist',
  "permission denied for table bookings",
  "PGRST200: Could not find a relationship between 'a' and 'b'",
  '42702: column reference "x" is ambiguous',
  "canceling statement due to statement timeout",
  "deadlock detected",
  "PL/pgSQL function fn_cancel_post_possession(uuid) line 4 at SQL statement",
  "DETAIL:  It could refer to either a PL/pgSQL variable or a table column.",
  'syntax error at or near "SELCT"',
  'new row violates row-level security policy for table "objects"',
  // --- Supabase JS SDK, which never passes through an edge function ---
  "AuthApiError: Invalid Refresh Token: Refresh Token Not Found",
  "AuthRetryableFetchError: Failed to fetch",
  "StorageApiError: Bucket not found",
  "FunctionsHttpError: Edge Function returned a non-2xx status code",
  "JWT expired",
  // --- the JavaScript runtime ---
  "Cannot read properties of undefined (reading 'id')",
  "undefined is not an object (evaluating 'x.y')",
  "toUserMessage is not a function",
  "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON",
  "TypeError: Load failed",
  "Converting circular structure to JSON",
  "at handleSubmit (bundle.js:1442:19)",
  // --- transport / infrastructure leaking a URL or host ---
  "request to https://rbtdkdbmtecungdthujf.supabase.co/rest/v1/bookings failed",
  "connect ECONNREFUSED 127.0.0.1:54321",
  // --- body-less gateway failures: supabase-js stringifies the empty body ---
  "{}",
  "[object Object]",
  '{"code":"PGRST116","details":null}',
];

/**
 * Gateway-class failures. The body is EMPTY, so supabase-js falls back to
 * `JSON.stringify(body)` and `error.message` arrives as the literal string "{}".
 * Only the status says what actually happened. On 2026-08-29 a 504 during sign-in
 * put a toast reading "{}" in front of a user on production; pinned so that the
 * status is always consulted and that string can never surface again.
 */
const STATUS_CASES = [
  { error: { message: "{}", status: 504 }, want: "busy" },
  { error: { message: "{}", status: 502 }, want: "busy" },
  { error: { message: "", status: 503 }, want: "busy" },
  { error: { message: "", statusCode: "504" }, want: "busy" },
  // A status that DOES come with real copy must not be overridden by it.
  { error: { message: "Invalid login credentials", status: 400 }, want: "keep" },
];

/** Copy we deliberately show. None of these may be altered. */
const MUST_KEEP = [
  "Could not secure this parcel. Please try again.",
  "Payments are not configured",
  "Payouts are not configured",
  "Failed to store parcel photos",
  "Failed to store document",
  "User email not found",
  "An unexpected error occurred",
  "Email service is not configured",
  "Timeout sweep failed",
  "Failed to update password",
  "This email is registered with a password. Please sign in with email and password.",
  "That sign-in link had already been used or expired. Please try signing in again.",
  "Parcel is ready to be delivered",
  "You cannot book your own parcel.",
  "This trip no longer has room for that parcel.",
  "Enter the 6-digit code from your receiver.",
  "Please accept the terms to continue.",
];

// ---------------------------------------------------------------------------
// 1. The client sanitiser, executed for real
// ---------------------------------------------------------------------------
const selfSanitiser = sanitiserPath(HERE);
let tempDir = null;

if (!existsSync(selfSanitiser)) {
  note(`${SELF}: src/lib/userFacingError.js is missing - the client sanitiser is gone.`);
} else {
  // The mobile repo is a CommonJS package, so Node would refuse to `import()` a `.js`
  // file containing ESM syntax. Copying the source to a temporary `.mjs` makes the
  // guard work identically in both repos, whatever their package type says.
  tempDir = mkdtempSync(join(tmpdir(), "safarly-guard-"));
  const tempModule = join(tempDir, "userFacingError.mjs");
  writeFileSync(tempModule, readFileSync(selfSanitiser, "utf8"), "utf8");

  const { toUserMessage, SERVER_BUSY_MESSAGE } = await import(
    pathToFileURL(tempModule).href,
  );

  // The sanitiser logs withheld text; keep the guard's own output readable.
  const realWarn = console.warn;
  console.warn = () => {};
  try {
    for (const sample of MUST_SCRUB) {
      if (toUserMessage(sample) === sample) {
        note(`userFacingError: technical text would be shown verbatim -> ${sample}`);
      }
    }
    for (const sample of MUST_KEEP) {
      const shown = toUserMessage(sample);
      if (shown !== sample) {
        note(`userFacingError: real copy was altered -> ${sample}\n      became -> ${shown}`);
      }
    }
    for (const { error, want } of STATUS_CASES) {
      const shown = toUserMessage(error);
      const expected = want === "busy" ? SERVER_BUSY_MESSAGE : error.message;
      if (shown !== expected) {
        note(
          `userFacingError: status ${error.status ?? error.statusCode} with message ` +
            `${JSON.stringify(error.message)} was shown as ${JSON.stringify(shown)}, ` +
            `expected ${JSON.stringify(expected)}.`,
        );
      }
    }
    // Non-strings must not crash it or produce "undefined" / "[object Object]".
    for (const odd of [null, undefined, 0, {}, [], new Error(""), { message: 42 }]) {
      const shown = toUserMessage(odd);
      if (typeof shown !== "string" || !shown || /undefined|\[object/i.test(shown)) {
        note(`userFacingError: bad output for ${JSON.stringify(odd)} -> ${shown}`);
      }
    }
  } finally {
    console.warn = realWarn;
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 1b. The fallback classifier, executed for real
//
// Every list screen used to say "We couldn't load this content. Please try again."
// for a dead radio, a deleted record and a missing permission alike. These cases
// pin the six kinds apart, so a regression in the regexes shows up as a failing
// build rather than as three different problems wearing one message.
// ---------------------------------------------------------------------------
const selfFallback = fallbackPath(HERE);

/** message | {message,status} -> the kind a person is actually in. */
const KIND_CASES = [
  ["Failed to fetch", "offline"],
  ["Network request failed", "offline"],
  ["net::ERR_INTERNET_DISCONNECTED", "offline"],
  [{ message: "nope", status: 401 }, "permission"],
  [{ message: "nope", status: 403 }, "permission"],
  ["new row violates row-level security policy", "permission"],
  ["Your session has expired. Please sign in again.", "permission"],
  [{ message: "gone", status: 404 }, "notFound"],
  [{ message: "gone", status: 410 }, "notFound"],
  ["This trip is no longer available.", "notFound"],
  [{ message: "boom", status: 500 }, "server"],
  [{ message: "boom", status: 503 }, "server"],
  [{ message: "boom", status: 429 }, "server"],
  ["Our servers are busy right now. Please try again in a moment.", "server"],
  [{ message: "Weight is required.", status: 400 }, "validation"],
  ["That email is already taken.", "validation"],
];

if (!existsSync(selfFallback)) {
  note(`${SELF}: src/lib/errorFallback.js is missing - the shared fallback is gone.`);
} else {
  const dir = mkdtempSync(join(tmpdir(), "safarly-guard-fb-"));
  try {
    // It imports the sanitiser by relative path, so both files travel together.
    writeFileSync(join(dir, "userFacingError.js"), readFileSync(selfSanitiser, "utf8"), "utf8");
    const mod = join(dir, "errorFallback.mjs");
    writeFileSync(mod, readFileSync(selfFallback, "utf8"), "utf8");
    const { classifyError, fallbackFor } = await import(pathToFileURL(mod).href);

    const realWarn = console.warn;
    console.warn = () => {};
    try {
      for (const [input, want] of KIND_CASES) {
        const got = classifyError(typeof input === "string" ? new Error(input) : input);
        if (got !== want) {
          note(
            `errorFallback: ${JSON.stringify(input)} was classified as ${got}, expected ${want}. ` +
              `The user would be told the wrong thing to do about it.`,
          );
        }
      }
      // An expired session must send the user to sign in, not tell them they
      // lack a permission they have always had. Found on screen during
      // acceptance testing as "It belongs to someone else".
      for (const m of ["JWT expired", "invalid refresh token", "Your session has expired. Please sign in again."]) {
        const f = fallbackFor({ message: m, status: 401 });
        if (!/sign in again/i.test(f.body) || /belongs to someone else/i.test(f.body)) {
          note(`errorFallback: an expired session was explained as ${JSON.stringify(f.title + " / " + f.body)}`);
        }
      }
      // Whatever it is handed, it must produce something a person can read.
      for (const odd of [null, undefined, 0, "", {}, [], new Error("")]) {
        const f = fallbackFor(odd);
        if (!f || typeof f.title !== "string" || typeof f.body !== "string" || f.body.length < 10) {
          note(`errorFallback: unusable fallback for ${JSON.stringify(odd)} -> ${JSON.stringify(f)}`);
        }
      }
      // And it must never become a new way for machine output to reach a user.
      for (const sample of MUST_SCRUB) {
        const f = fallbackFor({ message: sample, status: 500 });
        if (f.body.includes(sample)) {
          note(`errorFallback: technical text reached the body -> ${sample}`);
        }
      }
    } finally {
      console.warn = realWarn;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 2. getErrorMessage routes through the sanitiser
// ---------------------------------------------------------------------------
const clientPath = join(HERE, "src", "services", "api", "client.ts");
if (!existsSync(clientPath)) {
  note(`${SELF}: src/services/api/client.ts not found.`);
} else {
  const src = readFileSync(clientPath, "utf8");
  const fn = /export function getErrorMessage[\s\S]*?\n}/.exec(src);
  if (!fn) {
    note(`${SELF}: getErrorMessage not found - has the client error funnel moved?`);
  } else {
    if (!/toUserMessage\(/.test(fn[0])) {
      note(
        `${SELF}: getErrorMessage does not call toUserMessage. It is the funnel every ` +
          "toast uses; returning error.message unchanged is how raw Supabase and " +
          "JavaScript errors reached users.",
      );
    }
    if (/return\s+error\.message\s*;/.test(fn[0])) {
      note(`${SELF}: getErrorMessage still returns error.message unchanged.`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The OAuth mapper
// ---------------------------------------------------------------------------
const oauthPath = join(HERE, "src", "services", "auth", "oauthErrors.ts");
if (!existsSync(oauthPath)) {
  note(`${SELF}: src/services/auth/oauthErrors.ts not found.`);
} else {
  const oauth = readFileSync(oauthPath, "utf8");
  if (/\breturn\s+raw\s*;/.test(oauth)) {
    note(
      `${SELF}: mapOAuthError falls through to \`return raw\` - that is how ` +
        '"Unable to exchange external code: 4/0A" reached a user. Map it, or return ' +
        "the generic message.",
    );
  }
  if (!/unable to exchange external code/i.test(oauth)) {
    note(`${SELF}: mapOAuthError no longer handles the code-exchange failure.`);
  }
}

// ---------------------------------------------------------------------------
// 4. Nothing renders a raw .message, going around the sanitiser
// ---------------------------------------------------------------------------
// Rendering a raw `.message` is the bug. COMPARING one is fine and common
// (`error.message === "Invalid login credentials"`), so a comparison does not count.
//
// Deliberately matches ANY `.message`, not just `err.message`: a cast such as
// `(err as Error).message` or a rename such as `caught.message` is the same leak, and
// an earlier version of this pattern let `(err as Error)?.message` straight through.
// `showToast` is mobile's toast API and `toast.*` is web's; both repos run this file,
// so both spellings have to be here.
const BYPASS =
  /(?:toast\.(?:error|warning|info|success)|showToast|Alert\.alert|setError|setErrorMessage)\s*\([^;]{0,200}?\.\s*message\b(?!\s*(?:[!=]=|\?\.\s*(?:includes|startsWith|match)))/;

/**
 * The same leak, in the two shapes the call-expression scan above cannot see.
 *
 * Found in production code by a failure-mode test, not by this guard: BookingsScreen
 * rendered `{error instanceof Error ? error.message : "Unknown error"}` straight into
 * JSX, so a failing backend printed `column reference "booking_id" is ambiguous ...
 * SQLSTATE 42702` on screen. AvatarUpload piped a raw Supabase Storage error into a
 * status banner the same way.
 *
 * A line may opt out with `user-facing-ok` when the value is a CURATED backend
 * message (a known ApiClientError code) rather than raw driver output.
 */
const RENDER_BYPASS = [
  // {...err.message...} rendered in JSX
  /\{[^{}]{0,160}\b\w*[Ee]rr(?:or)?\w*\s*\??\.\s*message\b[^{}]{0,160}\}/,
  // message: err.message  — banner / status / alert payloads
  /\bmessage:\s*\w*[Ee]rr(?:or)?\w*\s*\??\.\s*message\b/,
];

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
};

let scanned = 0;
const srcDir = join(HERE, "src");
if (existsSync(srcDir)) {
  for (const file of walk(srcDir)) {
    scanned++;
    // The sanitiser and the OAuth mapper legitimately handle raw text.
    if (/userFacingError|oauthErrors/.test(file)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      // Wide enough to span a multi-line toast call and see its getErrorMessage.
      const window = lines.slice(i, i + 8).join(" ");
      const wrapped = /getErrorMessage|toUserMessage|mapOAuthError|user-facing-ok/.test(window);
      if (BYPASS.test(window) && !wrapped) {
        note(
          `${SELF}: ${relative(HERE, file)}:${i + 1} shows a raw .message, going around ` +
            "getErrorMessage. Wrap it: getErrorMessage(err).",
        );
        break;
      }
      // JSX / banner payloads are checked on the LINE, not an 8-line window: a wide
      // window straddles neighbouring branches and one wrapped call would mask an
      // unwrapped sibling three lines away — which is how the BookingsScreen leak sat
      // undetected next to a correct getErrorMessage call.
      const line = lines[i];
      // `errors.message` (PLURAL) is form-validation state for a field named "message"
      // — react-hook-form / formik convention — not an Error object. ContactUs has a
      // literal message field, so this would flag on every form in the app.
      const formState = /\berrors\s*\??\.\s*message\b/.test(line);
      // The opt-out marker is honoured on the line itself OR in the six lines above:
      // the natural place to justify it is a comment over the code, and a real
      // justification runs to several lines.
      const optOutScope = lines.slice(Math.max(0, i - 6), i + 1).join(" ");
      const lineWrapped =
        formState ||
        /getErrorMessage|toUserMessage|mapOAuthError/.test(line) ||
        /user-facing-ok/.test(optOutScope);
      if (!lineWrapped && RENDER_BYPASS.some((re) => re.test(line))) {
        note(
          `${SELF}: ${relative(HERE, file)}:${i + 1} renders a raw .message.\n` +
            `      ${line.trim().slice(0, 110)}\n` +
            "      Wrap it: getErrorMessage(err) — or mark the line `user-facing-ok` if it " +
            "is a curated backend message, not raw driver output.",
        );
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. The server-side scrubber (web repo only - it owns the edge functions)
// ---------------------------------------------------------------------------
if (!IS_WEB) {
  skipped.push("server scrubber (edge functions live in the web repo)");
} else {
  const src = readFileSync(join(HERE, "supabase", "functions", "_shared", "errors.ts"), "utf8");

  /** Pull an array literal out of the TS source and evaluate it as JS. */
  const extractArray = (name) => {
    const i = src.indexOf(`const ${name}`);
    if (i === -1) return null;
    // Start at the `=`, so a type annotation like `: RegExp[]` is not mistaken for
    // the start of the array literal.
    const eq = src.indexOf("=", i);
    const open = src.indexOf("[", eq);
    const close = src.indexOf("];", open);
    if (eq === -1 || open === -1 || close === -1) return null;
    const body = src.slice(open, close + 1).replace(/^\s*\/\/.*$/gm, "");
    return new Function(`return ${body};`)();
  };

  const signatures = extractArray("RAW_DB_SIGNATURES");
  const shapes = extractArray("RAW_DB_SHAPES") ?? [];
  if (!signatures) {
    note("errors.ts: RAW_DB_SIGNATURES not found - has the scrubber been removed?");
  } else {
    const caught = (m) =>
      signatures.some((s) => m.toLowerCase().includes(String(s).toLowerCase())) ||
      shapes.some((re) => re.test(m));

    // Only the database-shaped samples reach the server-side scrubber.
    const DB_SHAPED =
      /column|constraint|relation|permission|PGRST|syntax|deadlock|statement|PL\/pgSQL|DETAIL|row-level|input syntax/i;
    for (const m of MUST_SCRUB.filter((s) => DB_SHAPED.test(s))) {
      if (!caught(m)) note(`errors.ts: raw DB output would reach the user -> ${m}`);
    }
    for (const m of MUST_KEEP) {
      if (caught(m)) note(`errors.ts: a real user message would be scrubbed -> ${m}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Cross-repo parity, when both are checked out
// ---------------------------------------------------------------------------
const siblingSanitiser = sanitiserPath(SIBLING_ROOT);
if (!existsSync(siblingSanitiser)) {
  // Normal in CI, where only one repo is cloned. The other repo's CI runs this same
  // file against its own tree, so nothing goes unchecked.
  skipped.push(`${SIBLING} parity (that repo is not checked out here)`);
} else if (
  existsSync(selfSanitiser) &&
  // Compare CONTENT, not raw bytes. The two repos are checked out independently, so
  // on Windows (`core.autocrlf=true`) one working copy can be CRLF and the other LF
  // while both are the same file in Git. A byte comparison failed on exactly that and
  // would have been an unreproducible red build. Line endings are not drift.
  contentDiffers(readFileSync(selfSanitiser, "utf8"), readFileSync(siblingSanitiser, "utf8"))
) {
  note(
    `web and mobile copies of userFacingError.js differ in CONTENT (line endings are ` +
      `ignored). They must stay identical so that proving one proves the other. ` +
      `Copy one over the other:\n` +
      `      ${selfSanitiser}\n      ${siblingSanitiser}`,
  );
}

const siblingFallback = fallbackPath(SIBLING_ROOT);
if (
  existsSync(siblingFallback) &&
  existsSync(selfFallback) &&
  contentDiffers(readFileSync(selfFallback, "utf8"), readFileSync(siblingFallback, "utf8"))
) {
  note(
    `web and mobile copies of errorFallback.js differ in CONTENT (line endings are ` +
      `ignored). Both apps must classify a failure the same way, or the two platforms ` +
      `tell the same user two different things. Copy one over the other:
` +
      `      ${selfFallback}
      ${siblingFallback}`,
  );
}

console.log(
  `check:errors [${SELF}] - ${MUST_SCRUB.length} raw samples, ${STATUS_CASES.length} ` +
    `gateway cases, ${MUST_KEEP.length} real ` +
    `messages, ${KIND_CASES.length} failure kinds, ` +
    `${scanned} source files scanned`,
);
for (const s of skipped) console.log(`check:errors [${SELF}] - skipped: ${s}`);

if (failures.length > 0) {
  console.error("\nTechnical text could reach a user:\n");
  for (const f of failures) console.error(`  - ${f}`);
  console.error("");
  process.exit(1);
}

console.log(`check:errors [${SELF}] - every path to a user is gated. OK`);
