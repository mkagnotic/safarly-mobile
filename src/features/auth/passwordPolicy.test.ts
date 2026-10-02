import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PASSWORD_MIN_LENGTH,
  scorePassword,
  validatePassword,
  validatePasswordConfirm,
} from "./passwordPolicy.ts";

test("accepts a password with letters and numbers at the minimum length", () => {
  assert.equal(validatePassword("abcd1234"), null);
  assert.equal(validatePassword("Passw0rd!"), null);
});

test("rejects an empty password", () => {
  assert.equal(validatePassword(""), "Password is required");
});

test("rejects anything shorter than the minimum", () => {
  const short = "a1b2c3"; // 6 chars — the old mobile rule, now invalid
  assert.equal(short.length < PASSWORD_MIN_LENGTH, true);
  assert.equal(
    validatePassword(short),
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  );
});

test("rejects letters-only and digits-only passwords", () => {
  const expected = "Password must contain both letters and numbers";
  assert.equal(validatePassword("abcdefgh"), expected);
  assert.equal(validatePassword("12345678"), expected);
});

test("does not require mixed case or symbols (web parity)", () => {
  // Web accepts these; the backend's stricter validatePassword would not.
  assert.equal(validatePassword("abcd1234"), null);
});

test("confirm mismatch is reported once the password itself is valid", () => {
  assert.equal(validatePasswordConfirm("abcd1234", "abcd1234"), null);
  assert.equal(validatePasswordConfirm("abcd1234", "abcd12345"), "Passwords do not match");
});

test("confirm error is suppressed while the password is still invalid", () => {
  // One problem at a time — the password error is the one worth showing.
  assert.equal(validatePasswordConfirm("abc", "totally-different"), null);
});

test("strength score is empty for an empty password", () => {
  const s = scorePassword("");
  assert.equal(s.score, 0);
  assert.equal(s.label, "");
});

test("strength score rises with length, case mix and symbols", () => {
  assert.equal(scorePassword("abcd1234").score, 1); // >=8 only
  assert.equal(scorePassword("abcd12345678").score, 2); // >=8, >=12
  assert.equal(scorePassword("abcD12345678").score, 3); // + mixed case
  assert.equal(scorePassword("abcD1234567!").score, 4); // + digit & symbol
});

test("strength score never exceeds 4", () => {
  assert.equal(scorePassword("aB3$aB3$aB3$aB3$aB3$").score, 4);
});
