/**
 * One answer to "what do we put on screen when this failed?".
 *
 * `userFacingError.js` decides whether a string is SAFE to show. This module
 * decides what to show INSTEAD of, or alongside, that string: which of the six
 * failure kinds we are looking at, a heading, a sentence that names a next step,
 * and whether trying again is worth offering.
 *
 * Why it exists. Every list screen in both apps rendered the same sentence for
 * every failure - "We couldn't load this content. Please try again." - whether
 * the phone was in a tunnel, the account lacked permission, or the record had
 * been deleted. Three different problems, three different next steps, one
 * message that fitted none of them.
 *
 * The server's own message still wins whenever it wrote one. This only fills the
 * gap, so an edge function that already explains itself is never overruled: that
 * keeps every existing screen behaving exactly as it does today.
 *
 * This file is deliberately plain JavaScript, not TypeScript, and is
 * byte-identical in the web and mobile repos, so `scripts/check-user-facing-errors.mjs`
 * can import and execute THIS EXACT CODE in CI. If you edit it, copy it to the
 * other repo unchanged - the guard compares the two files and fails if they differ.
 */

import {
  FRIENDLY_MAPPINGS,
  GENERIC_MESSAGE,
  HTTP_STATUS_MESSAGES,
  looksTechnical,
  readStatus,
  toUserMessage,
} from "./userFacingError.js";

/** The six situations a person can actually be in. Order is not significant. */
export const ERROR_KINDS = /** @type {const} */ ([
  "offline",
  "permission",
  "notFound",
  "validation",
  "server",
  "unknown",
]);

const NETWORK_RE =
  /failed to fetch|network request failed|networkerror|\bload failed\b|net::|err_internet|err_connection|unable to resolve host|can'?t reach the server|check your connection/i;
const PERMISSION_RE =
  /permission denied|row-level security|not authorized|unauthori[sz]ed|forbidden|don'?t have permission|only the \w+ can|insufficient_privilege/i;
const NOT_FOUND_RE =
  /\bnot found\b|no longer (?:available|exists)|doesn'?t exist|does not exist|has been (?:removed|deleted)|was removed/i;
const VALIDATION_RE =
  /\brequired\b|is invalid|invalid \w+|must be|must contain|too (?:long|short|large|small|many characters)|already (?:exists|taken|in use)|please (?:enter|choose|select|fix|add)/i;
const SERVER_RE =
  /servers? (?:are )?busy|service unavailable|bad gateway|gateway time-?out|try again in a moment|took too long|timed out|too many (?:attempts|requests)|rate limit/i;
const SESSION_RE = /session (?:has )?expired|sign in again|refresh token|\bjwt\b/i;

/** Is the device itself offline? Only meaningful in a browser or RN runtime. */
function deviceOffline() {
  try {
    return typeof navigator !== "undefined" && navigator.onLine === false;
  } catch {
    return false;
  }
}

/** The raw message, whatever shape the thrown value had. */
function rawMessage(error) {
  if (typeof error === "string") return error.trim();
  if (error && typeof error === "object") {
    const m = /** @type {{ message?: unknown }} */ (error).message;
    if (typeof m === "string") return m.trim();
  }
  return "";
}

/**
 * Which of the six kinds is this?
 *
 * Status wins over wording where it is decisive, because a status cannot be
 * phrased badly. A 4xx that carries a recognisable sentence still gets read, so
 * a 400 that says "not found" is treated as not-found rather than validation.
 *
 * @param {unknown} error
 * @returns {"offline"|"permission"|"notFound"|"validation"|"server"|"unknown"}
 */
export function classifyError(error) {
  const raw = rawMessage(error);
  const status = readStatus(error);

  // A transport failure is indistinguishable from a dead radio, and the advice is
  // the same either way, so it is checked before anything else.
  if (NETWORK_RE.test(raw)) return "offline";
  if (!status && !raw && deviceOffline()) return "offline";

  // A lost session is a permission problem the user can act on: sign in again.
  if (SESSION_RE.test(raw)) return "permission";

  if (NOT_FOUND_RE.test(raw)) return "notFound";
  if (PERMISSION_RE.test(raw)) return "permission";
  if (SERVER_RE.test(raw)) return "server";

  if (status >= 500) return "server";
  if (status === 408 || status === 429) return "server";
  if (status === 401 || status === 403) return "permission";
  if (status === 404 || status === 410) return "notFound";
  if (status === 400 || status === 409 || status === 422) {
    return VALIDATION_RE.test(raw) ? "validation" : "notFound";
  }

  if (VALIDATION_RE.test(raw)) return "validation";
  if (deviceOffline()) return "offline";
  return "unknown";
}

/**
 * Copy per kind. `subject` is the thing the screen was trying to show, in the
 * words the user would use for it - "your bookings", "this trip".
 */
function copyFor(kind, subject) {
  const it = subject || "this";
  switch (kind) {
    case "offline":
      return {
        title: "You're offline",
        body: `We can't load ${it} without a connection. Check your network and try again.`,
        retryable: true,
      };
    case "server":
      return {
        title: "Our servers are busy",
        body: "Nothing is lost — this usually clears in a moment. Please try again.",
        retryable: true,
      };
    // No subject in these two: a subject reads naturally after "we can't load ..."
    // but not as the head of a sentence - "Your preferences belongs to someone
    // else" was on screen during acceptance testing.
    case "permission":
      return {
        title: "You can't open this",
        body: "It belongs to someone else, or your account doesn't have access to it.",
        retryable: false,
      };
    case "notFound":
      return {
        title: "Not here any more",
        body: "It may have been cancelled or removed. Go back and pick it again.",
        retryable: false,
      };
    case "validation":
      return {
        title: "Check the details",
        body: "Some of what was entered can't be used. Fix the highlighted fields and try again.",
        retryable: false,
      };
    default:
      return {
        title: "Something went wrong",
        body: `We couldn't load ${it}. Please try again.`,
        retryable: true,
      };
  }
}

/**
 * Copy this codebase writes for itself, rather than copy a service wrote for this
 * particular failure. `toUserMessage` returns these for any unrecognised
 * transport or gateway error, so without this set they would always win over the
 * kind-specific copy below - and the user would keep reading the generic line.
 */
const OUR_OWN_COPY = new Set(
  [GENERIC_MESSAGE, ...FRIENDLY_MAPPINGS.map((r) => r.message), ...Object.values(HTTP_STATUS_MESSAGES)].map((m) =>
    String(m).toLowerCase(),
  ),
);

/**
 * Is this message worth showing to the user in place of our own copy?
 *
 * Only sentences a service actually wrote about this failure. Anything
 * technical, empty, one of our own canned lines, or too short to be an
 * explanation adds nothing over the per-kind copy below.
 */
function isUsefulServerMessage(message) {
  if (!message) return false;
  if (OUR_OWN_COPY.has(message.trim().toLowerCase())) return false;
  if (looksTechnical(message)) return false;
  // A bare noun phrase ("Booking not found") is a heading, not an explanation;
  // it repeats what the title already says. Require something sentence-shaped.
  return message.trim().split(/\s+/).length >= 5;
}

/**
 * Everything a fallback UI needs, for any thrown value.
 *
 * @param {unknown} error - anything at all.
 * @param {{ subject?: string, title?: string, body?: string }} [options]
 *   `subject` names what failed to load, in the user's words. `title` and `body`
 *   let a caller keep wording it already had; whatever is passed always wins.
 * @returns {{ kind: string, title: string, body: string, retryable: boolean }}
 */
export function fallbackFor(error, options) {
  const opts = options || {};
  const kind = classifyError(error);
  const base = copyFor(kind, opts.subject);

  // A lost session is the one access problem the user can fix in one step, and
  // the step is specific. Grouping it with the other permission failures put
  // "It belongs to someone else, or your account doesn't have access to it" on
  // screen for an expired token - sending people to look for a permission they
  // had all along instead of simply signing in again.
  if (kind === "permission" && SESSION_RE.test(rawMessage(error))) {
    return {
      kind,
      title: opts.title || "Your session has expired",
      body: opts.body || "Please sign in again to pick up where you left off.",
      retryable: false,
    };
  }

  // The server's sentence is more specific than ours whenever it wrote one, and
  // it is what today's screens already display - so it stays the body.
  const fromServer = toUserMessage(error, "");
  const body = opts.body || (isUsefulServerMessage(fromServer) ? fromServer : base.body);

  return {
    kind,
    title: opts.title || base.title,
    body,
    retryable: base.retryable,
  };
}
