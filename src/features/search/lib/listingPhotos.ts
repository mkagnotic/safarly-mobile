import type { ListingFileKind, SharedListingFile, SharedListingFilesResponse } from "@/services/api/listingFiles";

/**
 * Listing photos in search (2 Nov 2026): the owner's optional files on a trip
 * (travel document) or parcel (photos or documents), shown to the people who
 * match that listing. DISPLAY ONLY - every failure renders nothing and search
 * keeps working. Same words and rules as web.
 *
 * Kept free of app runtime imports so the node test runner can exercise it.
 */

/** Thumbnails shown in a strip before the "+N" tile. */
export const STRIP_MAX_THUMBS = 3;

/**
 * Signed URLs live 600 s; treat them as stale a minute early so a viewer opened
 * near the end of their life refetches instead of showing broken images.
 */
export const SHARED_FILES_TTL_MS = 540_000;

/** At most this many shared-files requests at once - search fires its own burst. */
export const SHARED_FILES_CONCURRENCY = 2;

/** `photo_count` from the search row; missing (older backend) or bad = 0. */
export function photoCount(listing: { photo_count?: number | null } | null | undefined): number {
  const n = listing?.photo_count;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** The search row's `type` -> which handler owns its files. */
export function listingKindOf(type: "carrier_trip" | "receive_request"): ListingFileKind {
  return type === "carrier_trip" ? "trip" : "parcel";
}

/** Up to 3 thumbnails, and how many more sit behind the "+N" tile. */
export function stripTiles<T>(files: readonly T[]): { shown: T[]; extra: number } {
  const shown = files.slice(0, STRIP_MAX_THUMBS);
  return { shown, extra: Math.max(0, files.length - shown.length) };
}

export function routeLabel(listing: { from_city: string; to_city: string }): string {
  return `${listing.from_city} → ${listing.to_city}`;
}

/** "Photo 1 of 3 for Delhi → New York" (a PDF says "Document"). */
export function fileA11yLabel(
  file: Pick<SharedListingFile, "kind">,
  index: number,
  total: number,
  listing: { from_city: string; to_city: string },
): string {
  const noun = file.kind === "pdf" ? "Document" : "Photo";
  return `${noun} ${index + 1} of ${total} for ${routeLabel(listing)}`;
}

/** "+2" tile: "2 more photos for Delhi → New York". */
export function moreTileA11yLabel(extra: number, listing: { from_city: string; to_city: string }): string {
  return `${extra} more ${extra === 1 ? "photo" : "photos"} for ${routeLabel(listing)}`;
}

/** Viewer header: "Delhi → New York · Nov 20, 2026" (no date: the route alone). */
export function viewerTitle(
  listing: { from_city: string; to_city: string; date: string | null },
  formatDate: (iso: string) => string,
): string {
  const date = listing.date ? formatDate(listing.date) : "";
  return date ? `${routeLabel(listing)} · ${date}` : routeLabel(listing);
}

/** Viewer counter: "2 / 5". */
export function viewerCounter(index: number, total: number): string {
  return `${index + 1} / ${total}`;
}

/** The page a horizontal pager rests on, clamped to the files it has. */
export function pageForOffset(offsetX: number, pageWidth: number, total: number): number {
  if (pageWidth <= 0 || total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, Math.round(offsetX / pageWidth)));
}

/** Only well-formed files with a link; an unknown kind is never guessed at. */
export function usableFiles(files: unknown): SharedListingFile[] {
  if (!Array.isArray(files)) return [];
  return files.filter(
    (f): f is SharedListingFile =>
      !!f &&
      typeof f === "object" &&
      typeof (f as SharedListingFile).url === "string" &&
      (f as SharedListingFile).url.length > 0 &&
      ((f as SharedListingFile).kind === "image" || (f as SharedListingFile).kind === "pdf"),
  );
}

export type SharedFiles = SharedListingFilesResponse;

type Entry = { data: SharedFiles | null; at: number };

export interface SharedFilesLoader {
  /** Resolves to the files, or null for "show nothing" (404, error, none). Never rejects. */
  load(kind: ListingFileKind, id: string, opts?: { force?: boolean }): Promise<SharedFiles | null>;
  /** A cached answer still inside its URL lifetime, else undefined. */
  peek(kind: ListingFileKind, id: string): SharedFiles | null | undefined;
  clear(): void;
}

/**
 * Per-listing cache + request queue. A listing is fetched once per URL lifetime,
 * however many times its row re-renders; at most `concurrency` requests run at
 * once; a failure is cached as "nothing" for the same lifetime so a 404 is not
 * retried on every scroll.
 */
export function createSharedFilesLoader({
  fetchFiles,
  now = () => Date.now(),
  ttlMs = SHARED_FILES_TTL_MS,
  concurrency = SHARED_FILES_CONCURRENCY,
}: {
  fetchFiles: (kind: ListingFileKind, id: string) => Promise<SharedFiles | null | undefined>;
  now?: () => number;
  ttlMs?: number;
  concurrency?: number;
}): SharedFilesLoader {
  const cache = new Map<string, Entry>();
  const inFlight = new Map<string, Promise<SharedFiles | null>>();
  const queue: Array<() => void> = [];
  let running = 0;

  const pump = () => {
    while (running < concurrency && queue.length > 0) {
      running += 1;
      queue.shift()!();
    }
  };

  const fresh = (key: string): Entry | undefined => {
    const e = cache.get(key);
    return e && now() - e.at < ttlMs ? e : undefined;
  };

  return {
    peek(kind, id) {
      return fresh(`${kind}:${id}`)?.data;
    },
    load(kind, id, opts) {
      const key = `${kind}:${id}`;
      if (!opts?.force) {
        const hit = fresh(key);
        if (hit) return Promise.resolve(hit.data);
      }
      const pending = inFlight.get(key);
      if (pending) return pending;
      const p = new Promise<SharedFiles | null>((resolve) => {
        queue.push(() => {
          let result: SharedFiles | null = null;
          Promise.resolve()
            .then(() => fetchFiles(kind, id))
            .then((data) => {
              const files = usableFiles(data?.files);
              result = data && files.length > 0 ? { ...data, files } : null;
            })
            .catch(() => {
              result = null;
            })
            .finally(() => {
              cache.set(key, { data: result, at: now() });
              inFlight.delete(key);
              running -= 1;
              resolve(result);
              pump();
            });
        });
      });
      inFlight.set(key, p);
      pump();
      return p;
    },
    clear() {
      cache.clear();
    },
  };
}
