import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { STAGE_ORDER, computeJourney, type StageKey } from "./journeyTracker.ts";
import type { Booking, Parcel } from "@/services/api";

// Mirrors web's `src/test/trackerDates.test.ts`. journeyTracker.ts is a verbatim
// copy of web's logic, so this suite exists to prove the two platforms agree.
//
// The bug these guard: the tracker's only travel date was `agreed_travel_date`,
// which is NULL until the carrier pins an exact day - the normal state for most of
// a deal's life. So travel milestones were dateless, "Traveling" fell back to
// `handoff_accepted_at` (the day the parcel changed hands, not the flight), and the
// only dates on screen came from the day the deal was set up. A carrier flying on
// Aug 16, matched on Aug 12, saw nothing but Aug 12.

const NOW = new Date(2026, 7, 13); // 2026-08-13, local
const MATCH_DAY = "2026-08-12T09:30:00Z";
const FLIGHT_DAY = "2026-08-16";

/** How this locale renders a LOCALLY-constructed date - the shift-free reference. */
const localShort = (y: number, mZeroBased: number, d: number) =>
  new Date(y, mZeroBased, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** How this locale renders a DATE RANGE - the same call the tracker makes, so the
 *  expectation holds in a month-first locale and a day-first one alike. */
const rangeShort = (a: [number, number, number], b: [number, number, number]) =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })
    .formatRange(new Date(a[0], a[1], a[2]), new Date(b[0], b[1], b[2]));

/** How an INSTANT renders locally. Timestamps are meant to convert to local time;
 *  it is only DATE-ONLY values that must never shift. */
const tsShort = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const parcel = () => ({ id: "p1", sender_id: "u1", status: "matched" }) as Parcel;

const booking = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "b1",
    parcel_id: "p1",
    sender_id: "u1",
    carrier_id: "c1",
    status: "payment_secured",
    created_at: MATCH_DAY,
    handoff_accepted_at: MATCH_DAY,
    agreed_travel_date: null,
    ready_to_travel_at: null,
    journey_started_at: null,
    ready_for_delivery_at: null,
    delivered_at: null,
    carrier_request: { travel_doc_status: "approved" },
    timeline: [{ event: "payment_held", description: null, created_at: MATCH_DAY }],
    ...overrides,
  }) as unknown as Booking;

const singleDayTrip = (d: string) => ({ travel_date: d, travel_date_from: d, travel_date_to: d });

function details(b: Booking) {
  const r = computeJourney(parcel(), b, NOW);
  const map = {} as Record<StageKey, string | undefined>;
  for (const s of r.stages) map[s.key] = s.detail;
  return map;
}

function states(b: Booking) {
  const r = computeJourney(parcel(), b, NOW);
  const map = {} as Record<StageKey, string>;
  for (const s of r.stages) map[s.key] = s.state;
  return map;
}

describe("tracker dates - flight Aug 16, matched Aug 12", () => {
  test("travel milestones show the FLIGHT date, never the match date", () => {
    const d = details(booking({ trip: singleDayTrip(FLIGHT_DAY) }));
    assert.equal(d.flight_verified, `Flight ${localShort(2026, 7, 16)}`);
    assert.equal(d.travel_tomorrow, localShort(2026, 7, 16));
    assert.equal(d.traveling, localShort(2026, 7, 16));
    for (const key of ["flight_verified", "travel_tomorrow", "traveling"] as StageKey[]) {
      assert.ok(!d[key]?.includes(localShort(2026, 7, 12)));
    }
  });

  test("event milestones keep their OWN event dates", () => {
    const d = details(booking({ trip: singleDayTrip(FLIGHT_DAY) }));
    assert.equal(d.matched, tsShort(MATCH_DAY));
    assert.equal(d.parcel_received, tsShort(MATCH_DAY));
    assert.equal(d.payment_secured, tsShort(MATCH_DAY));
  });

  test("without the trip, travel milestones stay BLANK rather than borrowing a set-up date", () => {
    const d = details(booking());
    assert.equal(d.flight_verified, undefined);
    assert.equal(d.travel_tomorrow, undefined);
    assert.equal(d.traveling, undefined);
    assert.equal(d.matched, tsShort(MATCH_DAY));
  });

  test("a real journey timestamp still wins over the scheduled date", () => {
    const d = details(
      booking({
        trip: singleDayTrip(FLIGHT_DAY),
        status: "in_transit",
        journey_started_at: "2026-08-17T06:00:00Z",
        ready_to_travel_at: "2026-08-15T20:00:00Z",
      }),
    );
    assert.equal(d.traveling, tsShort("2026-08-17T06:00:00Z"));
    assert.equal(d.travel_tomorrow, tsShort("2026-08-15T20:00:00Z"));
  });
});

describe("travel-date precedence", () => {
  test("a PINNED agreed date beats the listing", () => {
    const d = details(booking({ trip: singleDayTrip(FLIGHT_DAY), agreed_travel_date: "2026-08-19" }));
    assert.equal(d.flight_verified, `Flight ${localShort(2026, 7, 19)}`);
  });

  test("different flight dates flow through dynamically", () => {
    const cases: Array<[string, string]> = [
      ["2026-08-16", localShort(2026, 7, 16)],
      ["2026-09-02", localShort(2026, 8, 2)],
      ["2027-01-31", localShort(2027, 0, 31)],
    ];
    for (const [iso, expected] of cases) {
      assert.equal(details(booking({ trip: singleDayTrip(iso) })).flight_verified, `Flight ${expected}`);
    }
  });

  test("a RANGE with no pinned day shows the window, not a guessed day", () => {
    const d = details(
      booking({ trip: { travel_date: "2026-08-16", travel_date_from: "2026-08-16", travel_date_to: "2026-08-18" } }),
    );
    assert.equal(d.flight_verified, `Flight ${rangeShort([2026, 7, 16], [2026, 7, 18])}`);
  });

  test("a range across a month boundary keeps both months", () => {
    const d = details(
      booking({ trip: { travel_date: "2026-08-30", travel_date_from: "2026-08-30", travel_date_to: "2026-09-02" } }),
    );
    assert.equal(d.flight_verified, `Flight ${rangeShort([2026, 7, 30], [2026, 8, 2])}`);
  });
});

describe("date-only values must not shift, forced WEST of Greenwich", () => {
  // This box runs Asia/Calcutta (UTC+5:30), where a UTC-parsed date-only value still
  // lands on the right calendar day - so the checks cannot fail even if the bug came
  // back. A western zone is what makes them bite: `new Date("2026-08-16")` is Aug 15.
  const original = process.env.TZ;
  before(() => { process.env.TZ = "America/Los_Angeles"; });
  after(() => { process.env.TZ = original; });

  test("the control: a naive UTC parse really does lose a day here", () => {
    const naive = new Date("2026-08-16").toLocaleDateString(undefined, { month: "short", day: "numeric" });
    assert.notEqual(naive, localShort(2026, 7, 16));
  });

  test("listed trip date, pinned date and boundaries all hold their calendar day", () => {
    for (const [iso, parts] of [
      ["2026-08-16", [2026, 7, 16]],
      ["2026-01-01", [2026, 0, 1]],
      ["2026-12-31", [2026, 11, 31]],
      ["2026-03-08", [2026, 2, 8]],
      ["2026-11-01", [2026, 10, 1]],
    ] as Array<[string, number[]]>) {
      const expected = `Flight ${localShort(parts[0], parts[1], parts[2])}`;
      assert.equal(details(booking({ trip: singleDayTrip(iso) })).flight_verified, expected);
      assert.equal(details(booking({ agreed_travel_date: iso })).flight_verified, expected);
    }
  });
});

describe("states, ordering and progress are untouched by the date fix", () => {
  test("adding the trip's dates changes no milestone state", () => {
    for (const status of ["awaiting_handoff", "pending_payment", "payment_secured", "in_transit", "delivered", "cancelled"]) {
      assert.deepEqual(states(booking({ status, trip: singleDayTrip(FLIGHT_DAY) })), states(booking({ status })));
    }
  });

  test("stage order and reached index are unchanged", () => {
    const a = computeJourney(parcel(), booking(), NOW);
    const b = computeJourney(parcel(), booking({ trip: singleDayTrip(FLIGHT_DAY) }), NOW);
    assert.equal(b.reachedIndex, a.reachedIndex);
    assert.equal(b.outcome, a.outcome);
    assert.deepEqual(b.stages.map((s) => s.key), STAGE_ORDER);
  });

  test("both perspectives read the same journey", () => {
    const base = { trip: singleDayTrip(FLIGHT_DAY) };
    const asCarrier = details(booking({ ...base, viewer_has_rated: false }));
    const asSender = details(booking({ ...base, viewer_has_rated: true }));
    for (const key of STAGE_ORDER) assert.equal(asCarrier[key], asSender[key]);
  });
});
