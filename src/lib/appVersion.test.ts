import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { compareVersions, isUpdateRequired, isVersion } from "./appVersion.ts";

/**
 * The force-update gate, which can lock every user out of the app.
 *
 * That asymmetry drives every case below. Failing to block a bad build costs
 * one bug staying alive a little longer. Blocking wrongly costs EVERY install
 * at once, with no way to recover them — the people affected cannot reach the
 * app to be told anything, and no server change brings them back. So the
 * tests are weighted towards proving the gate stays shut.
 */

describe("compareVersions orders by number, not by string", () => {
  test("the classic lexical trap", () => {
    // "1.10.0" < "1.9.0" as strings. As versions it is NEWER, and treating it
    // as older would gate a build that is ahead of the floor.
    assert.equal(compareVersions("1.10.0", "1.9.0"), 1);
    assert.equal(compareVersions("1.9.0", "1.10.0"), -1);
  });

  test("equal versions compare equal, however written", () => {
    assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
    assert.equal(compareVersions("1.2", "1.2.0"), 0, "a missing part is zero");
    assert.equal(compareVersions("2", "2.0.0"), 0);
  });

  test("each position is significant in order", () => {
    assert.equal(compareVersions("2.0.0", "1.99.99"), 1);
    assert.equal(compareVersions("1.3.0", "1.2.99"), 1);
    assert.equal(compareVersions("1.2.4", "1.2.3"), 1);
  });

  test("large numbers do not wrap or stringify", () => {
    assert.equal(compareVersions("1.0.100", "1.0.99"), 1);
    assert.equal(compareVersions("10.0.0", "9.99.99"), 1);
  });
});

describe("isVersion accepts only what we will act on", () => {
  test("plain numeric forms pass", () => {
    for (const v of ["1", "1.2", "1.2.3", "10.20.30"]) {
      assert.equal(isVersion(v), true, v);
    }
  });

  test("anything else is refused rather than guessed at", () => {
    // A typo in the settings row must not become an unsatisfiable floor.
    for (const v of ["v1.2.3", "latest", "1.2.3-beta", "", "  ", "1..2", "a.b.c", null, undefined, 123]) {
      assert.equal(isVersion(v), false, String(v));
    }
  });
});

describe("isUpdateRequired blocks ONLY on a definite answer", () => {
  test("a build below the floor is blocked", () => {
    assert.equal(isUpdateRequired("1.0.0", "1.0.1"), true);
    assert.equal(isUpdateRequired("1.9.0", "1.10.0"), true);
  });

  test("a build at or above the floor runs", () => {
    assert.equal(isUpdateRequired("1.0.1", "1.0.1"), false, "equal is allowed");
    assert.equal(isUpdateRequired("1.0.2", "1.0.1"), false);
    assert.equal(isUpdateRequired("2.0.0", "1.99.99"), false);
  });

  test("NO FLOOR configured never blocks", () => {
    for (const min of [undefined, null, "", "   "]) {
      assert.equal(isUpdateRequired("1.0.0", min), false, String(min));
    }
  });

  test("a MALFORMED floor never blocks", () => {
    // The nightmare: someone types "v2" or "latest" into platform_settings and
    // every install in the world stops at a screen they cannot dismiss.
    for (const min of ["v2", "latest", "2.x", "1.2.3-rc1", "null"]) {
      assert.equal(isUpdateRequired("1.0.0", min), false, min);
    }
  });

  test("an UNKNOWN current version never blocks", () => {
    // A build that cannot name itself is not evidence of being old.
    for (const cur of [null, "", "unknown", "v1.0.0"]) {
      assert.equal(isUpdateRequired(cur, "9.9.9"), false, String(cur));
    }
  });
});

/**
 * Strip comments before asserting on source.
 *
 * The first version of these checks matched the files' own prose: the docblock
 * in appConfig.ts names `services/api/client.ts` to explain why it is NOT used,
 * and the update screen's comment says there is no "later". Both tripped their
 * own assertions. A source fence has to read code, not the explanation of it.
 */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the fetch path fails open", () => {
  const src = codeOnly(readFileSync("src/services/api/appConfig.ts", "utf8"));

  test("every failure returns null rather than throwing", () => {
    assert.match(src, /catch\s*\{[^}]*return null/s, "a throw at boot would crash the app");
    assert.match(src, /if \(!res\.ok\) return null/, "an error status must not block");
  });

  test("the boot check has a deadline", () => {
    assert.match(src, /AbortController/);
    assert.match(src, /TIMEOUT_MS\s*=\s*3_000/, "a slow answer must be treated as no answer");
  });

  test("it does NOT use the authenticated client", () => {
    // That client refreshes sessions and surfaces errors; both are wrong in
    // front of the login screen.
    assert.ok(!/services\/api\/client/.test(src), "the gate must not depend on a session");
  });
});

describe("the gate is mounted where it cannot be routed around", () => {
  const app = codeOnly(readFileSync("App.tsx", "utf8"));

  test("it returns early, above the navigator", () => {
    const gate = app.indexOf("gate.blocked");
    const nav = app.indexOf("<RootNavigator");
    assert.ok(gate !== -1, "App.tsx does not consult the version gate");
    assert.ok(gate < nav, "the gate must short-circuit BEFORE the navigator mounts");
  });

  test("nothing else mounts when blocked", () => {
    // Everything between the early return and the normal tree IS the blocked
    // branch; nothing app-like may appear inside it.
    const branch = app.slice(app.indexOf("if (gate.blocked)"), app.indexOf("<AuthProvider"));
    assert.ok(branch.includes("<UpdateRequiredScreen"), "the blocked branch must render the screen");
    assert.ok(branch.includes("return"), "the blocked branch must return early");
    assert.ok(!branch.includes("<AuthProvider"), "auth must not mount behind the gate");
    assert.ok(!branch.includes("<NavigationContainer"), "navigation must not mount behind the gate");
  });

  test("the screen offers no way past it", () => {
    const screen = codeOnly(readFileSync("src/components/UpdateRequiredScreen.tsx", "utf8"));
    assert.ok(!/Later|Not now|Skip|Dismiss|onClose/i.test(screen), "a hard gate has one action");
    assert.equal((screen.match(/<AppButton/g) ?? []).length, 1, "exactly one action");
  });
});
