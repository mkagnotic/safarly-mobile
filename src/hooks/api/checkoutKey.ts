/**
 * One idempotency key per checkout SESSION.
 *
 * The confirm call is keyed so a retried confirm can't settle twice. The key
 * used to live for the whole screen: after a network error on confirm, the next
 * tap opened a NEW checkout session and confirmed it with the OLD key, so the
 * server could answer the new session with the stored result of the old one.
 * Web keys it per session_id (CustomerCheckout); this matches it.
 *
 * - same session_id → same key (a retry of the same confirm)
 * - new session_id  → new key
 * - `null` (confirm said "not paid") → the next attempt starts fresh
 */
export interface SessionKey {
  sessionId: string;
  key: string;
}

export function keyForSession(prev: SessionKey | null, sessionId: string, make: () => string): SessionKey {
  return prev && prev.sessionId === sessionId ? prev : { sessionId, key: make() };
}
