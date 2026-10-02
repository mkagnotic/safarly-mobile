import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, test } from "node:test";

// A REGRESSION FENCE, mirroring web's `src/test/noListingPricing.test.ts`.
//
// The bug: the "Pay now · $X" button and the booking cards quoted the parcel's
// `fee_offered` - the sender's ASKING price, editable after the deal is agreed -
// while checkout and the server charge `agreed_amount`. On a BOOKING, always go
// through `bookingFee()`; a standalone parcel/listing may still show its own price.

const SRC = join(process.cwd(), "src");
const BOOKING_LISTING_PRICE = /\bbookings?\s*[?.]*\.\s*parcel\s*[?.]*\.\s*fee_offered\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe("no screen prices a booking from the listing", () => {
  const files = walk(SRC);

  test("the fence is actually scanning files", () => {
    assert.ok(files.length > 50, `only found ${files.length} files`);
  });

  test("never reads fee_offered off a booking - use bookingFee()", () => {
    const offenders = files
      // paymentMath.ts is THE one place allowed to touch it (legacy fallback).
      .filter((f) => !f.endsWith(join("bookings", "paymentMath.ts")))
      .filter((f) => BOOKING_LISTING_PRICE.test(readFileSync(f, "utf8")))
      .map((f) => relative(process.cwd(), f).split(sep).join("/"));
    assert.deepEqual(
      offenders,
      [],
      `These quote the sender's editable asking price on a BOOKING - the "Pay $71.50 in ` +
        `chat vs $110.00 at checkout" bug. Use bookingFee(booking) from ` +
        `"@/features/bookings/paymentMath":\n  ${offenders.join("\n  ")}`,
    );
  });
});
