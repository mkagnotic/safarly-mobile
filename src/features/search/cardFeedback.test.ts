import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

/**
 * Feedback from a card in a scrolled list must be visible from that card.
 *
 * Reported from a device on 12 October: "the Connect button doesn't do
 * anything, then why is it there". It did work — `handleConnect` called
 * `buddiesApi.sendRequest` and reported the outcome. It reported it into
 * `setNotice`, which renders a banner in the SCREEN HEADER, around line 700.
 * The buddy card sits past line 1500 and the user is scrolled well down the
 * results. So the request was sent, the confirmation appeared off-screen
 * above, and from the user's seat the button was dead.
 *
 * Eight card actions shared the defect — Connect, Start chat and View profile
 * on both the package and buddy cards.
 *
 * This is the worst shape of bug to leave untested: nothing throws, nothing
 * logs, every test passes, and the feature is unusable. A source fence is the
 * only cheap guard — asserting on a toast's pixel position needs a device.
 */

const SRC = readFileSync("src/features/search/SearchScreen.tsx", "utf8");

/**
 * The cards that moved out of SearchScreen.tsx. BuddyMatchCard's state and
 * actions stayed in the screen (check:ux pins `handleConnect` there); only its
 * markup moved, to BuddyMatchCardBody.
 */
const CARD_FILES = [
  "src/features/search/components/PackageMatchCard.tsx",
  "src/features/search/components/BuddyMatchCardBody.tsx",
];

/** Where the card components begin in the screen — everything below here is in the list. */
const CARDS_START = (() => {
  const i = SRC.indexOf("function BuddyMatchCard(");
  assert.ok(i !== -1, "BuddyMatchCard not found — has it been renamed?");
  return i;
})();

const cardSource = [
  SRC.slice(CARDS_START),
  ...CARD_FILES.map((f) => readFileSync(f, "utf8")),
].join("\n");

/** Strip comments: this file explains the bug, and prose is not code. */
const cardCode = cardSource
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("card actions report through the global toast, not the screen banner", () => {
  test("no card raises the header banner", () => {
    const offenders = cardCode
      .split("\n")
      .map((l, i) => [i + 1, l] as const)
      .filter(([, l]) => /\bsetNotice\s*\(/.test(l));
    assert.deepEqual(
      offenders.map(([n, l]) => `${n}: ${l.trim().slice(0, 70)}`),
      [],
      "a card is reporting into the screen-level banner, which renders in the " +
        "header — invisible to anyone scrolled down to that card. Use " +
        "`showToast` from @/feedback/appFeedback instead.",
    );
  });

  test("the cards do use the global toast", () => {
    assert.match(
      cardCode,
      /showToast\s*\(/,
      "the cards report nothing at all — a button that gives no feedback reads as broken",
    );
    assert.match(SRC, /from "@\/feedback\/appFeedback"/);
  });

  test("Connect still actually sends the request", () => {
    // The point of the button. A toast proving nothing happened is worse than
    // no toast.
    assert.match(cardCode, /buddiesApi\.sendRequest\(/, "Connect no longer sends a buddy request");
  });

  test("Connect cannot be double-fired", () => {
    // Two taps would create a request, then a CONFLICT error toast on top of
    // a success toast.
    assert.match(cardCode, /if \(!match\.id \|\| connecting\) return;/);
  });

  test("the screen's own banner is still used for screen-level errors", () => {
    // Filter and date validation belong in the header banner — the user is
    // looking at the filters when those fire.
    const screenCode = SRC.slice(0, CARDS_START);
    assert.match(
      screenCode,
      /setNotice\(\{[\s\S]{0,80}Invalid date/,
      "date validation should still use the inline banner next to the filters",
    );
  });
});
