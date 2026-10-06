import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { formatLocalDate, parseLocalDate } from "./travelDate.ts";

/**
 * CLASS-LEVEL FENCE over the UTC off-by-one. Mirrors web's
 * `src/test/dateOnlyColumns.test.ts` — both platforms serve the same person,
 * so a date must not differ between their phone and their laptop.
 *
 * A SQL `date` column arrives as "2026-09-30". `new Date("2026-09-30")` parses
 * it as UTC midnight, which is the EVENING OF THE 29th everywhere west of
 * Greenwich — the whole of the Americas.
 *
 * A client reported this on 29 September 2026 ("why is the date not matching
 * for requests and the posting?"). It was fixed in the date PICKERS, and the
 * fix was recorded as "mobile was already correct". On 6 October 2026 a sweep
 * found EIGHT display formatters here that had never been checked: trip dates
 * in Opportunities and Search, the matches modal, buddy partner cards and
 * details, parcel delivery dates in two more places. Fixing instances is
 * evidently not enough.
 *
 * TIMESTAMP columns are deliberately NOT matched: `created_at`, `expires_at`,
 * `last_message_at` carry a zone, and `new Date()` is correct for them.
 */

/** Columns stored as SQL `date` — no time, no zone. */
const DATE_ONLY =
  /\b(travel_date(_from|_to)?|agreed_travel_date|delivery_by(_from|_to)?|deadline|date_from|date_to)\b/;

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".expo", "android", "ios"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.(test|spec)\./.test(full)) out.push(full);
  }
  return out;
}

describe("the helper itself keeps the calendar day", () => {
  test("parses as local midnight, not UTC", () => {
    const d = parseLocalDate("2026-09-30");
    assert.ok(d);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 8);
    assert.equal(d.getDate(), 30, "the 30th must stay the 30th in every timezone");
  });

  test("the UTC form really would have shifted — proving the bug is real here", () => {
    const utc = new Date("2026-09-30");
    // Only meaningful west of Greenwich; elsewhere there is nothing to prove.
    if (utc.getTimezoneOffset() > 0) {
      assert.equal(utc.getDate(), 29, "this machine reproduces the client's bug");
      assert.notEqual(parseLocalDate("2026-09-30")?.getDate(), utc.getDate());
    }
  });

  test("renders a date-only value without shifting", () => {
    // Locale-agnostic: a phone in Mumbai and CI format differently, but the
    // DAY is what regressed.
    const out = formatLocalDate("2026-09-30");
    assert.ok(out.includes("30"), out);
    assert.ok(!out.includes("29"), `a 29 here means the UTC bug is back: ${out}`);
  });

  test("empty and malformed values fall back rather than rendering garbage", () => {
    assert.equal(formatLocalDate(null), "—");
    assert.equal(formatLocalDate(""), "—");
    assert.equal(formatLocalDate(undefined, undefined, ""), "");
    assert.equal(formatLocalDate("not-a-date"), "—");
  });
});

describe("no source file parses a date-only column with new Date()", () => {
  /**
   * Two shapes, because every real bug was the second one:
   *
   *   direct    new Date(trip.travel_date)
   *   indirect  function fmt(d) { new Date(d) } … fmt(trip.travel_date)
   *
   * Web's first version of this fence looked only for the direct shape and
   * passed cleanly against four known-broken files, because each hid its
   * `new Date` inside a formatter taking a bare `iso`. Catching the indirect
   * shape is the entire point.
   */
  test("neither directly nor through a local formatter", () => {
    const offenders: string[] = [];

    for (const file of walk("src")) {
      const src = readFileSync(file, "utf8");
      const lineOf = (i: number) => src.slice(0, i).split("\n").length;

      // --- direct ---
      for (const m of src.matchAll(/new Date\(([^)]*)\)/g)) {
        const arg = m[1];
        if (/T00:00:00/.test(arg)) continue; // pinned to local midnight on purpose
        if (DATE_ONLY.test(arg)) {
          offenders.push(`${file}:${lineOf(m.index)}  new Date(${arg.trim()})`);
        }
      }

      // --- indirect: local formatters that parse their own parameter ---
      const parsers = new Set<string>();
      const decl =
        /(?:function\s+(\w+)\s*\(\s*(\w+)|const\s+(\w+)\s*=\s*\(?\s*(\w+)[^)\n]{0,120}\)?[^=\n]{0,60}=>)/g;
      for (const d of src.matchAll(decl)) {
        const name = d[1] ?? d[3];
        const param = d[2] ?? d[4];
        if (!name || !param) continue;
        const body = src.slice(d.index, d.index + 400);
        if (new RegExp(`new Date\\(\\s*${param}\\s*\\)`).test(body)) parsers.add(name);
      }

      for (const name of parsers) {
        for (const c of src.matchAll(new RegExp(`\\b${name}\\(([^)]*)\\)`, "g"))) {
          if (!DATE_ONLY.test(c[1])) continue;
          offenders.push(
            `${file}:${lineOf(c.index)}  ${name}(${c[1].trim()})  <- ${name}() parses it with new Date()`,
          );
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      "\nThese render a date-only column as UTC midnight, so every user west of\n" +
        "Greenwich sees the PREVIOUS day. Use formatLocalDate (for display) or\n" +
        "parseLocalDate (for a Date) from @/utils/travelDate:\n\n  " +
        offenders.join("\n  ") +
        "\n",
    );
  });
});
