import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { NEW_ACCOUNT_WINDOW_MS, firstName, greetingWord, homeGreeting, isNewAccount } from "./homeGreeting.ts";

// Client report 29 Oct 2026: a user who had just signed up saw "Welcome back".
const NOW = Date.parse("2026-10-29T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("home greeting", () => {
  test("brand-new account (minutes old) is welcomed, not welcomed back", () => {
    assert.equal(homeGreeting({ name: "Asha Rao", created_at: ago(5 * 60 * 1000) }, NOW), "Welcome, Asha");
  });

  test("an account older than 24 h is welcomed back", () => {
    assert.equal(homeGreeting({ name: "Asha Rao", created_at: ago(NEW_ACCOUNT_WINDOW_MS + 1) }, NOW), "Welcome back, Asha");
    assert.equal(greetingWord(ago(30 * 24 * 3600 * 1000), NOW), "Welcome back");
  });

  test("the 24 h boundary", () => {
    assert.equal(isNewAccount(ago(NEW_ACCOUNT_WINDOW_MS - 1), NOW), true);
    assert.equal(isNewAccount(ago(NEW_ACCOUNT_WINDOW_MS), NOW), false);
  });

  test("created_at slightly in the future (device clock behind) is still new", () => {
    assert.equal(isNewAccount(new Date(NOW + 60_000).toISOString(), NOW), true);
  });

  test("missing or garbage created_at falls back to 'Welcome back' (never mislabels a returning user)", () => {
    assert.equal(greetingWord(null, NOW), "Welcome back");
    assert.equal(greetingWord(undefined, NOW), "Welcome back");
    assert.equal(greetingWord("not a date", NOW), "Welcome back");
  });

  test("no name: just the word, no dangling comma", () => {
    assert.equal(homeGreeting({ name: "", created_at: ago(1000) }, NOW), "Welcome");
    assert.equal(homeGreeting({ name: "   ", created_at: null }, NOW), "Welcome back");
    assert.equal(homeGreeting(null, NOW), "Welcome back");
  });

  test("first name is the first word, trimmed", () => {
    assert.equal(firstName("  Mahesh   Kumar "), "Mahesh");
    assert.equal(firstName(null), "");
  });

  test("HomeScreen uses the rule instead of a hard-coded 'Welcome back'", () => {
    const src = readFileSync(new URL("../features/tabs/HomeScreen.tsx", import.meta.url), "utf8");
    assert.match(src, /greetingWord\(profile\?\.created_at\)/);
    assert.doesNotMatch(src, /<Text style=\{styles\.muted\}>Welcome back<\/Text>/);
  });
});
