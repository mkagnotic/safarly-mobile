import { showToast } from "@/feedback/appFeedback";
import { getErrorMessage, type RNUploadFile } from "@/services/api";
import { listingFilesApi, type ListingFileKind } from "@/services/api/listingFiles";

/**
 * After a create: upload the optional files the form staged (26 Oct 2026).
 * A failure never undoes the listing - the files can be added from Edit.
 */
export async function uploadStagedListingFiles(kind: ListingFileKind, listingId: string, files: RNUploadFile[]): Promise<void> {
  if (!files.length) return;
  try {
    await listingFilesApi.add(kind, listingId, files);
  } catch (err) {
    showToast({
      title: "Saved, but the files could not be uploaded",
      message: `${getErrorMessage(err)} You can add them from Edit.`,
      variant: "warning",
    });
  }
}
