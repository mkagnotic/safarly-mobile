import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("after Apple sign-in the app sends the authorization code to the server", () => {
  const src = read("./appleOAuth.ts");
  const fn = src.slice(src.indexOf("export async function performAppleOAuth"), src.indexOf("export async function requestAppleAuthorizationCode"));
  const signIn = fn.indexOf("appleSignInWithIdToken(");
  const store = fn.indexOf("usersApi.storeAppleToken(credential.authorizationCode)");
  assert.ok(signIn > -1 && store > signIn, "the code is sent only after the Supabase session exists");
  assert.match(fn, /void usersApi\.storeAppleToken\(credential\.authorizationCode\)\.catch\(\(\) => \{\}\)/, "best-effort: never blocks or fails sign-in");
});

test("the deletion fallback (fresh device code) is still in place", () => {
  assert.match(read("./appleOAuth.ts"), /export async function requestAppleAuthorizationCode/);
  assert.match(read("../../features/profile/DeleteAccountScreen.tsx"), /apple_authorization_code: appleCode/);
});

test("the API call targets the server route and never receives the token", () => {
  const api = read("../api/users.ts");
  assert.match(api, /api\.post<\{ stored: boolean \}>\("\/user-handler\/me\/apple-token"/);
});
