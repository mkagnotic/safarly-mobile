import { api } from "./client";
import type { RNUploadFile } from "./messages";

/**
 * A listing owner's optional files (client, 26 Oct 2026): the carrier's travel
 * document on a trip (up to 3), the sender's parcel photos or documents on a
 * parcel (up to 5). Owner-only, and separate from the deal's verification files.
 * Web parity: src/services/api/listingFiles.ts.
 */
export type ListingFileKind = "trip" | "parcel";

export interface ListingFile {
  path: string;
  url: string | null;
  name: string;
}

export interface ListingFilesResponse {
  files: ListingFile[];
  max_files: number;
}

const base = (kind: ListingFileKind, id: string) =>
  `/${kind === "trip" ? "trip-handler" : "parcel-handler"}/${id}/files`;

export const LISTING_FILES_MAX: Record<ListingFileKind, number> = { trip: 3, parcel: 5 };

/**
 * One of a listing's files as shown to someone who matches it in search
 * (read-only). The signed `url` lives 600 s.
 */
export interface SharedListingFile {
  url: string;
  name: string;
  kind: "image" | "pdf";
}

export interface SharedListingFilesResponse {
  files: SharedListingFile[];
  listing: { id: string; from_city: string; to_city: string; date: string | null };
}

export const listingFilesApi = {
  /** Another person's listing files, for search. 404 when the viewer may not see them. */
  shared: (kind: ListingFileKind, id: string) =>
    api.get<SharedListingFilesResponse>(
      `/${kind === "trip" ? "trip-handler" : "parcel-handler"}/${id}/shared-files`,
    ),
  list: (kind: ListingFileKind, id: string) => api.get<ListingFilesResponse>(base(kind, id)),
  add: (kind: ListingFileKind, id: string, files: RNUploadFile[]) =>
    api.uploadRNFiles<ListingFilesResponse>(base(kind, id), files, "file"),
  remove: (kind: ListingFileKind, id: string, path: string) =>
    api.delete<ListingFilesResponse>(`${base(kind, id)}?path=${encodeURIComponent(path)}`),
};
