// Sign in with Apple nonce (23 Oct 2026).
//
// Apple puts the SHA-256 of the nonce the app asked for into its identity token;
// Supabase hashes the RAW nonce it is given and requires the two to match. The
// app sent neither, so every iOS Apple sign-in was refused with "Passed nonce and
// nonce in id_token should either both exist or not" (production auth log) — no
// account was ever created. This is the flow Apple and Supabase document:
// a fresh random nonce per attempt, its hash to Apple, the raw value to Supabase.
//
// Pure and dependency-injected so it is testable off-device; the app wires in
// expo-crypto (see appleOAuth.ts).

export interface AppleNonce {
  /** Sent to Supabase with the identity token. */
  raw: string;
  /** Sent to Apple in the authorization request (lower-case hex SHA-256 of `raw`). */
  hashed: string;
}

export interface NonceDeps {
  /** Cryptographically secure random bytes. */
  randomBytes: (count: number) => Uint8Array;
  /** Lower-case hex SHA-256 of a UTF-8 string. */
  sha256Hex: (value: string) => Promise<string>;
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** A fresh nonce per sign-in attempt: 32 random bytes, hex-encoded. */
export async function makeAppleNonce(deps: NonceDeps): Promise<AppleNonce> {
  const raw = toHex(deps.randomBytes(32));
  const hashed = (await deps.sha256Hex(raw)).toLowerCase();
  return { raw, hashed };
}
