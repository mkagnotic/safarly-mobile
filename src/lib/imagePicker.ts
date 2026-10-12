import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

/**
 * Options every photo-library pick must spread in.
 *
 * iPhones store photos as HEIC. Without this, iOS's PHPicker hands back the
 * original `.heic` file (`image/heic`, `quality` ignored), which our KYC check,
 * the edge-function upload allowlists and the storage buckets all reject — and
 * which web browsers can't display. `Compatible` makes iOS transcode the pick to
 * JPEG. Android ignores the option.
 */
export const LIBRARY_PICK_OPTIONS = {
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
} satisfies ImagePicker.ImagePickerOptions;

const ANDROID_PICKER_ACCESS: ImagePicker.MediaLibraryPermissionResponse = {
  status: ImagePicker.PermissionStatus.GRANTED,
  granted: true,
  canAskAgain: true,
  expires: "never",
  accessPrivileges: "all",
};

/**
 * Permission check to run before `launchImageLibraryAsync`.
 *
 * Android's library pick goes through the system photo picker, which needs no
 * permission at all. Asking anyway is actively harmful on Android 10–12: below
 * API 33 expo-image-picker requests WRITE_EXTERNAL_STORAGE too, which our
 * manifest caps at API 28, so it can never be granted and the combined result
 * is never "granted" — every gallery pick (KYC ID included) was refused, with
 * an "Open Settings" hint pointing at a toggle that doesn't exist.
 */
export function requestLibraryPermission(): Promise<ImagePicker.MediaLibraryPermissionResponse> {
  if (Platform.OS === "android") return Promise.resolve(ANDROID_PICKER_ACCESS);
  return ImagePicker.requestMediaLibraryPermissionsAsync();
}
