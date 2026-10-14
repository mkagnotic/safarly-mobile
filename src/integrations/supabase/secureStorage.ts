/**
 * The Supabase session storage the app uses: the device keystore via
 * expo-secure-store, migrating from (and falling back to) AsyncStorage.
 * Everything that matters is in secureStorageCore.ts, which is unit-tested.
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { createSecureSessionStorage, setStoreOptions } from "./secureStorageCore";

// AFTER_FIRST_UNLOCK: readable by background token refresh after the first
// unlock; THIS_DEVICE_ONLY: never in iCloud backups or device transfers.
setStoreOptions({ keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });

/** Web has no keystore (and Expo web is not shipped), so it keeps AsyncStorage. */
export const sessionStorage = Platform.OS === "web"
  ? AsyncStorage
  : createSecureSessionStorage(SecureStore, AsyncStorage);
