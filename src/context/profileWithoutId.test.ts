import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkOnboarding } from "./onboardingCheck.ts";

/**
 * A slow database used to make GET /me answer with a "profile" holding only
 * the activity counts (no id, no terms_accepted_at), and the app sent an
 * onboarded user to ProfileSetup (29 Oct 2026, staging User Five). An id-less
 * profile must read as "unknown" (error + Try again), never "incomplete".
 */
const auth = readFileSync(new URL("./AuthContext.tsx", import.meta.url), "utf8");

test("the onboarding loader throws on a profile without an id", () => {
  assert.match(auth, /if \(!profile\?\.id\) throw new Error\("We couldn't load your account\. Please try again\."\);/);
});

test("a loader that throws answers unknown, not incomplete", async () => {
  const idLess = { total_trips: 0, total_deliveries: 0 } as { id?: string; terms_accepted_at?: string };
  const result = await checkOnboarding(
    async () => {
      if (!idLess.id) throw new Error("We couldn't load your account. Please try again.");
      return idLess.terms_accepted_at;
    },
    { isTimeout: () => false, sleep: async () => {} },
  );
  assert.equal(result.status, "unknown");
});
