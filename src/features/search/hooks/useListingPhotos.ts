import { useCallback, useEffect, useState } from "react";

import { listingFilesApi, type ListingFileKind } from "@/services/api/listingFiles";
import { createSharedFilesLoader, type SharedFiles } from "@/features/search/lib/listingPhotos";

/** One cache for the whole app: a listing seen on two tabs is fetched once. */
const loader = createSharedFilesLoader({
  fetchFiles: async (kind, id) => (await listingFilesApi.shared(kind, id)).data,
});

/**
 * A search listing's shared files. Fetches only while the row is mounted and
 * only when `count > 0` (rows behind a collapsed "+N more" are not mounted, so
 * they never fetch). `data` is null for "show nothing" - loading, none, 404 or
 * any error alike.
 */
export function useListingPhotos(kind: ListingFileKind, id: string, count: number) {
  const [data, setData] = useState<SharedFiles | null>(() => (count > 0 ? loader.peek(kind, id) ?? null : null));

  useEffect(() => {
    if (count <= 0) {
      setData(null);
      return;
    }
    let cancelled = false;
    void loader.load(kind, id).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, id, count]);

  /** Files with links that are still alive: refetches once their 600 s are up. */
  const ensureFresh = useCallback(async (): Promise<SharedFiles | null> => {
    const cached = loader.peek(kind, id);
    if (cached !== undefined) return cached;
    const next = await loader.load(kind, id, { force: true });
    setData(next);
    return next;
  }, [kind, id]);

  /** The cached answer while its links are still alive, else undefined. */
  const peekFresh = useCallback(() => loader.peek(kind, id), [kind, id]);

  return { data, ensureFresh, peekFresh };
}
