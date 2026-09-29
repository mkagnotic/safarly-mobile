#!/usr/bin/env node
/**
 * Guard: a test that is not committed is not a test.
 *
 * WHY THIS EXISTS. On 29 September 2026 a client reported four broken Travel
 * Buddy flows. Two of them were already covered by fences sitting in this
 * working tree — and CI had never run them, because 75 of the repo's 83 test
 * files had never been `git add`ed. Not ignored. Just never committed, on a
 * convention that "the repo does not commit new test files".
 *
 * So `npm run test` in CI ran 8 files while 83 existed on the machine that
 * wrote them. The pipeline was green, the suite was large, and the two were
 * unrelated. `ci.yml` even carried a hand-written workaround admitting it:
 * "Most of their unit tests are untracked, so without this the pipeline would
 * not notice a revert."
 *
 * A test file that is not in git protects exactly one machine, until that
 * machine is reformatted. This makes the gap visible the moment it opens.
 *
 * HOW IT BEHAVES. In CI the checkout contains only tracked files, so this is a
 * no-op that costs a second. Its value is local: run before you push, and it
 * names every test you are about to leave behind.
 *
 * Deliberately NOT a check on the number of tests. A count invites someone to
 * pad it; this asks the only question that matters — will CI run this file?
 *
 * Run: `npm run check:tests`
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/;

/** Directories whose contents are never part of the unit suite. */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".expo", "android", "ios"]);

/**
 * `e2e/` is exempt, and deliberately so: `e2e/fixtures/users.ts` holds the
 * shared password for three accounts that also exist on PRODUCTION, and
 * production runs live Stripe keys. Those specs need a live backend and an app
 * server, so they could not run in CI anyway. Parameterise the credential
 * first, then delete this exemption.
 */
const EXEMPT_PREFIXES = ["e2e" + sep, "supabase" + sep + "functions" + sep + "_tests" + sep];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (TEST_FILE.test(entry)) out.push(relative(ROOT, full));
  }
  return out;
}

const tracked = new Set(
  execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split(/\r?\n/)
    .filter(Boolean)
    .map((p) => p.split("/").join(sep)),
);

const onDisk = walk(ROOT).filter((p) => !EXEMPT_PREFIXES.some((e) => p.startsWith(e)));
const untracked = onDisk.filter((p) => !tracked.has(p));

const label = existsSync(join(ROOT, "supabase", "functions")) ? "web" : "mobile";
console.log(
  `check:tests [${label}] - ${onDisk.length} test file(s) on disk, ${onDisk.length - untracked.length} tracked`,
);

if (untracked.length) {
  console.error(
    [
      "",
      `  ${untracked.length} test file(s) exist here but are NOT in git, so CI will never run them:`,
      "",
      ...untracked.map((p) => `    ${p}`),
      "",
      "  Commit them, or if one genuinely must stay local, add its directory to",
      "  EXEMPT_PREFIXES in this file with the reason written down.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`check:tests [${label}] - every test is committed. OK`);
