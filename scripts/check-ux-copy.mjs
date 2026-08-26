#!/usr/bin/env node
/**
 * Guard: the user-facing wording and layout that clients reported, and that were
 * fixed one at a time, must stay fixed.
 *
 * WHY THIS FILE EXISTS AT ALL.
 * Every fix below has a unit test — and almost none of those tests run in CI,
 * because this repo does not track new `*.test.*` files. So the protection lived
 * on one laptop. Anyone could reword a string or drop a Tailwind class and every
 * pipeline would stay green. `scripts/*.mjs` IS committed and DOES run, so the
 * invariants live here, next to `check-errors` and `check-sql`.
 *
 * WHAT IT CHECKS. Each entry pins a decision a client actually asked for, with the
 * reason attached, so a future edit that undoes one fails with the history rather
 * than a bare diff.
 *
 * Matching is whitespace-normalised, so reflowing JSX is fine — only the words
 * matter. Comments are stripped first: several of these files explain the OLD
 * wording in a comment ("They used to be `hidden sm:flex`…"), and a naive search
 * would match the explanation and report the bug as still present.
 *
 * This file is byte-identical in the web and mobile repos and works from either;
 * it runs only the checks belonging to the repo it finds itself in.
 *
 * Run: `npm run check:ux`
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const HERE = process.cwd();
const IS_WEB = existsSync(join(HERE, "supabase", "functions", "_shared", "errors.ts"));
const SELF = IS_WEB ? "web" : "mobile";

/**
 * Every pinned decision. `must` = these words have to be there; `mustNot` = the
 * wording or layout we deliberately moved away from.
 */
const CHECKS = [
  // ---------------------------------------------------------------- step 5 copy
  {
    repo: "web",
    file: "src/customer/pages/CustomerBookings.tsx",
    id: "step5-delivery-copy",
    why: "Client-approved step 5 wording. The sender receives and inspects the parcel, THEN hands the code to the carrier; the old copy told them to give it to a separate receiver and never to the carrier.",
    must: [
      "Your carrier has landed",
      "receive and inspect your parcel",
      "give it to the carrier",
      "both the users will be able to rate each other",
    ],
    mustNot: ["Never send the code to the carrier", "give it to whoever is receiving the parcel"],
  },
  {
    repo: "mobile",
    file: "src/features/bookings/BookingsScreen.tsx",
    id: "step5-delivery-copy",
    why: "Same step 5 wording as web - the two platforms must not drift.",
    must: [
      "Your carrier has landed",
      "receive and inspect your parcel",
      "give it to the carrier",
      "rate each other",
    ],
    mustNot: ["Step 2 (In transit) ends when your carrier reaches", "Never send the code to the carrier"],
  },

  // ------------------------------------------------------------- party labelling
  {
    repo: "web",
    file: "src/customer/pages/CustomerBookings.tsx",
    id: "party-label-receiver",
    why: "The parcel owner is labelled Receiver on the booking card. A booking has no separate receiver party, and this is the role that matters at delivery.",
    must: ['text-muted-foreground">Receiver<'],
    mustNot: ['text-muted-foreground">Sender<'],
  },
  {
    repo: "mobile",
    file: "src/features/bookings/BookingsScreen.tsx",
    id: "party-label-receiver",
    why: "Receiver label, kept in step with web.",
    must: ["styles.partyKey}>Receiver<"],
    mustNot: ["styles.partyKey}>Sender<"],
  },

  // ------------------------------------------------------------------ handoff pin
  {
    repo: "web",
    file: "src/customer/components/ChatHandoffPrompt.tsx",
    id: "handoff-pin-no-role-noun",
    why: "This title is carrier-only. 'your carrier' would be self-referential and 'your sender' clashes with the Receiver label, so it names no role at all.",
    must: ['title = "Tell them where to send the parcel"'],
    mustNot: ["Tell your sender where to send", "Tell your carrier where to send"],
  },
  {
    repo: "mobile",
    file: "src/features/messages/ChatWorkflowPin.tsx",
    id: "handoff-pin-no-role-noun",
    why: "Mobile's equivalent chat-pin blurb, kept in step with web.",
    must: ["tell them how the parcel reaches you"],
    mustNot: ["tell your sender how the parcel reaches you"],
  },

  // ----------------------------------------------------------- price prompt copy
  {
    repo: "web",
    file: "src/customer/components/ChatOfferPrompt.tsx",
    id: "price-sentence-names-the-role",
    why: "Names the ROLE, never the person. `${counterpartName} listed this delivery` was right for the carrier and wrong for the parcel owner, who was told the other party had set their own asking price.",
    must: ["Receiver listed this delivery at"],
    mustNot: ["${counterpartName} listed this delivery"],
  },
  {
    repo: "web",
    file: "src/customer/components/ChatOfferPrompt.tsx",
    id: "price-ctas",
    why: "Client-approved CTAs: Accept $X / Negotiate.",
    must: ["Accept {money(suggested)}", '"Negotiate"'],
    mustNot: ['"Different amount"', "Offer {money(suggested)}"],
  },
  {
    repo: "web",
    file: "src/customer/components/NewOfferDialog.tsx",
    id: "accept-intent-dialog",
    why: "Tapping 'Accept $X' opened a dialog titled 'Counter offer'. The accept intent gives it matching copy that still does not claim the deal is closed.",
    must: ['"Accept this price"', "intent", "The other party confirms it to lock the deal in"],
    mustNot: [],
  },

  // ------------------------------------------------------------- responsive CTAs
  {
    repo: "web",
    file: "src/customer/components/ChatOfferPrompt.tsx",
    id: "price-ctas-fit-every-width",
    why: "`.btn-action` is shrink-0 with a fixed px-5, so the two CTAs overran the row and the second was CLIPPED at 320/360/375/390px - iPhone 14/15 width. flex-wrap + flex-1 + a min width is what keeps both fully visible.",
    // Pins the row AND both buttons individually. Searching for the bare classes was
    // not enough: each appears twice, so reverting ONE button still found the other
    // one's copy and the check passed. Verified by reverting each in turn.
    must: [
      "flex flex-wrap gap-2 self-stretch sm:flex-nowrap",
      'className="btn-action-primary min-w-[8.5rem] flex-1 gap-1.5 whitespace-nowrap px-3 sm:flex-none sm:px-5"',
      '} min-w-[8.5rem] flex-1 gap-1.5 whitespace-nowrap px-3 sm:flex-none sm:px-5`',
    ],
    mustNot: [],
  },

  // --------------------------------------------------- the user's own email wraps
  {
    repo: "mobile",
    file: "src/features/profile/SecurityScreen.tsx",
    id: "security-row-subtitle-wraps",
    why: "At 320dp a single line ellipsised the user's own address ('mahesh.k+user1@agnotic.com') and 'Update the password you use to sign in'. Web truncates neither, so one line was also a parity gap.",
    must: ["styles.rowSubtitle} numberOfLines={2}"],
    mustNot: ["styles.rowSubtitle} numberOfLines={1}"],
  },
  {
    repo: "mobile",
    file: "src/features/profile/ChangeEmailScreen.tsx",
    id: "change-email-shows-full-address",
    why: "Showing the current address IS this screen's job; at 320dp it was ellipsised away. No numberOfLines at all here.",
    must: ["styles.emailText}>{email}"],
    mustNot: ["styles.emailText} numberOfLines={1}"],
  },

  // ------------------------------------------------------------ touch targets
  {
    repo: "mobile",
    file: "src/features/messages/ChatWorkflowPin.tsx",
    id: "handoff-pin-no-role-noun-blurb",
    why: "The set_handoff_plan blurb is carrier-only, so 'your carrier' would be self-referential and 'your sender' clashes with the Receiver label used elsewhere.",
    must: ["tell them how the parcel reaches you"],
    mustNot: ["tell your sender how the parcel reaches you"],
  },
  {
    repo: "mobile",
    file: "src/features/messages/MessagesScreen.tsx",
    id: "inbox-filter-chip-touch-target",
    why: "The Inbox filter chips paint 30dp tall — under the 44pt minimum — and unlike every neighbouring control carried no hitSlop at all. react-native-web does not implement hitSlop, so this cannot be caught by a browser probe; it has to be pinned in source.",
    must: ["hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}"],
    mustNot: [],
  },

  // ------------------------------------------------------- notification titles
  {
    repo: "web",
    file: "src/customer/pages/CustomerNotifications.tsx",
    id: "notification-title-wraps",
    why: "`truncate` is one line at ANY width, so on a phone the title lost the word carrying the meaning: 'Your parcel delivery is tomor…', 'Travel verification under revi…'. Two lines, matching the body. Fixed on BOTH platforms together so no parity gap is created.",
    must: ["text-sm text-foreground line-clamp-2"],
    mustNot: ["text-sm text-foreground truncate"],
  },
  {
    repo: "mobile",
    file: "src/features/tabs/NotificationsScreen.tsx",
    id: "notification-title-wraps",
    why: "Same as web: the title was capped at one line and lost its final word at 390dp.",
    must: ["styles.cardTitle} numberOfLines={2}"],
    mustNot: ["styles.cardTitle} numberOfLines={1}"],
  },

  // ---------------------------------------------------------- primary nav parity
  {
    repo: "mobile",
    file: "src/navigation/RootNavigator.tsx",
    id: "tab-order-matches-web",
    why: "Web's primary nav is Home, Search, My Travels, Inbox (CustomerNavbar NAV_LINKS). Mobile had the middle two transposed, so a user moving between the site and the app found them swapped. Order is positional: the Search screen (route name 'Trips') must come BEFORE the My-travels screen (route name 'Parcels').",
    must: [
      '<Tabs.Screen name="Trips" component={SearchScreen}',
      '<Tabs.Screen name="Parcels" component={MyTravelsScreen}',
    ],
    mustNot: [],
    // Positional rule the plain string checks cannot express.
    ordered: [
      '<Tabs.Screen name="Trips" component={SearchScreen}',
      '<Tabs.Screen name="Parcels" component={MyTravelsScreen}',
    ],
  },

  // ------------------------------------------------- journey progress step names
  {
    repo: "web",
    file: "src/customer/components/JourneyProgress.tsx",
    id: "journey-step-names-on-phone",
    why: "A phone showed six anonymous dashes and no step names. Six labels do not fit side by side below md, so they stack one per row instead of being dropped or truncated.",
    must: ["md:hidden", "md:flex", "JOURNEY_STEP[key].name"],
    mustNot: ["hidden sm:flex"],
  },
  {
    repo: "mobile",
    file: "src/features/bookings/JourneyProgress.tsx",
    id: "journey-step-names-on-phone",
    why: "Same as web: stacked rows, and no numberOfLines so a long name wraps instead of being ellipsised.",
    must: ["labelList", "JOURNEY_STEP[key].name"],
    mustNot: ["numberOfLines"],
  },
];

/** Remove comments so prose ABOUT the old wording is never mistaken for the code. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block and {/* JSX */} comments
    .replace(/^\s*\/\/.*$/gm, " "); // whole-line // comments
}

/** Collapse whitespace so reflowed JSX still matches. */
const norm = (s) => s.replace(/\s+/g, " ");

const failures = [];
let checked = 0;

for (const c of CHECKS) {
  if (c.repo !== SELF) continue;
  const path = join(HERE, c.file);
  if (!existsSync(path)) {
    failures.push(`${c.id}: ${c.file} is missing.\n      why: ${c.why}`);
    continue;
  }
  checked++;
  const code = norm(stripComments(readFileSync(path, "utf8")));

  for (const needle of c.must) {
    if (!code.includes(norm(needle))) {
      failures.push(
        `${c.id}  (${c.file})\n      MISSING: ${needle}\n      why: ${c.why}`,
      );
    }
  }
  for (const needle of c.mustNot) {
    if (code.includes(norm(needle))) {
      failures.push(
        `${c.id}  (${c.file})\n      REVERTED TO: ${needle}\n      why: ${c.why}`,
      );
    }
  }
  // `ordered` pins RELATIVE POSITION, which a contains-check cannot express —
  // the tab-order gap was two registrations in the wrong sequence, both present.
  if (c.ordered) {
    const at = c.ordered.map((n) => code.indexOf(norm(n)));
    for (let i = 1; i < at.length; i++) {
      if (at[i - 1] === -1 || at[i] === -1) break; // already reported by `must`
      if (at[i - 1] > at[i]) {
        failures.push(
          `${c.id}  (${c.file})\n      OUT OF ORDER: "${c.ordered[i - 1]}" must come BEFORE "${c.ordered[i]}"\n      why: ${c.why}`,
        );
      }
    }
  }
}

console.log(`check:ux [${SELF}] - ${checked} pinned decisions verified`);

if (failures.length > 0) {
  console.error("\nA client-reported fix has been undone:\n");
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(`check:ux [${SELF}] - every client-reported fix is still in place. OK`);
