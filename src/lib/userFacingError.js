/**
 * The last gate before an error string is shown to a person.
 *
 * Why this exists. Two client-reported incidents were the same bug wearing
 * different clothes: an internal string was rendered verbatim in a toast.
 *
 *   1. `column reference "booking_id" is ambiguous` - a Postgres error, shown to a
 *      carrier confirming a mid-trip cancellation.
 *   2. `Unable to exchange external code: 4/0A` - GoTrue quoting Google's OAuth
 *      authorization code back at the user.
 *
 * Each was fixed where it happened. That is not enough: the edge functions scrub
 * their own output, but the apps also call Supabase auth and storage DIRECTLY, and
 * those errors never touch an edge function. They land in `getErrorMessage`, which
 * returned `error.message` unchanged. Any future GoTrue, PostgREST, storage or plain
 * JavaScript runtime error had a clear path to a toast.
 *
 * So this module is the choke point on the client side, matching the scrubber in
 * `supabase/functions/_shared/errors.ts` on the server side. Two rules:
 *
 *   - Recognised failures get copy that says what to DO (mappings below).
 *   - Anything that merely LOOKS technical is replaced with a generic message and
 *     the original is written to the console for diagnosis.
 *
 * Everything else passes through untouched, because the curated messages the edge
 * functions return really are meant for the user.
 *
 * This file is deliberately plain JavaScript, not TypeScript, and is byte-identical
 * in the web and mobile repos. That lets `scripts/check-user-facing-errors.mjs`
 * import and execute THIS EXACT CODE in CI rather than re-implementing the rules and
 * drifting from them. If you edit it, copy it to the other repo unchanged - the guard
 * compares the two files and fails if they differ.
 */

/** Generic fallback. Says nothing technical, still tells the user what to do. */
export const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * Shown when the backend is reachable but cannot answer right now: a gateway
 * timeout, an overloaded instance, a restart. Deliberately distinct from the
 * "check your connection" copy, because the user's connection is fine and trying
 * again shortly genuinely does work.
 */
export const SERVER_BUSY_MESSAGE =
  "Our servers are busy right now. Please try again in a moment.";

/**
 * Statuses whose response body never carries anything worth reading, so the status
 * is the only trustworthy signal.
 *
 * This exists because of a real incident. A 504 from the API gateway has an EMPTY
 * body; supabase-js falls back to `JSON.stringify(body)`, so `error.message`
 * arrives as the literal two-character string "{}" - which matched no mapping, did
 * not look technical, and was rendered verbatim in the sign-in toast.
 */
export const HTTP_STATUS_MESSAGES = {
  408: "That took too long. Please try again.",
  429: "Too many attempts. Please wait a few minutes and try again.",
  502: SERVER_BUSY_MESSAGE,
  503: SERVER_BUSY_MESSAGE,
  504: SERVER_BUSY_MESSAGE,
};

/**
 * Failures we can recognise and give real guidance for. Order matters: the first
 * match wins, so keep the specific patterns above the broad ones.
 */
export const FRIENDLY_MAPPINGS = [
  {
    // GoTrue session loss. The user is not signed in any more, whatever the wording.
    match: /\bjwt\b|refresh token|invalid claim|token (?:has )?expired|session (?:not found|expired)|session_not_found/i,
    message: "Your session has expired. Please sign in again.",
  },
  {
    // Fetch failures across browsers and React Native, plus Safari's "Load failed".
    match: /failed to fetch|network request failed|networkerror|\bload failed\b|net::|err_internet|err_connection|unable to resolve host/i,
    message: "Can't reach the server. Check your connection and try again.",
  },
  {
    match: /rate limit|too many requests|for security purposes/i,
    message: "Too many attempts. Please wait a few minutes and try again.",
  },
  {
    // Row-level security and grant failures both mean the same thing to a user.
    match: /row-level security|permission denied|insufficient_privilege|not authorized|unauthorized/i,
    message: "You don't have permission to do that.",
  },
  {
    match: /bucket not found|payload too large|exceeded the maximum allowed size|entity too large/i,
    message: "That file couldn't be uploaded. Please try a smaller file.",
  },
  {
    // The gateway answered instead of the service: overloaded, restarting, or the
    // request outlived the upstream deadline. Above the generic timeout rule so
    // "gateway timeout" gets copy that tells the user it is us, not them.
    match: /bad gateway|gateway time-?out|service unavailable|upstream (?:connect|request|timeout)/i,
    message: SERVER_BUSY_MESSAGE,
  },
  {
    match: /\btimed out\b|statement timeout|etimedout|\babortederror\b/i,
    message: "That took too long. Please try again.",
  },
];

/**
 * Phrases that only ever appear in machine output. Mirrors RAW_DB_SIGNATURES in
 * `supabase/functions/_shared/errors.ts`, plus the client-only sources: the Supabase
 * JS SDK error classes and the JavaScript runtime itself.
 */
export const TECHNICAL_SIGNATURES = [
  // --- Postgres / PostgREST ---
  "duplicate key value",
  "violates unique constraint",
  "violates foreign key constraint",
  "violates not-null constraint",
  "violates check constraint",
  "null value in column",
  "invalid input syntax",
  "value too long for type",
  "permission denied for",
  'relation "',
  "column reference",
  "is ambiguous",
  "syntax error at",
  "deadlock detected",
  "could not serialize",
  "operator does not exist",
  // --- Supabase SDK error classes, which stringify with their name ---
  "autherror",
  "authapierror",
  "authretryablefetcherror",
  "postgresterror",
  "storageapierror",
  "functionshttperror",
  "functionsrelayerror",
  // --- GoTrue internals that are not meant for reading ---
  "unable to exchange external code",
  "bad_code_verifier",
  "flow state",
  "code verifier",
  // --- JavaScript runtime faults: always a bug, never a user message ---
  "is not a function",
  "is not defined",
  "cannot read propert",
  "undefined is not an object",
  "null is not an object",
  "is not iterable",
  "unexpected token",
  "is not valid json",
  "circular structure",
  "maximum call stack",
];

/**
 * Shapes rather than phrases. These catch whole families a word list cannot: Postgres
 * error reports, PostgREST envelopes, stack traces and raw HTTP dumps. The
 * `column "` vs `column reference "` miss that let incident 1 through is exactly the
 * kind of gap these are here to cover.
 */
export const TECHNICAL_SHAPES = [
  /\bsqlstate\b/i,
  /\b\d{5}:\s/,
  /\b(?:detail|hint|context|where):\s/i,
  /\bpgrst\d+\b/i,
  /\bpg_[a-z_]+\b/i,
  /\bat character \d+/i,
  /\bline \d+ at\b/i,
  /\bat [\w.<>]+ \(.*:\d+:\d+\)/,
  /\b(?:https?|postgres(?:ql)?):\/\/\S+/i,
  /<!doctype|<html/i,
  /^\s*[{[]"/,
  // A whole serialised object or array, including the empty "{}" that supabase-js
  // produces from a body-less gateway error. Nothing written for a person to read
  // both opens with a brace and closes with one.
  /^\s*[{[][\s\S]*[}\]]\s*$/,
  /\b[A-Z][A-Za-z]*Error:\s/,
  /\berrno\b|\beconnrefused\b|\benotfound\b/i,
];

/**
 * True when a string looks like machine output rather than something written for a
 * person to read.
 *
 * @param {string} message
 * @returns {boolean}
 */
export function looksTechnical(message) {
  const raw = typeof message === "string" ? message : "";
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return (
    TECHNICAL_SIGNATURES.some((sig) => lower.includes(sig)) ||
    TECHNICAL_SHAPES.some((re) => re.test(raw))
  );
}

/**
 * Dig the HTTP status out of whichever Supabase error class we were handed. They
 * each put it somewhere different: `status` on AuthApiError, `statusCode` (as a
 * string) on StorageApiError, and on the wrapped Response for FunctionsHttpError.
 *
 * @param {unknown} error
 * @returns {number} the status, or 0 when there isn't one
 */
export function readStatus(error) {
  if (!error || typeof error !== "object") return 0;
  const e = /** @type {Record<string, any>} */ (error);
  const candidates = [e.status, e.statusCode, e.context?.status, e.response?.status];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 100 && n <= 599) return n;
  }
  return 0;
}

/**
 * Turn any thrown value into copy that is safe and useful to display.
 *
 * @param {unknown} error - anything at all: an Error, a string, null, a random object.
 * @param {string} [fallback] - copy to use when nothing better is known.
 * @returns {string}
 */
export function toUserMessage(error, fallback) {
  const generic = fallback || GENERIC_MESSAGE;

  /** @type {string} */
  let raw = "";
  if (typeof error === "string") raw = error;
  else if (error && typeof error === "object") {
    const maybe = /** @type {{ message?: unknown }} */ (error).message;
    if (typeof maybe === "string") raw = maybe;
  }
  raw = raw.trim();

  for (const rule of FRIENDLY_MAPPINGS) {
    if (raw && rule.match.test(raw)) return rule.message;
  }

  // Checked after the text rules, so a service that DID explain itself still wins,
  // and before the raw text is trusted, so a body-less gateway failure can never
  // reach a user as "{}".
  const status = readStatus(error);
  if (status && HTTP_STATUS_MESSAGES[status]) return HTTP_STATUS_MESSAGES[status];

  if (!raw) return generic;

  if (looksTechnical(raw)) {
    // Keep the real text reachable for whoever has to diagnose it. If a new failure
    // starts showing up here, add a mapping above rather than letting it through.
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[error] technical text withheld from the user:", raw);
    }
    return generic;
  }

  return raw;
}
