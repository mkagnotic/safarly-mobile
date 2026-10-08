/**
 * Version comparison for the force-update gate.
 *
 * Hand-rolled on purpose: a dependency for twenty lines of integer comparison
 * is not worth it, and the real risk here is not a missing feature but a WRONG
 * answer. A comparator that says "too old" when it is not locks every install
 * out of the app, so every branch below is written to fail towards "allowed".
 *
 * String comparison is what makes this worth testing: "1.10.0" < "1.9.0"
 * lexically, which would gate a NEWER build. Parts are compared as numbers.
 *
 * Deliberately IMPORT-FREE. Reading this build's own version needs
 * `expo-constants`, which lives in `buildInfo.ts`; keeping that out of here is
 * what lets the decision logic be unit-tested at all, since `node --test`
 * cannot strip types inside node_modules.
 */

/** `1.2.3` -> `[1, 2, 3]`. Missing parts are 0, so `1.2` == `1.2.0`. */
function parts(v: string): [number, number, number] {
  const [a, b, c] = String(v)
    .trim()
    .split(".")
    .map((n) => Number.parseInt(n, 10));
  return [
    Number.isFinite(a) ? a : 0,
    Number.isFinite(b) ? b : 0,
    Number.isFinite(c) ? c : 0,
  ];
}

/** -1 if a < b, 0 if equal, 1 if a > b. */
export function compareVersions(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}

/** Only `1`, `1.2` or `1.2.3`. Anything else is not a version we will act on. */
export function isVersion(v: unknown): v is string {
  return typeof v === "string" && /^\d+(\.\d+){0,2}$/.test(v.trim());
}

/**
 * THE decision. Blocking is the exceptional branch: it happens only when both
 * versions are known, well-formed, and this one is genuinely lower.
 *
 * Every other case — no floor configured, a malformed floor, an unknown
 * current version — returns false. Those are the cases where a bug in this
 * file, a typo in the settings row or a quirk of the build would otherwise
 * brick working installs with no way to recover them.
 */
export function isUpdateRequired(
  current: string | null,
  minimum: string | null | undefined,
): boolean {
  if (!isVersion(minimum)) return false;
  if (!isVersion(current)) return false;
  return compareVersions(current, minimum) < 0;
}
