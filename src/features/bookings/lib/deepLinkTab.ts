const TAB_INDEX: Record<string, number> = { active: 1, delivered: 2, cancelled: 3 };

/**
 * May a booking opened by link be pinned on the selected tab? (client, 4 Nov 2026:
 * a booking declined at handover stayed pinned under "Active".) Pinned only on a
 * tab it belongs to, never by forcing the tab. Same rule as web
 * (bookingsListRules.ts deepLinkBelongsOnTab); an older backend without `tab`
 * keeps the old behaviour.
 */
export function deepLinkBelongsOnTab(booking: { tab?: string | null }, filterIdx: number): boolean {
  if (filterIdx === 0 || !booking.tab) return true;
  return TAB_INDEX[booking.tab] === filterIdx;
}
