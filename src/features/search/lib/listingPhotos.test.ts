import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createSharedFilesLoader,
  fileA11yLabel,
  listingKindOf,
  moreTileA11yLabel,
  pageForOffset,
  photoCount,
  SHARED_FILES_TTL_MS,
  stripTiles,
  usableFiles,
  viewerCounter,
  viewerTitle,
} from "./listingPhotos.ts";

// Listing photos in search (2 Nov 2026). DISPLAY ONLY: a listing without photos
// never fetches, any failure renders nothing, and each request shows ONLY its
// own photos. Same words and rules as web.

const read = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");
const img = (n: number) => ({ url: `https://x/${n}.jpg`, name: `${n}.jpg`, kind: "image" as const });
const pdf = (n: number) => ({ url: `https://x/${n}.pdf`, name: `${n}.pdf`, kind: "pdf" as const });
const reply = (id: string, files: unknown[]) => ({
  files: files as never,
  listing: { id, from_city: "Delhi", to_city: "New York", date: "2026-11-20" },
});
const route = { from_city: "Delhi", to_city: "New York" };
const flush = () => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------- photo_count

test("photo_count missing (older backend), zero or junk reads as 0", () => {
  assert.equal(photoCount({}), 0);
  assert.equal(photoCount(undefined), 0);
  assert.equal(photoCount({ photo_count: undefined }), 0);
  assert.equal(photoCount({ photo_count: null }), 0);
  assert.equal(photoCount({ photo_count: 0 }), 0);
  assert.equal(photoCount({ photo_count: -2 }), 0);
  assert.equal(photoCount({ photo_count: Number.NaN }), 0);
  assert.equal(photoCount({ photo_count: "3" as never }), 0);
  assert.equal(photoCount({ photo_count: 3 }), 3);
});

test("the strip returns before any hook - no photo_count, no fetch", () => {
  const src = read("features/search/components/ListingPhotoStrip.tsx");
  const outer = src.slice(src.indexOf("export function ListingPhotoStrip"), src.indexOf("function StripInner"));
  assert.match(outer, /if \(count === 0\) return null;/);
  assert.doesNotMatch(outer, /useListingPhotos|useEffect|useState/);
  const hook = read("features/search/hooks/useListingPhotos.ts");
  assert.match(hook, /if \(count <= 0\) \{/);
});

test("a trip row reads trip-handler, a parcel row parcel-handler", () => {
  assert.equal(listingKindOf("carrier_trip"), "trip");
  assert.equal(listingKindOf("receive_request"), "parcel");
  const api = read("services/api/listingFiles.ts");
  assert.match(api, /\$\{kind === "trip" \? "trip-handler" : "parcel-handler"\}\/\$\{id\}\/shared-files/);
});

// ---------------------------------------------------------------- loader

test("404 / any error / empty list resolves to null (render nothing), never rejects", async () => {
  const err404 = Object.assign(new Error("Not found"), { status: 404 });
  const loader = createSharedFilesLoader({
    fetchFiles: async (_k, id) => {
      if (id === "gone") throw err404;
      if (id === "boom") throw new Error("network");
      if (id === "empty") return reply(id, []);
      if (id === "junk") return reply(id, [{ url: "", kind: "image" }, { url: "u", kind: "video" }, null]);
      if (id === "nodata") return undefined;
      return reply(id, [img(1)]);
    },
  });
  for (const id of ["gone", "boom", "empty", "junk", "nodata"]) {
    assert.equal(await loader.load("trip", id), null, id);
  }
  assert.equal((await loader.load("trip", "ok"))?.files.length, 1);
});

test("a failure is cached for the URL lifetime: no retry storm on re-render", async () => {
  let calls = 0;
  const loader = createSharedFilesLoader({
    fetchFiles: async () => {
      calls += 1;
      throw new Error("404");
    },
  });
  await loader.load("parcel", "p1");
  await loader.load("parcel", "p1");
  assert.equal(calls, 1);
  assert.equal(loader.peek("parcel", "p1"), null);
});

test("per-listing isolation: each listing gets only its own files", async () => {
  const asked: string[] = [];
  const loader = createSharedFilesLoader({
    fetchFiles: async (kind, id) => {
      asked.push(`${kind}:${id}`);
      return reply(id, id === "a" ? [img(1), img(2)] : [pdf(9)]);
    },
  });
  const [a, b, c] = await Promise.all([loader.load("trip", "a"), loader.load("trip", "b"), loader.load("parcel", "a")]);
  assert.deepEqual(asked.sort(), ["parcel:a", "trip:a", "trip:b"]);
  assert.deepEqual(a?.files.map((f) => f.name), ["1.jpg", "2.jpg"]);
  assert.deepEqual(b?.files.map((f) => f.name), ["9.pdf"]);
  // Same id on the other kind is a different listing - never shares a cache entry.
  assert.deepEqual(c?.files.map((f) => f.name), ["1.jpg", "2.jpg"]);
  assert.equal(loader.peek("trip", "b")?.listing.id, "b");
});

test("one fetch per listing however many rows ask at once", async () => {
  let calls = 0;
  const loader = createSharedFilesLoader({
    fetchFiles: async (_k, id) => {
      calls += 1;
      return reply(id, [img(1)]);
    },
  });
  await Promise.all([loader.load("trip", "t"), loader.load("trip", "t"), loader.load("trip", "t")]);
  await loader.load("trip", "t");
  assert.equal(calls, 1);
});

test("at most 2 requests in flight - search keeps its own burst", async () => {
  let running = 0;
  let peak = 0;
  const loader = createSharedFilesLoader({
    fetchFiles: async (_k, id) => {
      running += 1;
      peak = Math.max(peak, running);
      await flush();
      running -= 1;
      return reply(id, [img(1)]);
    },
  });
  const all = await Promise.all(["1", "2", "3", "4", "5"].map((id) => loader.load("parcel", id)));
  assert.equal(peak, 2);
  assert.equal(all.filter(Boolean).length, 5);
});

test("signed links expire: reopening after the lifetime refetches", async () => {
  let t = 1_000;
  let calls = 0;
  const loader = createSharedFilesLoader({
    now: () => t,
    fetchFiles: async (_k, id) => {
      calls += 1;
      return reply(id, [img(calls)]);
    },
  });
  await loader.load("trip", "t");
  t += SHARED_FILES_TTL_MS - 1;
  assert.ok(loader.peek("trip", "t"));
  t += 1;
  assert.equal(loader.peek("trip", "t"), undefined, "stale links are never handed out");
  const again = await loader.load("trip", "t");
  assert.equal(calls, 2);
  assert.equal(again?.files[0].name, "2.jpg");
  // Lifetime is under the server's 600 s.
  assert.ok(SHARED_FILES_TTL_MS < 600_000);
  // force refetches even while fresh
  await loader.load("trip", "t", { force: true });
  assert.equal(calls, 3);
});

test("usableFiles keeps only image/pdf files with a link", () => {
  assert.deepEqual(usableFiles(null), []);
  assert.deepEqual(usableFiles([img(1), { url: "x", kind: "doc" }, pdf(2)]).map((f) => f.kind), ["image", "pdf"]);
});

// ---------------------------------------------------------------- strip + viewer

test("strip: up to 3 thumbnails, the rest behind +N", () => {
  assert.deepEqual(stripTiles([1]), { shown: [1], extra: 0 });
  assert.deepEqual(stripTiles([1, 2, 3]), { shown: [1, 2, 3], extra: 0 });
  assert.deepEqual(stripTiles([1, 2, 3, 4, 5]), { shown: [1, 2, 3], extra: 2 });
});

test("accessibility labels name the photo, its position and the listing", () => {
  assert.equal(fileA11yLabel(img(1), 0, 3, route), "Photo 1 of 3 for Delhi → New York");
  assert.equal(fileA11yLabel(pdf(1), 2, 3, route), "Document 3 of 3 for Delhi → New York");
  assert.equal(moreTileA11yLabel(2, route), "2 more photos for Delhi → New York");
  assert.equal(moreTileA11yLabel(1, route), "1 more photo for Delhi → New York");
});

test("viewer header and counter", () => {
  const fmt = (iso: string) => `D(${iso})`;
  assert.equal(viewerTitle({ ...route, date: "2026-11-20" }, fmt), "Delhi → New York · D(2026-11-20)");
  assert.equal(viewerTitle({ ...route, date: null }, fmt), "Delhi → New York");
  assert.equal(viewerCounter(1, 5), "2 / 5");
});

test("viewer paging lands on whole pages and never past the ends", () => {
  assert.equal(pageForOffset(0, 360, 5), 0);
  assert.equal(pageForOffset(360, 360, 5), 1);
  assert.equal(pageForOffset(530, 360, 5), 1);
  assert.equal(pageForOffset(550, 360, 5), 2);
  assert.equal(pageForOffset(99_999, 360, 5), 4);
  assert.equal(pageForOffset(-50, 360, 5), 0);
  assert.equal(pageForOffset(100, 0, 5), 0);
  assert.equal(pageForOffset(100, 360, 0), 0);
});

test("viewer: swipe paging, counter, close, Report, PDF opens externally", () => {
  const src = read("features/search/components/ListingPhotoViewer.tsx");
  assert.match(src, /horizontal\s+pagingEnabled/);
  assert.match(src, /onMomentumScrollEnd=\{onMomentumEnd\}/);
  assert.match(src, /viewerCounter\(index, total\)/);
  assert.match(src, /accessibilityLabel="Close"/);
  assert.match(src, />Report</);
  assert.match(src, /Linking\.openURL\(item\.url\)\.catch\(\(\) => undefined\)/);
});

test("display only: no toast or error state anywhere in the photo code", () => {
  for (const rel of [
    "features/search/components/ListingPhotoStrip.tsx",
    "features/search/components/ListingPhotoViewer.tsx",
    "features/search/hooks/useListingPhotos.ts",
    "features/search/lib/listingPhotos.ts",
  ]) {
    const src = read(rel);
    assert.doesNotMatch(src, /showToast|ErrorState|Alert\./, rel);
  }
});

test("every request shows its own strip: the card's listing AND each +N more row", () => {
  const src = read("features/search/components/PackageMatchCard.tsx");
  assert.match(src, /<ListingPhotoStrip listing=\{match\}/);
  assert.match(src, /photos=\{<ListingPhotoStrip listing=\{o\}/);
  // Both card layouts place it.
  assert.equal(src.split("{photosBlock}").length - 1, 2);
  // Rows behind a collapsed "+N more" are not mounted, so they never fetch.
  const more = read("features/search/components/MoreListings.tsx");
  assert.match(more, /\{open \? \(/);
});

// ---------------------------------------------------------------- form hint

const HINT = "Photos you add here are shown to people who match this request in search.";

test("the files field tells owners search shows their photos", () => {
  assert.ok(read("components/listing/ListingFilesField.tsx").includes(HINT));
});

for (const rel of [
  "features/trips/ListTripScreen.tsx",
  "features/trips/EditTripModal.tsx",
  "features/parcels/SendParcelScreen.tsx",
  "features/parcels/EditParcelModal.tsx",
]) {
  test(`${rel} renders the files field that carries the search hint`, () => {
    const src = read(rel);
    assert.match(src, /import \{ ListingFilesField \} from "@\/components\/listing\/ListingFilesField";/);
    assert.match(src, /<ListingFilesField\b/);
  });
}
