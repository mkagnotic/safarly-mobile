import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { describe, test } from "node:test";

import { makeAppleNonce } from "./appleNonce.ts";

// The nonce contract Supabase enforces: Apple's token carries SHA-256(raw) in
// lower-case hex, and Supabase hashes the raw value it is sent and compares.

const deps = {
  randomBytes: (n: number) => new Uint8Array(randomBytes(n)),
  sha256Hex: async (v: string) => createHash("sha256").update(v, "utf8").digest("hex"),
};

describe("Sign in with Apple nonce", () => {
  test("hashed is exactly SHA-256(raw) in lower-case hex — what Supabase recomputes", async () => {
    const n = await makeAppleNonce(deps);
    assert.equal(n.hashed, createHash("sha256").update(n.raw).digest("hex"));
    assert.match(n.hashed, /^[0-9a-f]{64}$/);
  });

  test("raw is 32 random bytes as hex (64 chars), fresh on every attempt", async () => {
    const a = await makeAppleNonce(deps);
    const b = await makeAppleNonce(deps);
    assert.match(a.raw, /^[0-9a-f]{64}$/);
    assert.notEqual(a.raw, b.raw);
    assert.notEqual(a.hashed, b.hashed);
  });

  test("an upper-case digest is normalised to lower-case", async () => {
    const n = await makeAppleNonce({ ...deps, sha256Hex: async (v) => (await deps.sha256Hex(v)).toUpperCase() });
    assert.equal(n.hashed, createHash("sha256").update(n.raw).digest("hex"));
  });
});
