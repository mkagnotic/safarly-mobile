/**
 * Naming the deliveries inside one conversation, so a prompt can never be read as
 * belonging to the wrong one.
 *
 * A conversation is a thread between two PEOPLE; the deliveries inside it are
 * separate deals. The same pair can legitimately run several at once, and — this is
 * the case that broke — with OPPOSITE roles: Roja carries Viswanath's parcel on one
 * deal while Viswanath carries Roja's on another. Reported live as "the app is asking
 * for the travel document from Viswanath instead of Roja". It was not: the carrier
 * was being asked on the live deal, correctly. But the switcher labelled both deals
 * by route alone, both deals were Mumbai -> New York, so the two chips rendered a
 * character-for-character identical string and nothing on screen said which delivery
 * the prompt belonged to.
 *
 * ⚠️ ROUTE IS NOT AN IDENTIFIER. It is not unique, and it is not what distinguishes
 * two deals to the person reading. What distinguishes them is WHAT THE VIEWER IS
 * DOING in each - carrying, or receiving - which is also exactly the thing that was
 * being misread. So the role leads, and the route follows it.
 *
 * `labelDeals` guarantees every label in a thread is unique, by adding detail only
 * when it is needed to break a tie:
 *
 *   1. role + route            "Carrying · Mumbai → New York"
 *   2. + category              "Carrying · Mumbai → New York · clothing"
 *   3. + a short id            "Carrying · Mumbai → New York · clothing #a1b2"
 *
 * Step 3 is ugly on purpose and should be vanishingly rare - it means two deals agree
 * on role, route AND category. It exists because a label that is merely usually
 * unique is the bug this module is here to remove.
 *
 * Ported from `web app/safarly_web/src/lib/dealLabel.ts`. The two must stay in step:
 * a delivery that is called one thing on the phone and another on the web is the
 * same confusion this module exists to remove.
 */

export type DealRole = "carrier" | "sender";

/** The shape this module needs. Deliberately structural so both platforms' fuller
 *  `DealProjection` types satisfy it without importing each other's models. */
export interface LabellableDeal {
  active_deal: {
    carrier_request_id: string;
    viewer_role: DealRole;
    parcel?: {
      from_city?: string | null;
      to_city?: string | null;
      category?: string | null;
    } | null;
  };
}

export interface DealLabel {
  id: string;
  role: DealRole;
  /** What the VIEWER does in this deal. */
  roleWord: string;
  /** "Mumbai → New York (JFK)", or "Delivery" when the parcel is missing. */
  route: string;
  /** Unique within the thread. For the switcher chip. */
  chip: string;
  /** Unique within the thread, with the category spelled out. For the pinned action. */
  full: string;
}

/** Cities arrive as "Mumbai, MH" / "New York (JFK), NY" - the state adds nothing. */
function trimCity(value: string | null | undefined): string {
  return (value || "").split(",")[0].trim();
}

function routeOf(deal: LabellableDeal): string {
  const p = deal.active_deal.parcel;
  const from = trimCity(p?.from_city);
  const to = trimCity(p?.to_city);
  if (from && to) return `${from} → ${to}`;
  return to || from || "Delivery";
}

/**
 * "Carrying" / "Receiving" - the viewer's own side of this deal.
 *
 * `viewer_role: "sender"` is the PARCEL OWNER, whom this product calls the receiver
 * (the parcel is for them). "Sending" would be read as the opposite of what it means.
 */
export function roleWordFor(role: DealRole): string {
  return role === "carrier" ? "Carrying" : "Receiving";
}

/**
 * The shortest tail of `id` that no other colliding id shares.
 *
 * ⚠️ Was `id.slice(0, 4)` - the HEAD - and two ids sharing a prefix produced two
 * identical labels, which is precisely the failure this module exists to prevent.
 * Caught by a scenario run, not by the unit tests, because the test ids happened to
 * differ in their first characters.
 *
 * The tail of a UUID v4 is random, and growing it until it is unique terminates
 * because the ids themselves are unique.
 */
function uniqueTail(id: string, others: readonly string[]): string {
  for (let n = 4; n <= id.length; n += 1) {
    const tail = id.slice(-n);
    if (!others.some((o) => o !== id && o.slice(-n) === tail)) return tail;
  }
  return id;
}

/** Title-case a raw category ("clothing" -> "Clothing"); blank stays blank. */
function prettyCategory(value: string | null | undefined): string {
  const v = (value || "").trim();
  if (!v) return "";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/**
 * A unique label for every deal in one thread.
 *
 * Pure and order-independent: two deals that need a tiebreak both get one, so the
 * labels do not depend on which happened to be listed first.
 */
export function labelDeals(deals: readonly LabellableDeal[]): Map<string, DealLabel> {
  const out = new Map<string, DealLabel>();
  if (!deals || deals.length === 0) return out;

  const base = deals.map((d) => {
    const role = d.active_deal.viewer_role;
    const roleWord = roleWordFor(role);
    const route = routeOf(d);
    return {
      id: d.active_deal.carrier_request_id,
      role,
      roleWord,
      route,
      category: prettyCategory(d.active_deal.parcel?.category),
      level1: `${roleWord} · ${route}`,
    };
  });

  const count = (key: string, pick: (b: (typeof base)[number]) => string) =>
    base.filter((b) => pick(b) === key).length;

  for (const b of base) {
    // Only spend detail where it buys uniqueness.
    let chip = b.level1;
    if (count(b.level1, (x) => x.level1) > 1) {
      const level2 = b.category ? `${b.level1} · ${b.category}` : b.level1;
      chip = level2;
      const stillClashes =
        base.filter((x) => (x.category ? `${x.level1} · ${x.category}` : x.level1) === level2)
          .length > 1;
      // Two deals identical on role, route AND category: fall back to something that
      // cannot collide. Short, but it is the id, so it is always distinct.
      if (stillClashes) {
        const clashingIds = base
          .filter((x) => (x.category ? `${x.level1} · ${x.category}` : x.level1) === level2)
          .map((x) => x.id);
        chip = `${level2} #${uniqueTail(b.id, clashingIds)}`;
      }
    }

    // The pinned line always names the category when there is one - it is the cheapest
    // way to tell two deliveries apart and there is room for it there.
    let full = b.category ? `${b.level1} · ${b.category}` : b.level1;
    if (chip.includes("#")) full = `${full} #${chip.slice(chip.lastIndexOf("#") + 1)}`;

    out.set(b.id, { id: b.id, role: b.role, roleWord: b.roleWord, route: b.route, chip, full });
  }

  return out;
}

/**
 * A finished delivery is not a place to act, so it is not one of the deliveries the
 * chat is offering to switch between.
 *
 * ⚠️ Lives HERE, not in the switcher, because two places decide whether a thread has
 * "more than one delivery": the switcher (which filters finished ones) and the pinned
 * context line (which did not). A cancelled deal beside a live one therefore hid the
 * switcher but still printed "This step is for ..." - one control saying there is a
 * choice to make while the control that offers the choice is absent. Found by
 * scenario H on mobile.
 *
 * COMPLETED is deliberately NOT finished: a delivered deal still has a last step -
 * rating the other party - so hiding it would strand that action.
 */
export function isDealFinished(deal: {
  active_deal: { request_status?: string | null };
  workflow?: { state?: string | null } | null;
}): boolean {
  const rs = deal.active_deal.request_status;
  if (rs === "rejected" || rs === "withdrawn") return true;
  const state = deal.workflow?.state;
  return state === "CANCELLED" || state === "ARCHIVED";
}

/**
 * The deliveries a thread is actually offering to switch between: everything still
 * live, plus whichever one is on screen (removing the chip you just tapped would
 * leave the switcher pointing at nothing).
 */
export function selectableDeals<T extends {
  active_deal: { carrier_request_id: string; request_status?: string | null };
  workflow?: { state?: string | null } | null;
}>(deals: readonly T[], selectedId: string | null | undefined): T[] {
  return (deals ?? []).filter(
    (d) => !isDealFinished(d) || d.active_deal.carrier_request_id === selectedId,
  );
}

/** The label for one deal, when the caller has already built the map. */
export function labelFor(
  labels: Map<string, DealLabel>,
  dealId: string | null | undefined,
): DealLabel | null {
  if (!dealId) return null;
  return labels.get(dealId) ?? null;
}
