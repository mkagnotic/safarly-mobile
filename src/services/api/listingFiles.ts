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

export const listingFilesApi = {
  list: (kind: ListingFileKind, id: string) => api.get<ListingFilesResponse>(base(kind, id)),
  add: (kind: ListingFileKind, id: string, files: RNUploadFile[]) =>
    api.uploadRNFiles<ListingFilesResponse>(base(kind, id), files, "file"),
  remove: (kind: ListingFileKind, id: string, path: string) =>
    api.delete<ListingFilesResponse>(`${base(kind, id)}?path=${encodeURIComponent(path)}`),
};
