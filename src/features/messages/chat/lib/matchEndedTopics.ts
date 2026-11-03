/**
 * Realtime topics to wake when a match ends - by the Unmatch button or
 * automatically on the final verification rejection (client, 3 Nov 2026). One
 * list so both paths refresh the same screens: the conversation reverts to
 * `pending`, the deal pin goes away, and the inbox, My Travels and bookings
 * pick up the reverted listing statuses.
 *
 * Pure (no React Native imports) so node:test can load it.
 */
export const MATCH_ENDED_TOPICS = [
  "conversations",
  "messages",
  "carrier-requests",
  "parcels",
  "trips",
  "bookings",
] as const;
