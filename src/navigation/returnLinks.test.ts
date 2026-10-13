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

test("every other link is left alone", () => {
  for (const url of ["safarly://messages/abc", "https://mysafarly.com/app/kyc", "safarly://payout-returns", null]) {
    assert.equal(coldStartReturnLink(url), url);
  }
});

test("only the cold-start path rewrites; live return links stay unrouted", () => {
  const src = readFileSync(new URL("./linking.ts", import.meta.url), "utf8");
  assert.match(src, /pendingUrl = coldStartReturnLink\(await Linking\.getInitialURL\(\)\)/);
  assert.doesNotMatch(src, /["']payout-return["']|["']pay-return["']/, "a live route would yank users out of signup or checkout");
});
