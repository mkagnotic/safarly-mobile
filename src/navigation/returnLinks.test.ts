import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { coldStartReturnLink } from "./returnLinks.ts";

test("a payout return that starts the app opens Payout setup", () => {
  assert.equal(coldStartReturnLink("safarly://payout-return?setup=complete"), "safarly://payout-setup?setup=complete");
  assert.equal(coldStartReturnLink("safarly://payout-return"), "safarly://payout-setup");
  assert.equal(coldStartReturnLink("safarly://payout-return/?refresh=1"), "safarly://payout-setup?refresh=1");
});

test("a checkout return that starts the app opens Bookings", () => {
  assert.equal(coldStartReturnLink("safarly://pay-return?session_id=cs_1"), "safarly://bookings?session_id=cs_1");
});

test("a checkout return that starts the app opens THAT booking (success and cancel)", () => {
  const id = "f75f4961-5831-452e-98ed-3defff976cc1";
  // Exactly what the server's /mobile-return bounce forwards (staging probe, 29 Oct 2026).
  assert.equal(
    coldStartReturnLink(`safarly://pay-return?booking_id=${id}&status=success&session_id=cs_1`),
    `safarly://bookings?booking_id=${id}&status=success&session_id=cs_1&expandId=${id}`,
  );
  assert.equal(
    coldStartReturnLink(`safarly://pay-return?booking_id=${id}&status=cancelled`),
    `safarly://bookings?booking_id=${id}&status=cancelled&expandId=${id}`,
  );
  // Not a booking id: nothing is invented.
  assert.equal(coldStartReturnLink("safarly://pay-return?booking_id=nope"), "safarly://bookings?booking_id=nope");
});

test("an identity-verification return that starts the app opens the verification screen", () => {
  assert.equal(coldStartReturnLink("safarly://kyc-return"), "safarly://kyc");
  // Didit appends its own hints; they pass through (the screen ignores them and asks the server).
  assert.equal(coldStartReturnLink("safarly://kyc-return?verificationSessionId=x&status=Approved"), "safarly://kyc?verificationSessionId=x&status=Approved");
});

test("every other link is left alone", () => {
  for (const url of ["safarly://messages/abc", "https://mysafarly.com/app/kyc", "safarly://payout-returns", null]) {
    assert.equal(coldStartReturnLink(url), url);
  }
});

test("only the cold-start path rewrites; live return links stay unrouted", () => {
  const src = readFileSync(new URL("./linking.ts", import.meta.url), "utf8");
  assert.match(src, /pendingUrl = coldStartReturnLink\(await Linking\.getInitialURL\(\)\)/);
  assert.doesNotMatch(src, /["']payout-return["']|["']pay-return["']|["']kyc-return["']/, "a live route would yank users out of signup, checkout or verification");
});
