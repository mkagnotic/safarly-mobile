import assert from "node:assert/strict";
import { test } from "node:test";

import { isEmailCode } from "./inputSanitizers.ts";

test("isEmailCode: any 6-10 digit code (Supabase's code length is a project setting)", () => {
  for (const ok of ["123456", "12345678", "1234567890"]) assert.equal(isEmailCode(ok), true, ok);
  for (const bad of ["", "12345", "12345678901", "12a456", " 123456"]) assert.equal(isEmailCode(bad), false, bad);
});
