import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

/**
 * My Travels tab counts come from the server - one definition, both platforms.
 *
 * Found 2026-10-13: the labels were counted on the device from whatever had
 * loaded. Packages was the live rows of a 20-row page (staging user2: 851 live
 * parcels), Partners counted only your posts while web also counted requests
 * and connections, Archive used a delivered-bookings page capped at 50, and
 * posts whose date had passed were counted as active. The counts are now
 * `GET /user-handler/me/travel-counts` (fn_my_travel_counts), and the tab lists
 * use server filters that page through the same SQL.
 *
 * Web has the twin of this fence (src/test/myTravelCounts.test.ts).
 */

const read = (p: string) => readFileSync(p, "utf8");
const SCREEN = read("src/features/travels/MyTravelsScreen.tsx");
const DATA = read("src/features/travels/hooks/useMyTravelsData.ts");
const COUNTS = read("src/features/travels/lib/travelCounts.ts");

describe("My Travels tab counts", () => {
  test("reads the counts endpoint", () => {
    assert.match(COUNTS, /TRAVEL_COUNTS_PATH = "\/user-handler\/me\/travel-counts"/);
    assert.match(DATA, /useMyTravelCounts\(listSignature\)/);
  });

  test("every tab label is the server count, never a page length", () => {
    for (const key of ["flights", "packages", "partners", "archive"]) {
      assert.match(SCREEN, new RegExp(`count: counts\\?\\.${key} \\}`), key);
    }
    assert.doesNotMatch(SCREEN, /count: [^,}]*\.(length|total)/, "a tab count is derived from a list again");
  });

  test("lists use the server filters the counts are computed with", () => {
    for (const [key, filter] of [
      ["sending", "my_parcels_active"],
      ["delivering", "my_delivering_active"],
      ["pastPackages", "my_packages_past"],
      ["partnerPosts", "my_listings_active"],
      ["pastPartnerPosts", "my_listings_past"],
    ]) {
      assert.match(COUNTS, new RegExp(`${key}: "${filter}"`));
      assert.ok(DATA.includes(`MY_TRAVELS_FILTERS.${key}`), key);
    }
    assert.doesNotMatch(DATA, /filter: "my_(parcels|delivering|listings)"/);
    assert.doesNotMatch(DATA, /isTerminal\(/, "client-side filtering of a page is back");
  });

  test("everything the Archive counts can be reached in the Archive", () => {
    const archive = read("src/features/travels/components/ArchiveTab.tsx");
    assert.match(archive, /onLoadMoreDelivered/);
    assert.match(archive, /Past packages/);
    assert.match(archive, /Past buddy listings/);
  });
});

describe("public profile review count", () => {
  test("counts the reviews it shows (blocked reviewers excluded)", () => {
    const src = read("src/features/profile/PublicProfileScreen.tsx");
    assert.ok(src.includes("const hiddenOnPage = reviews.reviews.length - visibleReviews.length;"));
    assert.ok(src.includes("reviews.total - hiddenOnPage"));
  });
});

describe("search auto-match tab counts", () => {
  test("count distinct listings, not the sum of per-listing groups", () => {
    const src = read("src/features/search/hooks/useSearchPaging.ts");
    assert.match(src, /return countUniqueMatches\(carrierTripsByParcelId\)/);
    assert.match(src, /return countUniqueMatches\(receiverRequestsByTripId\)/);
    assert.doesNotMatch(src, /total \+= list\.length/);
    assert.match(src, /ids\.add\(m\.id\)/);
  });
});
