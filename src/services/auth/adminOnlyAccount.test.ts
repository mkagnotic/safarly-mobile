import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { ADMIN_ACCOUNT_MESSAGE, isAdminOnlyAccount } from "./adminOnlyAccount.ts";

const read = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Client, 4 Nov 2026: an admin account signing in to the app fell through to
// customer onboarding. Same rule as the web customer login.
test("admin without the customer role is admin-only; anything else is not", () => {
  assert.equal(isAdminOnlyAccount(["admin"]), true);
  assert.equal(isAdminOnlyAccount(["admin", "user"]), false);
  assert.equal(isAdminOnlyAccount(["user"]), false);
  assert.equal(isAdminOnlyAccount([]), false);
});

test("email sign-in refuses an admin-only account and the login screen says so", () => {
  const api = read("src/services/api/auth.ts");
  assert.ok(api.includes("if (isAdminOnlyAccount((roles ?? []).map("));
  assert.ok(api.includes('await supabase.auth.signOut({ scope: "local" });\n        throw new Error(ADMIN_ACCOUNT_MESSAGE);'));
  const screen = read("src/features/auth/LoginScreen.tsx");
  assert.ok(screen.includes("if (getErrorMessage(err) === ADMIN_ACCOUNT_MESSAGE) {"));
  assert.equal(ADMIN_ACCOUNT_MESSAGE, "This account is an admin account. Please use the admin login on the website.");
});
