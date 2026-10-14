/**
 * Core of the session storage (pure; no React Native imports, so it is
 * unit-testable under `node --test`). Device wiring: secureStorage.ts.
 *
 * Where the Supabase session lives on the device: the platform keystore
 * (Android Keystore / iOS Keychain) via expo-secure-store, not AsyncStorage.
 *
 * Why: AsyncStorage is a plain SQLite file on Android and a plain file on iOS.
 * The refresh token in it was readable on a rooted device and was copied into
 * device backups. SecureStore encrypts with a key that never leaves the
 * device's keystore, and `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` keeps it out of
 * iCloud backups and device-to-device transfers.
 *
 * Three things this has to get right:
 *
 * 1. SIZE. A session (access + refresh token + user) is 2-4 KB; SecureStore
 *    warns above ~2 KB per value and some Android keystores refuse more. So a
 *    value is split into chunks under that limit.
 *
 * 2. TORN WRITES. Overwriting chunks in place and dying half-way would leave
 *    a corrupt session, which supabase-js reads as "signed out". So each write
 *    goes to the OTHER of two slots, and only then is the pointer flipped. A
 *    crash before the flip leaves the old session intact; after it, the new one.
 *
 * 3. NOBODY GETS LOGGED OUT BY THE UPDATE. Builds before this one kept the
 *    session in AsyncStorage. The first read that finds nothing in SecureStore
 *    copies the AsyncStorage value across, reads it back to confirm, and only
 *    then deletes the old copy. If SecureStore itself is unavailable or fails,
 *    the adapter falls back to AsyncStorage rather than lose the session: a
 *    session in the old place is better than a signed-out user.
 *
 * The spurious-logout protections are unaffected: they decide WHEN a session is
 * removed (authFetch.ts, AuthContext); this only changes WHERE it is kept.
 */

/** Characters per chunk: under SecureStore's ~2048-byte comfort limit, with room for UTF-8. */
export const CHUNK_CHARS = 1800;

/** Options passed to every keystore call (accessibility class on iOS). */
export type StoreOptions = Record<string, unknown>;
let OPTIONS: StoreOptions = {};
/** Set once by the device wiring (secureStorage.ts). */
export function setStoreOptions(options: StoreOptions) { OPTIONS = options; }

/** SecureStore keys may only contain [A-Za-z0-9._-]. */
const base = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");
const metaKey = (key: string) => `${base(key)}.meta`;
const chunkKey = (key: string, slot: Slot, i: number) => `${base(key)}.${slot}${i}`;

type Slot = "a" | "b";
interface Meta { slot: Slot; count: number }

/** The minimal store surface, so tests can supply an in-memory fake. */
export interface KeyValueStore {
  getItemAsync(key: string, options?: StoreOptions): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: StoreOptions): Promise<void>;
  deleteItemAsync(key: string, options?: StoreOptions): Promise<void>;
}
export interface LegacyStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function splitIntoChunks(value: string, size = CHUNK_CHARS): string[] {
  if (value.length === 0) return [""];
  const out: string[] = [];
  for (let i = 0; i < value.length; i += size) out.push(value.slice(i, i + size));
  return out;
}

function parseMeta(raw: string | null): Meta | null {
  if (!raw) return null;
  const [slot, n] = raw.split(":");
  const count = Number(n);
  if ((slot !== "a" && slot !== "b") || !Number.isInteger(count) || count < 1 || count > 64) return null;
  return { slot, count };
}

async function deleteSlot(store: KeyValueStore, key: string, slot: Slot, from: number, to: number) {
  for (let i = from; i < to; i++) {
    await store.deleteItemAsync(chunkKey(key, slot, i), OPTIONS).catch(() => undefined);
  }
}

export async function readChunked(store: KeyValueStore, key: string): Promise<string | null> {
  const meta = parseMeta(await store.getItemAsync(metaKey(key), OPTIONS));
  if (!meta) return null;
  const parts: string[] = [];
  for (let i = 0; i < meta.count; i++) {
    const part = await store.getItemAsync(chunkKey(key, meta.slot, i), OPTIONS);
    if (part == null) return null; // incomplete: treat as absent, never as garbage
    parts.push(part);
  }
  return parts.join("");
}

export async function writeChunked(store: KeyValueStore, key: string, value: string): Promise<void> {
  const current = parseMeta(await store.getItemAsync(metaKey(key), OPTIONS));
  const slot: Slot = current?.slot === "a" ? "b" : "a";
  const chunks = splitIntoChunks(value);
  for (let i = 0; i < chunks.length; i++) {
    await store.setItemAsync(chunkKey(key, slot, i), chunks[i], OPTIONS);
  }
  // The commit point: until this lands, readers still see the previous value.
  await store.setItemAsync(metaKey(key), `${slot}:${chunks.length}`, OPTIONS);
  if (current) await deleteSlot(store, key, current.slot, 0, current.count);
}

export async function removeChunked(store: KeyValueStore, key: string): Promise<void> {
  const current = parseMeta(await store.getItemAsync(metaKey(key), OPTIONS));
  await store.deleteItemAsync(metaKey(key), OPTIONS);
  if (current) await deleteSlot(store, key, current.slot, 0, current.count);
}

/**
 * A supabase-js storage adapter over a keystore, migrating from (and falling
 * back to) the legacy AsyncStorage location. Factory form so it can be tested.
 */
export function createSecureSessionStorage(store: KeyValueStore, legacy: LegacyStore) {
  return {
    async getItem(key: string): Promise<string | null> {
      let secure: string | null;
      try {
        secure = await readChunked(store, key);
      } catch {
        return legacy.getItem(key); // keystore unavailable: keep working from the old place
      }
      if (secure != null) return secure;

      const old = await legacy.getItem(key);
      if (old == null) return null;
      // One-time migration. The old copy is removed only once the new one is
      // proven readable, so a failure at any step leaves the user signed in.
      try {
        await writeChunked(store, key, old);
        if ((await readChunked(store, key)) === old) await legacy.removeItem(key);
      } catch {
        /* stay on the legacy copy; the next launch tries again */
      }
      return old;
    },

    async setItem(key: string, value: string): Promise<void> {
      try {
        await writeChunked(store, key, value);
        // A stale legacy copy must never shadow a newer secure one.
        await legacy.removeItem(key).catch(() => undefined);
      } catch {
        // Keep the NEW value, and make sure an older secure copy can't shadow
        // it: refresh tokens rotate, so reading a stale one back would fail
        // the next refresh and sign the user out.
        await legacy.setItem(key, value);
        await removeChunked(store, key).catch(() => undefined);
      }
    },

    async removeItem(key: string): Promise<void> {
      // Both places: a sign-out must leave no session anywhere on the device.
      await Promise.allSettled([removeChunked(store, key), legacy.removeItem(key)]);
    },
  };
}
