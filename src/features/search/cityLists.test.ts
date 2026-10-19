import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { INDIA_CITIES, USA_CITIES } from "./cityLists.ts";

/**
 * Listings store the city string exactly as picked and are matched on it, so
 * mobile and web must offer byte-identical lists. The repos are separate, so
 * both pin the same fingerprint: web's `src/lib/__tests__/cityLists.test.ts`
 * carries these exact values. Changing a list here means changing it there too,
 * then updating the fingerprint in BOTH tests.
 */
const fingerprint = (list: readonly string[]) =>
  createHash("sha256").update(list.join("\n")).digest("hex");

const INDIA_FINGERPRINT = "fc66c07b6671ee31ae29def56d1c4bf32bd68f2b8e2c62f9327e162be7ec4ca9";
const USA_FINGERPRINT = "27a6bfa0569edb3ed597cc586675a888325f75dbbf81127ce1173c7c29528626";

test("city lists match the web copy (shared fingerprint)", () => {
  assert.equal(fingerprint(INDIA_CITIES), INDIA_FINGERPRINT);
  assert.equal(fingerprint(USA_CITIES), USA_FINGERPRINT);
});

test("city lists have no duplicate cities or airport codes", () => {
  for (const list of [INDIA_CITIES, USA_CITIES]) {
    assert.equal(new Set(list).size, list.length);
  }
  const codes = USA_CITIES.map((c) => /\(([A-Z]{3})\)/.exec(c)?.[1]);
  assert.ok(codes.every(Boolean));
  assert.equal(new Set(codes).size, codes.length);
});

test("US list includes the domestic airports the client asked for", () => {
  assert.ok(USA_CITIES.includes("Austin (AUS), TX"));
  assert.ok(USA_CITIES.includes("Portland (PDX), OR"));
});
