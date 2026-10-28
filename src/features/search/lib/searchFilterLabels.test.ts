import { test } from "node:test";
import assert from "node:assert/strict";

import {
  browsePageQuery,
  dateChipLabel,
  filterChipLabels,
  LOOKING_FOR_LABEL,
  pageRangeLabel,
} from "./searchFilterLabels.ts";

test("looking-for labels are words, sentence case", () => {
  assert.deepEqual(LOOKING_FOR_LABEL, {
    travel_buddy: "Travel buddy",
    carrier: "Carrier",
    receive_request: "Receiver requests",
  });
});

test("dateChipLabel: range, single day, crossing a year, nothing", () => {
  assert.equal(dateChipLabel("2026-11-01", "2026-11-18"), "Dates: 1 Nov – 18 Nov 2026");
  assert.equal(dateChipLabel("2026-11-01", "2026-11-01"), "Date: 1 Nov 2026");
  assert.equal(dateChipLabel("2026-11-01", ""), "Date: 1 Nov 2026");
  assert.equal(dateChipLabel(undefined, "2026-11-18"), "Date: 18 Nov 2026");
  assert.equal(dateChipLabel("2026-12-28", "2027-01-03"), "Dates: 28 Dec 2026 – 3 Jan 2027");
  assert.equal(dateChipLabel(undefined, undefined), null);
  assert.equal(dateChipLabel("bad", null), null);
});

test("filterChipLabels: words, not raw codes", () => {
  assert.deepEqual(
    filterChipLabels({
      from_city: "ANY",
      to_city: "Chicago",
      date_from: "2026-11-01",
      date_to: "2026-11-18",
      looking_for: "travel_buddy,receive_request,carrier",
    }),
    ["From: Any city", "To: Chicago", "Dates: 1 Nov – 18 Nov 2026", "Travel buddy", "Receiver requests", "Carrier"],
  );
  assert.deepEqual(filterChipLabels({ looking_for: "bogus" }), []);
});

test("browsePageQuery sends every list's page", () => {
  assert.deepEqual(browsePageQuery({ per_page: 10 }, { carrier: 3, receive: 1, buddy: 2 }), {
    per_page: 10,
    carrier_page: 3,
    receive_page: 1,
    buddy_page: 2,
  });
});

test("pageRangeLabel matches web PaginationControls", () => {
  assert.equal(pageRangeLabel(1, 10, 34), "Showing 1–10 of 34");
  assert.equal(pageRangeLabel(4, 10, 34, "carrier trips"), "Showing 31–34 of 34 carrier trips");
  assert.equal(pageRangeLabel(1, 10, 0), "Showing 0–0 of 0");
});
