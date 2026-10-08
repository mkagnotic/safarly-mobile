import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

/**
 * REGRESSION FENCE over the Google account picker, reported from a real device
 * on 6 October 2026: "there are multiple accounts on my phone, when I click
 * sign in with Google it must show all of them — that does not happen."
 *
 * `GoogleSignin.signIn()` caches the last account used and returns it without
 * prompting. Two consequences, one cosmetic and one not:
 *
 *   - nobody can switch Google accounts, ever; and
 *   - on a shared phone the second person signing in lands silently in the
 *     FIRST person's Safarly account, having been shown no choice.
 *
 * Web never had this: `googleOAuth.web.ts` passes `prompt: "select_account"`
 * on every redirect. These fences assert native now matches, and that signing
 * out of Safarly also forgets Google — otherwise the next sign-in re-enters
 * the account the user just left.
 *
 * Source-level, deliberately. The defect lives in a native SDK handshake that
 * no emulator or RN-Web harness can exercise; the alternative to this fence is
 * the thing we actually had, which is nothing.
 */

const read = (p: string) => readFileSync(p, "utf8");

describe("the native sign-in always offers a choice of account", () => {
  const src = read("src/services/auth/googleOAuth.ts");

  test("the cached account is dropped BEFORE signIn() is called", () => {
    const clear = src.indexOf("GoogleSignin.signOut()");
    const signIn = src.indexOf("GoogleSignin.signIn()");
    assert.ok(clear !== -1, "performGoogleOAuth never clears the cached account");
    assert.ok(signIn !== -1, "performGoogleOAuth no longer calls signIn()");
    assert.ok(clear < signIn, "the clear must come first, or the picker is skipped");
  });

  test("clearing is best-effort and cannot block a sign-in", () => {
    assert.match(
      src,
      /try \{\s*await GoogleSignin\.signOut\(\);\s*\} catch/,
      "an unguarded signOut() would turn a cold start into a failed sign-in",
    );
  });

  test("web keeps forcing the picker its own way", () => {
    assert.match(read("src/services/auth/googleOAuth.web.ts"), /prompt:\s*"select_account"/);
  });
});

describe("signing out of Safarly forgets the Google account", () => {
  const ctx = read("src/context/AuthContext.tsx");

  test("both sign-out paths clear it", () => {
    const calls = ctx.match(/await clearGoogleSession\(\)/g) ?? [];
    assert.equal(calls.length, 2, "signOut and signOutAfterAccountDeletion must both clear");
  });

  test("it is imported from the platform-resolved module", () => {
    // Not the native package directly: Metro swaps in `googleOAuth.web.ts` for
    // web, where importing @react-native-google-signin would break the bundle.
    assert.match(ctx, /import \{[^}]*clearGoogleSession[^}]*\} from "@\/services\/auth\/googleOAuth"/);
    assert.ok(!/@react-native-google-signin/.test(ctx));
  });

  test("web exports the same name, so the shared call site compiles", () => {
    assert.match(
      read("src/services/auth/googleOAuth.web.ts"),
      /export async function clearGoogleSession\(\)/,
    );
  });
});
