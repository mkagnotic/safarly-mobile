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

import { readFileSync, existsSync, readdirSync } from "node:fs";
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
    file: "src/features/bookings/pages/CustomerBookings.tsx",
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
    file: "src/features/bookings/pages/CustomerBookings.tsx",
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
    file: "src/features/messages/components/ChatHandoffPrompt.tsx",
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
    file: "src/features/messages/components/ChatOfferPrompt.tsx",
    id: "price-sentence-names-the-role",
    why: "Names the ROLE, never the person. `${counterpartName} listed this delivery` was right for the carrier and wrong for the parcel owner, who was told the other party had set their own asking price.",
    must: ["Receiver listed this delivery at"],
    mustNot: ["${counterpartName} listed this delivery"],
  },
  {
    repo: "web",
    file: "src/features/messages/components/ChatOfferPrompt.tsx",
    id: "price-ctas",
    why: "Client-approved CTAs: Accept $X / Negotiate.",
    must: ["Accept {money(suggested)}", '"Negotiate"'],
    mustNot: ['"Different amount"', "Offer {money(suggested)}"],
  },
  {
    repo: "web",
    file: "src/features/messages/components/NewOfferDialog.tsx",
    id: "accept-intent-dialog",
    why: "Tapping 'Accept $X' opened a dialog titled 'Counter offer'. The accept intent gives it matching copy that still does not claim the deal is closed.",
    must: ['"Accept this price"', "intent", "The other party confirms it to lock the deal in"],
    mustNot: [],
  },

  // ------------------------------------------------------------- responsive CTAs
  {
    repo: "web",
    file: "src/features/messages/components/ChatOfferPrompt.tsx",
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
    file: "src/features/notifications/pages/CustomerNotifications.tsx",
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
    file: "src/features/bookings/components/JourneyProgress.tsx",
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
  // ------------------------------------------------- sign-in anti-enumeration
  {
    repo: "web",
    file: "src/features/auth/components/RoleLogin.tsx",
    id: "signin-no-user-enumeration",
    why: "A distinct 'No account found with this email' reply turned the sign-in form into an account enumeration oracle: anyone with a list of addresses could learn which are registered. One message now covers a wrong password, an unknown address and a Google-only account.",
    must: ["SIGN_IN_FAILED_MESSAGE", "Incorrect email or password"],
    mustNot: ["No account found with this email", "This account uses Google sign-in"],
  },
  {
    repo: "mobile",
    file: "src/features/auth/LoginScreen.tsx",
    id: "signin-no-user-enumeration",
    why: "Same anti-enumeration rule as web - the two platforms must not drift.",
    must: ["SIGN_IN_FAILED_MESSAGE", "Incorrect email or password"],
    mustNot: ["No account found with this email", "This account uses Google sign-in"],
  },

  // ------------------------------------------- carriers, not senders, are missing
  {
    repo: "web",
    file: "src/features/search/lib/constants.ts",
    id: "empty-state-names-carriers",
    why: "Shown under a card for a parcel the user is SENDING, so the missing party is a CARRIER. It read 'No matched senders yet', naming the opposite side of the deal.",
    must: ["No matching carriers yet for this route or date."],
    mustNot: ["No matched senders"],
  },
  {
    repo: "mobile",
    file: "src/features/search/SearchScreen.tsx",
    id: "empty-state-names-carriers",
    why: "Same empty-state wording as web, word for word.",
    must: ["No matching carriers yet for this route or date."],
    mustNot: ["No matched senders"],
  },

  // ------------------------------------------------ search browses everything first
  {
    repo: "web",
    file: ["src/features/search/pages/CustomerSearch.tsx", "src/features/search/components/SearchFilterPanel.tsx"],
    id: "search-browses-all-by-default",
    why: "Search used to open on route-matching ONLY, so a user with no listings of their own saw an empty screen and had no way to browse the marketplace. Browsing everything is the default; route-matching is an opt-in lens.",
    must: ["matchMyRoutes", "All listings", "Matches for my routes", "Showing everything posted on Safarly"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/search/SearchScreen.tsx",
    id: "search-browses-all-by-default",
    why: "Same default and the same two toggle labels as web.",
    must: ["BROWSE_QUERY", "MATCH_MY_ROUTES_QUERY", "All listings", "Matches for my routes", "Showing everything posted on Safarly"],
    mustNot: [],
  },

  // --------------------------------------------- validation never fails silently
  {
    repo: "web",
    file: "src/features/trips/pages/CustomerListTrip.tsx",
    id: "trip-validation-speaks-up",
    why: "The submit handler ended in a bare `return`. With only a size problem - whose warning renders sections above the button - pressing Submit produced no request, no toast and no focus change, which reads as a dead button.",
    must: ["focusFirstFormError()", "Size exceeds airline carry-on limit"],
    mustNot: ["if (Object.keys(errs).length > 0 || hasSizeError) return;"],
  },
  {
    repo: "web",
    file: "src/features/parcels/pages/CustomerSendParcel.tsx",
    id: "parcel-validation-speaks-up",
    why: "Same silent-return bug as the trip form; mobile already scrolled to the offending field.",
    must: ["focusFirstFormError()", "Size exceeds airline carry-on limit"],
    mustNot: ["if (Object.keys(errs).length > 0 || hasSizeError) return;"],
  },

  // ------------------------------------------------------- one rating per booking
  {
    repo: "web",
    file: "src/features/bookings/pages/CustomerRateDelivery.tsx",
    id: "rating-reflects-existing",
    why: "The API already returns `viewer_has_rated`; the page ignored it and offered a blank star rating to someone who had already reviewed, who then hit a CONFLICT after filling it in.",
    must: ["booking.viewer_has_rated", "You already reviewed this delivery"],
    mustNot: [],
  },
  // ------------------------------------------- a listing's owner can act on it
  {
    repo: "web",
    file: "src/features/parcels/pages/CustomerParcelDetail.tsx",
    id: "parcel-detail-owner-actions",
    why: "The owner of a parcel reached this page and found nothing to do - a visitor got 'Message Sender' and the sender got no action at all. The sibling trip detail page has always offered Edit and Cancel; mobile's parcel screen had them too. Web was the outlier.",
    must: ["EditParcelDialog", "customer.cancelParcel", "customer.editParcel", "Cancel this parcel request?"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/parcels/ParcelDetailsScreen.tsx",
    id: "parcel-detail-owner-actions",
    why: "Mobile already offered Edit and Cancel here; pinned so the platforms stay level.",
    must: ["EditParcelModal", "setCancelOpen"],
    mustNot: [],
  },
  // ------------------------------- a success screen opens the list you landed in
  {
    repo: "web",
    file: "src/features/parcels/pages/CustomerSendParcel.tsx",
    id: "receive-request-opens-my-packages",
    why: "Client-reported: posting a receive request dropped you on My Flights. /customer/my-trips with no ?tab falls back to 'flights', so the CTA must name its tab rather than lean on the default.",
    must: ["my-trips?tab=packages"],
    mustNot: ['navigate("/customer/my-trips")'],
  },
  {
    repo: "web",
    file: "src/features/buddies/pages/CustomerCreateBuddy.tsx",
    id: "buddy-listing-opens-travel-partners",
    why: "Same fallback: a new buddy listing belongs in Travel Partners, not My Flights.",
    must: ["my-trips?tab=partners"],
    mustNot: ['navigate("/customer/my-trips")'],
  },
  {
    repo: "mobile",
    file: "src/features/parcels/SendParcelScreen.tsx",
    id: "receive-request-opens-my-packages",
    why: "Mobile had the same defect: navigate('Parcels') with no params lands on the default 'flights' tab.",
    must: ['tab: "packages"'],
    mustNot: ['navigate("Parcels")'],
  },
  {
    repo: "mobile",
    file: "src/features/buddies/CreateBuddyScreen.tsx",
    id: "buddy-listing-opens-travel-partners",
    why: "Same defect for a new buddy listing.",
    must: ['tab: "partners"'],
    mustNot: ['navigate("Parcels")'],
  },
  {
    repo: "mobile",
    file: "src/features/travels/MyTravelsScreen.tsx",
    id: "my-travels-honours-requested-tab",
    why: "My Travels is a BOTTOM TAB and stays mounted, so reading the tab param as initial state only would be ignored on every visit after the first. The effect is what makes the fix work the second time you post something.",
    must: ["requestedTab", "useEffect"],
    mustNot: [],
  },
  // --------------------------- the pin and the thread agree on what is on the table
  {
    repo: "web",
    file: ["src/features/messages/pages/CustomerMessages.tsx", "src/features/messages/hooks/useOfferTimeline.ts"],
    id: "pin-reads-live-offer-from-thread",
    why: "Client-reported: an OPEN $49 counter sat in the thread with Accept/Counter/Decline directly above a bar reading 'Receiver listed this delivery at $45. [Accept $45]'. activeDeal is a SEPARATE fetch from the messages, so while it lagged the two halves of one screen gave different answers and the bar quoted the stale one. The timeline reconciles every card and arrives with the message, so it answers first - which is what mobile has always done (resolveOffers).",
    must: ["const liveOffer", "offerResolutions.get", "liveOffer={liveOffer}"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/features/messages/components/ChatOfferPrompt.tsx",
    id: "pin-reads-live-offer-from-thread",
    why: "The bar must prefer the thread's answer over activeDeal, and must not keep an Accept button alive on an offer the thread has already settled.",
    must: ["authoritativeOffer", "liveOffer !== undefined"],
    mustNot: ['const offer = activeDeal.offer && activeDeal.offer.status === "open"'],
  },
  {
    repo: "mobile",
    file: "src/features/messages/OfferChatScreen.tsx",
    id: "pin-reads-live-offer-from-thread",
    why: "Mobile already derived the live offer from the message thread; pinned so the platforms cannot drift apart again.",
    must: ["resolveOffers", "const liveOffer"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "supabase/functions/message-handler/routes/offers.ts",
    id: "offer-card-status-cannot-freeze",
    why: "The offer_card message is written AFTER the offer row with the status captured at insert. A counter landing in that window supersedes the offer and runs its own card sync, which finds no card yet and silently does nothing - freezing the card at 'open' on a dead offer forever. Two such rows existed in production. Re-read once the card exists and correct it.",
    must: ["settled.status !== offer.status", "syncOfferCardStatus(supabase, offer.id"],
    mustNot: [],
  },
  // ------------------------- the parcel review names the person, not just the role
  {
    repo: "web",
    file: "src/features/messages/components/ChatParcelReviewPrompt.tsx",
    id: "parcel-review-names-the-counterpart",
    why: "Client request: 'it is best to replace by name - it can say Awaiting Roja parcel photos'. Safe on THIS card and not on the price line: every string sits inside the viewer_role === carrier branch, so the reader is always the carrier and the named party is always the other person. The fallback keeps two forms so it still reads as a sentence.",
    // Web interpolates in JSX (`{Who}`), mobile in a template literal (`${Who}`);
    // the shorter form is a substring of both, so one list covers each platform.
    must: ["Awaiting ${who}'s parcel photos", "{Who} needs to add photos", "{Who} shared photos of the parcel.", 'const Who = counterpartName?.trim() || "The sender"'],
    mustNot: ["Awaiting the sender's parcel photos"],
  },
  {
    repo: "mobile",
    file: "src/components/chat/ParcelReviewModal.tsx",
    id: "parcel-review-names-the-counterpart",
    why: "Same copy as web, word for word.",
    must: ["Awaiting ${who}'s parcel photos", "{Who} needs to add photos", "{Who} shared photos of the parcel.", 'const Who = counterpartName?.trim() || "The sender"'],
    mustNot: ['title="The sender shared photos of the parcel."'],
  },
  {
    repo: "mobile",
    file: "src/features/messages/OfferChatScreen.tsx",
    id: "parcel-review-name-is-not-the-placeholder",
    why: "`participantName` falls back to the literal string 'Conversation', which would render 'Awaiting Conversation's parcel photos'. The raw name must be passed so an absent one falls back to the role instead.",
    must: ["counterpartName={conversation?.participant?.name}"],
    mustNot: ["counterpartName={participantName}"],
  },
  // ------------------- a delivery must be named, and named the same on both platforms
  {
    repo: "web",
    file: "src/features/messages/components/ChatDealSwitcher.tsx",
    id: "deal-chips-are-distinguishable",
    why: "Reported live as 'the app is asking the travel document from Viswanath instead of Roja'. It was asking the carrier correctly - but the pair had TWO live deals on the SAME route with OPPOSITE roles, and the chips were labelled by route alone, so both rendered an identical string. Route is not an identifier.",
    must: ["labelDeals", "labels.get(id)?.chip"],
    mustNot: ["function routeLabel"],
  },
  {
    repo: "mobile",
    file: "src/features/messages/ChatDealSwitcher.tsx",
    id: "deal-chips-are-distinguishable",
    why: "Mobile is a direct port of the web switcher and had the identical route-only label.",
    must: ["labelDeals", "labels.get(id)?.chip"],
    mustNot: ["function routeLabel"],
  },
  {
    repo: "web",
    file: "src/features/messages/components/ChatPinnedArea.tsx",
    id: "pinned-action-names-its-delivery",
    why: "The pinned prompts are deal-scoped but named no delivery, so 'Upload your travel document' read as being about the other one. Shown only when the thread holds more than one, so a single-delivery chat is unchanged.",
    must: ["selectedDealLabel", "This step is for"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/messages/OfferChatScreen.tsx",
    id: "pinned-action-names-its-delivery",
    why: "Same line on mobile, same wording.",
    must: ["selectedDealLabel", "This step is for"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/lib/dealLabel.ts",
    id: "deal-labels-are-unique-in-a-thread",
    why: "A label that is only USUALLY unique is the bug this module removes. Role leads (it is what was misread), then route, then category, then the id as a last resort. The id tiebreak takes the TAIL and grows until unique: it took the HEAD, and two ids sharing a prefix produced two identical labels - found by running the real app, not by the unit tests.",
    must: ['role === "carrier" ? "Carrying" : "Receiving"', "uniqueTail(b.id, clashingIds)"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/utils/dealLabel.ts",
    id: "deal-labels-are-unique-in-a-thread",
    why: "Ported from web; both platforms run the same suite so a delivery cannot be called one thing on the phone and another on the web.",
    must: ['role === "carrier" ? "Carrying" : "Receiving"', "uniqueTail(b.id, clashingIds)"],
    mustNot: [],
  },
  // ------------- the switcher and the pinned line must agree that a choice exists
  {
    repo: "web",
    file: "src/features/messages/hooks/useOfferTimeline.ts",
    id: "context-line-follows-the-switcher",
    why: "Found by scenario H: a CANCELLED delivery beside a live one hid the switcher (which filters finished deals) while the pinned line still printed 'This step is for ...' - announcing a choice with no control to make it. Both must ask selectableDeals().",
    must: ["selectableDeals(dealList, selectedDealIdResolved).length < 2"],
    mustNot: ["dealList.length < 2"],
  },
  {
    repo: "mobile",
    file: "src/features/messages/OfferChatScreen.tsx",
    id: "context-line-follows-the-switcher",
    why: "Same defect, same fix - the scenario that found it ran on mobile.",
    must: ["selectableDeals(deals ?? [], selectedDealId).length < 2"],
    mustNot: ["deals.length < 2"],
  },
  {
    repo: "web",
    file: "src/lib/dealLabel.ts",
    id: "one-definition-of-finished",
    why: "Two copies of 'is this delivery finished' is how the switcher and the pinned line came to disagree. The predicate lives here and both callers delegate to it.",
    must: ["export function isDealFinished", "export function selectableDeals"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/utils/dealLabel.ts",
    id: "one-definition-of-finished",
    why: "Ported from web; both platforms delegate to it.",
    must: ["export function isDealFinished", "export function selectableDeals"],
    mustNot: [],
  },
  // ------------------------------------------- QA sweep: nothing fabricated ships
  {
    repo: "mobile",
    file: "src/navigation/RootNavigator.tsx",
    id: "no-fabricated-offers-screen",
    why: "A QA sweep opened OffersTab and was shown three invented offers - 'Priya S. / iPhone 15 Pro Max / $45' on a hard-coded 'Seattle -> Hyderabad' route, with Accept and Decline buttons wired to nothing. It called no API at all. The screen and its route are gone; re-registering either puts fabricated deal data back in front of users.",
    must: [],
    mustNot: ["ParcelOffersScreen", "OffersTab"],
  },
  {
    repo: "mobile",
    file: "src/features/messages/OfferChatScreen.tsx",
    id: "chat-back-target-defaults-to-the-inbox",
    why: "A chat opened without `source` - a notification tap, a deep link - defaulted to 'offers', so Back dropped the user on the fabricated offers screen. The inbox is where a chat with no context belongs.",
    must: ['route.params?.source ?? "messages"'],
    mustNot: ['?? "offers"', "OffersTab"],
  },
  {
    repo: "mobile",
    file: "src/features/buddies/PartnerDetailsScreen.tsx",
    id: "partner-details-explains-a-missing-listing",
    why: "The skeleton branch read `!listing && !error`, which is exactly the shape of the ordinary not-found case - a cancelled listing, or a link with no listingId. Those sat on a loading skeleton forever: nothing to read, nothing to tap. Only a request actually in flight may show the skeleton.",
    must: ["if (loading && !listing && !error)"],
    mustNot: ["if (!listing && !error) {"],
  },
  {
    repo: "mobile",
    file: "src/features/bookings/PayBookingScreen.tsx",
    id: "booking-not-found-is-not-said-twice",
    why: "The server's message for a missing booking is the heading itself, so the panel read 'Booking not found / Booking not found'. The server's wording is shown only when it adds something.",
    must: ["notFoundDetail"],
    mustNot: ["{error ? getErrorMessage(error) : \"We couldn't load this booking.\"}"],
  },
  // -------------------------------------- QA sweep: a deep link must answer at once
  {
    repo: "web",
    file: "src/features/customer-shell/layouts/CustomerLayout.tsx",
    id: "shell-does-not-block-on-the-profile-call",
    why: "Reported as 'the site is very slow'. The shell blocked every screen underneath it on GET user-handler/me - measured at 4.6s against a cold edge function - so a deep link to a parcel did not issue its own request until +5.6s. Onboarding completion never goes back to false, so a remembered yes lets the shell render at once: measured 7460ms -> 324ms. Mobile has always worked this way (`profileSetupDone`).",
    must: ["wasOnboarded", "rememberOnboarded", 'if (isLoading && !(onboardedHint && role === "customer"))'],
    mustNot: ["if (isLoading) { return <PageLoader"],
  },
  {
    repo: "web",
    file: "src/hooks/api/useParcels.ts",
    id: "missing-parcel-surfaces-at-once",
    why: "A deep link to a parcel that does not exist retried the 404 four times with backoff - measured +5.6s, +7.5s, +10.0s, +14.6s on production - and only explained itself at 15.1s. Reported as 'no explanation and no redirect'.",
    must: ["retry: retryUnlessClientError"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/hooks/api/useDisputes.ts",
    id: "missing-dispute-surfaces-at-once",
    why: "Same retry policy as the parcel deep link; a dispute that is not yours must say so immediately.",
    must: ["retry: retryUnlessClientError"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/hooks/api/useUsers.ts",
    id: "missing-profile-surfaces-at-once",
    why: "Same retry policy as the parcel deep link; a profile that no longer exists must say so immediately.",
    must: ["retry: retryUnlessClientError"],
    mustNot: [],
  },
  // ------------------------------- acceptance QA: a wait must always end somewhere
  {
    repo: "web",
    file: "src/features/auth/components/RoleLogin.tsx",
    id: "sign-in-cannot-hang-forever",
    why: "Caught live during acceptance testing: POST /auth/v1/token was issued and never answered, and signInWithPassword neither resolved nor rejected - so the button sat on 'Signing in...' indefinitely with nothing to read and nothing to retry. The page already toasts getErrorMessage(error); it just never got an error.",
    must: ["withTimeout(", "AUTH_TIMEOUT_MS", "taking longer than usual"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/services/api/auth.ts",
    id: "direct-auth-calls-are-bounded",
    why: "signUp bypasses the API client and had no deadline of its own, so the same hang that hit sign-in could hit account creation.",
    must: ["withTimeout(", "AUTH_TIMEOUT_MS"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/services/api/auth.ts",
    id: "direct-auth-calls-are-bounded",
    why: "Same unbounded Supabase auth calls as web - the two platforms must not drift on this.",
    must: ["withTimeout(", "AUTH_TIMEOUT_MS"],
    mustNot: [],
  },
  // --------------------------- acceptance QA: a failure must say which failure
  {
    repo: "web",
    file: "src/components/ui/ErrorState.tsx",
    id: "error-panels-name-the-failure",
    why: "Every list screen showed 'We couldn't load this content. Please try again.' for a dead radio, a deleted record and a missing permission alike - three different problems, three different next steps, one message that fitted none. The panel now derives its wording from the shared classifier.",
    must: ["fallbackFor", "permission", "server", "VARIANT_FOR_KIND"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/features/bookings/pages/CustomerBookings.tsx",
    id: "retry-does-not-reboot-the-app",
    why: "Try Again ran window.location.reload(), throwing away every other piece of app state to retry one request - and on a genuinely offline device a reload cannot fetch the document at all, which would strand the user on a browser error page instead of the app.",
    must: ["refetch()"],
    mustNot: ["window.location.reload"],
  },
  {
    repo: "web",
    file: "src/features/my-trips/pages/CustomerMyTrips.tsx",
    id: "flights-and-partners-offer-a-way-out",
    why: "Both error states rendered with no retry and no link: a dead end with nothing to press.",
    must: ["refetchFlights", "refetchBuddyListings"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/bookings/BookingsScreen.tsx",
    id: "error-panels-name-the-failure",
    why: "Mobile hand-rolled the same card on every list screen, which is how the wording drifted between them and away from web. They now share one component fed by the same classifier.",
    must: ["ErrorState", "subject="],
    mustNot: ["Failed to load bookings"],
  },
  {
    repo: "mobile",
    file: "src/features/disputes/DisputesScreen.tsx",
    id: "error-panels-name-the-failure-disputes",
    why: "Same hand-rolled card as Bookings.",
    must: ["ErrorState", "subject="],
    mustNot: ["Failed to load disputes"],
  },
  // ---------------- the free-tier project ran out of disk IO budget and stalled
  {
    repo: "web",
    file: "src/hooks/api/useSearch.ts",
    id: "search-does-not-poll-every-30s",
    why: "The Supabase project went Unhealthy after depleting its disk IO budget on a t4g.nano, and every service that touches Postgres - Auth, PostgREST, Edge Functions - stopped answering. Search is the heaviest read in the app; at 30s a single open tab issued 120 an hour with nobody touching anything. Realtime already invalidates ['search'] on every listing insert/update, so the poll is only a safety net.",
    must: ["refetchInterval: 3 * 60 * 1000"],
    mustNot: ["refetchInterval: 30 * 1000"],
  },
  {
    repo: "web",
    file: "src/hooks/api/useNotifications.ts",
    id: "notifications-do-not-poll-every-60s",
    why: "The list and the unread count each polled every 60s - 120 database-backed requests an hour from every open tab, before the user did anything. Realtime already carries INSERT and UPDATE on this user's notifications.",
    must: ["refetchInterval: 5 * 60 * 1000"],
    mustNot: ["refetchInterval: 60 * 1000"],
  },
  {
    repo: "mobile",
    file: "src/hooks/api/useSearchMatches.ts",
    id: "search-does-not-poll-every-30s",
    why: "Same 30s search poll as web, on every device. The two platforms must stay on the same cadence.",
    must: ["const POLL_INTERVAL_MS = 180_000;"],
    mustNot: ["const POLL_INTERVAL_MS = 30_000;"],
  },
  // ------------- travel buddy: formed in chat, like every other request
  {
    repo: "web",
    file: "src/features/search/components/PersonCard.tsx",
    id: "buddy-match-is-chat-first",
    why: "Client decision (22 Oct 2026): NO Connect button for Travel Buddy. A buddy is made the same way as every other request - Start chat, one side taps Match, the other accepts - and the accepted match creates the buddy connection server-side. That only works if the buddy chat carries the listing it came from as context_id. Pending requests sent from older app versions are still accepted in My Travels -> Partners.",
    must: ["buddyListingId", "context_id"],
    mustNot: ["useSendBuddyRequest", "handleConnect"],
  },
  {
    repo: "mobile",
    file: "src/features/search/SearchScreen.tsx",
    id: "buddy-match-is-chat-first",
    why: "Same decision on mobile - the two platforms must not drift: no Connect, and Start chat names the buddy listing (context_id) so the accepted chat match becomes the buddy connection.",
    must: ['messagesApi.createConversation(match.user.id, "buddy", match.id)'],
    mustNot: ["buddiesApi.sendRequest", "handleConnect"],
  },
  {
    repo: "mobile",
    file: "src/features/search/components/BuddyMatchCardBody.tsx",
    id: "buddy-match-is-chat-first",
    why: "The buddy card offers View profile and Start chat only.",
    must: ["View profile", "Start chat"],
    mustNot: ['"Connect"', "handleConnect"],
  },
  {
    repo: "web",
    file: "src/features/my-trips/components/BuddyConnectionCard.tsx",
    id: "buddy-no-disconnect",
    why: "Client decision (22 Oct 2026): Travel Buddy works like a parcel request - no Connect, and so no Disconnect either. A buddy trip is ended by Unmatch in the chat, which ends the buddy trip server-side. The My buddies card keeps Chat / Confirm journey / Rate buddy only.",
    must: ["Confirm journey", "Rate buddy"],
    mustNot: ["Disconnect"],
  },
  {
    repo: "mobile",
    file: "src/features/travels/components/BuddyRequestCards.tsx",
    id: "buddy-no-disconnect",
    why: "Same decision on mobile - the two platforms must not drift: no Disconnect on the buddy card; Unmatch in the chat ends the buddy trip.",
    must: ["Confirm journey"],
    mustNot: ["Disconnect"],
  },
  // ---------------- travel buddy: chat match is the connection (22 Oct 2026)
  {
    repo: "web",
    file: "supabase/functions/message-handler/routes/match.ts",
    id: "buddy-match-opens-trip",
    why: "With no Connect step, an accepted buddy chat match must open the buddy trip itself (journey confirmation + reviews hang off it), respect the 5-buddies-per-trip limit, and let a pair re-match after a finished trip (buddies have no bookings, so the delivery check must not apply).",
    must: ["startBuddyTripFromMatch(", "buddyMatchWouldOverfill(", "TRIP_FULL_MESSAGE", "isBuddy && effective.match_status === 'matched'"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "supabase/functions/message-handler/routes/declineUnmatch.ts",
    id: "buddy-unmatch-not-parcel",
    why: "A buddy chat's decline/unmatch is about the buddy trip, never a parcel deal the same pair may also have (one conversation per pair). Unmatch ends the buddy trip.",
    must: ["conv.context_type === 'buddy'", "endBuddyTripOnUnmatch("],
    mustNot: [],
  },
  {
    repo: "web",
    file: "supabase/functions/_shared/buddyTrips.ts",
    id: "buddy-trip-limit",
    why: "Requirement: a travel-buddy trip takes at most 5 buddies, enforced server-side for the chat match and the legacy request/accept path.",
    must: ["MAX_BUDDIES_PER_TRIP = 5", "export async function startBuddyTripFromMatch", "export async function buddyMatchWouldOverfill"],
    mustNot: [],
  },
  // ------- travel buddy in a SHARED chat: its own entry beside the parcel deals
  {
    repo: "web",
    file: "src/features/messages/lib/buddyEntry.ts",
    id: "buddy-pin-never-says-delivery",
    why: "Client screenshot (22 Oct 2026): a pair who also had a parcel deal could only 'Match', and the prompt read 'X requested a match for this delivery.' The travel-buddy request is now its own entry in the shared chat; its pin must speak about the trip, never a delivery. One primary action per state, plain words.",
    must: [
      "Request to be travel buddies",
      "asked to be your travel buddy for this trip.",
      "Waiting for ${name} to accept.",
      "You're travel buddies for this trip.",
      '"Travel buddy"',
    ],
    mustNot: ["this delivery", "delivery"],
  },
  {
    repo: "mobile",
    file: "src/utils/buddyEntry.ts",
    id: "buddy-pin-never-says-delivery",
    why: "Same buddy pin wording on mobile (byte-identical copy of web's lib/buddyEntry.ts) - the two platforms must not drift, and it never says delivery.",
    must: [
      "Request to be travel buddies",
      "asked to be your travel buddy for this trip.",
      "Waiting for ${name} to accept.",
      "You're travel buddies for this trip.",
      '"Travel buddy"',
    ],
    mustNot: ["this delivery", "delivery"],
  },
  {
    repo: "web",
    file: "src/features/messages/components/ChatBuddyPin.tsx",
    id: "buddy-pin-never-says-delivery",
    why: "The buddy pin renders only buddyPinView's words and confirms through the buddy-mode match sheet (buddy disclaimers only).",
    must: ["buddyPinView(", 'contextType="buddy"'],
    mustNot: ["this delivery"],
  },
  {
    repo: "mobile",
    file: "src/features/messages/chat/components/BuddyPin.tsx",
    id: "buddy-pin-never-says-delivery",
    why: "Same on mobile: the buddy pin renders only buddyPinView's words, never 'this delivery'.",
    must: ["buddyPinView("],
    mustNot: ["this delivery"],
  },
  {
    repo: "web",
    file: "supabase/functions/_shared/buddyRequests.ts",
    id: "buddy-shared-chat-lines",
    why: "The chat timeline for a buddy request in a shared chat, client wording. The accept line is the same as a buddy-chat Match.",
    must: [
      "asked to be your travel buddy for ${from} → ${to}.",
      "🎉 You're now travel buddies! Plan your trip together here. Stay safe!",
      "Travel buddy request declined.",
    ],
    mustNot: ["delivery"],
  },
  {
    repo: "web",
    file: "src/features/messages/components/MatchConfirmationModal.tsx",
    id: "buddy-modal-no-parcel-rules",
    why: "Client (22 Oct 2026): a travel-buddy match must show only travel-buddy disclaimers. Parcel Responsibilities and Restricted Items render only for non-buddy chats.",
    must: ["!isBuddy && (", "Travel Buddy Safety"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/components/chat/MatchConfirmationModal.tsx",
    id: "buddy-modal-no-parcel-rules",
    why: "Same on mobile: buddy chats show the travel-arrangement disclaimer + Travel Buddy Safety only; parcel sections only for non-buddy chats.",
    must: ["isBuddy ? (", "Travel Buddy Safety"],
    mustNot: [],
  },
  // ---------------- KYC gate must never go stale (client, 22 Oct 2026)
  {
    repo: "mobile",
    file: "src/hooks/api/useKycGate.ts",
    id: "kyc-gate-refreshes",
    why: "A client verified, came back to Pay, and still saw 'Identity verification required' with Pay blocked: the gate read KYC once on mount and tab screens stay mounted. It must re-read on focus and on app foreground, and refetch must return the fresh answer.",
    must: ["useFocusEffect(", "AppState.addEventListener", "refetch: () => Promise<boolean>"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/bookings/PayBookingScreen.tsx",
    id: "pay-rechecks-kyc",
    why: "Pay must ask the server once more before blocking on KYC, so a just-verified user pays straight away.",
    must: ["await kyc.refetch()"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/tabs/ProfileScreen.tsx",
    id: "kyc-approved-not-verified",
    why: "The server's KYC values are none / pending / approved / rejected. Comparing against \"verified\" alone meant a verified user never saw the Verified badge. Use the shared helper.",
    must: ["isKycApprovedStatus("],
    mustNot: ['kyc_status === "verified";'],
  },
  // ------------- KYC "Check status" always does something visible
  {
    repo: "web",
    file: "supabase/functions/kyc-handler/index.ts",
    id: "kyc-check-status-answers",
    why: "Client, 22 Oct 2026: 'Check status' did nothing early in a session - the server only asked Didit once a session was 2 minutes old, and the button re-read the same row with no feedback. A tap now sends ?check=1 and the server asks Didit at once (5 s throttle).",
    must: ["searchParams.get('check') === '1'"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/features/profile/components/DiditKycPanel.tsx",
    id: "kyc-check-status-answers",
    why: "The button shows Checking…, asks the server to check with Didit, and always answers in words (not finished / couldn't reach / the screen moves on).",
    must: ["useCheckKycStatus()", "statusCheckMessage(", "Checking…"],
    mustNot: ['onClick={onRefresh} disabled={busy} className="btn-action-secondary">Check status'],
  },
  {
    repo: "mobile",
    file: "src/features/profile/DiditKycPanel.tsx",
    id: "kyc-check-status-answers",
    why: "Same on mobile: the button used to call the plain refresh and showed nothing.",
    must: ["checkStatus()", "statusCheckMessage(", "Checking…"],
    mustNot: ['label="Check status" variant="secondary" onPress={() => void refreshRef.current()}'],
  },
  {
    repo: "web",
    file: "src/features/trips/pages/CustomerListTrip.tsx",
    id: "no-negative-sizes-weights",
    why: "Client, 22 Oct 2026: size, weight and fee fields accepted negative numbers. Every number field filters to digits and one dot (positiveDecimal) and blocks -/+/e keys; the server refuses <= 0 too.",
    must: ["positiveDecimal(e.target.value)", "onKeyDown={blockNegativeKeys}"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/features/trips/components/EditTripDialog.tsx",
    id: "no-negative-sizes-weights",
    why: "Client, 22 Oct 2026: size, weight and fee fields accepted negative numbers. Every number field filters to digits and one dot (positiveDecimal) and blocks -/+/e keys; the server refuses <= 0 too.",
    must: ["positiveDecimal(e.target.value)", "onKeyDown={blockNegativeKeys}"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/features/parcels/pages/CustomerSendParcel.tsx",
    id: "no-negative-sizes-weights",
    why: "Client, 22 Oct 2026: size, weight and fee fields accepted negative numbers. Every number field filters to digits and one dot (positiveDecimal) and blocks -/+/e keys; the server refuses <= 0 too.",
    must: ["positiveDecimal(e.target.value)", "onKeyDown={blockNegativeKeys}"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/features/parcels/components/EditParcelDialog.tsx",
    id: "no-negative-sizes-weights",
    why: "Client, 22 Oct 2026: size, weight and fee fields accepted negative numbers. Every number field filters to digits and one dot (positiveDecimal) and blocks -/+/e keys; the server refuses <= 0 too.",
    must: ["positiveDecimal(e.target.value)", "onKeyDown={blockNegativeKeys}"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/trips/EditTripModal.tsx",
    id: "no-negative-sizes-weights",
    why: "Same on mobile: the trip edit capacity took raw text; it now goes through sanitizeDecimalInput like the create forms.",
    must: ["luggage_capacity_kg: sanitizeDecimalInput(t, 4, 2)"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "supabase/functions/parcel-handler/index.ts",
    id: "no-negative-sizes-weights",
    why: "The server refuses a zero or negative fee and checks weight on edit as on create.",
    must: ["Fee offered must be greater than 0", "checkWeightKg(updates.weight, 'Weight')"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "supabase/functions/trip-handler/index.ts",
    id: "no-negative-sizes-weights",
    why: "Trip edit checks capacity like create (0 < kg <= 23).",
    must: ["checkWeightKg(updates.luggage_capacity, 'Luggage capacity')"],
    mustNot: [],
  },
  // ------------- KYC is mandatory before payout setup (client requirement)
  {
    repo: "web",
    file: "supabase/functions/payment-handler/index.ts",
    id: "kyc-before-payouts",
    why: "Client requirement (22 Oct 2026): every user must pass identity verification before setting up payouts. No payout route checked it - an unverified user could connect Stripe or add a Razorpay bank/UPI account. All three setup routes now call requireKycForPayouts.",
    must: ["async function requireKycForPayouts", "Verify your identity before setting up payouts."],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/features/payments/pages/CustomerPayoutSetup.tsx",
    id: "kyc-before-payouts",
    why: "The payout page shows 'Verify your identity first' instead of the payout form until KYC is approved.",
    must: ["useKycGate()", "Verify your identity first"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/wallet/PayoutSetupScreen.tsx",
    id: "kyc-before-payouts",
    why: "Same on mobile.",
    must: ["useKycGate()", "Verify your identity first"],
    mustNot: [],
  },
  // ------------- verification sheets close themselves once the step is submitted
  {
    repo: "mobile",
    file: "src/features/messages/chat/hooks/useChatVerification.ts",
    id: "verification-sheet-autocloses",
    why: "Client, 22 Oct 2026: after submitting parcel photos (sender) or a travel document (carrier) the sheet stayed open over the chat until the user found the X. Submit, request-changes and escalate now close it like approve/cancel already did; the pin shows the next step.",
    must: [
      "await travelDoc.upload(file); setTravelDocOpen(false);",
      "await travelDoc.reject(reason); setTravelDocOpen(false);",
      "await parcelReview.upload(files); setParcelReviewOpen(false);",
      "await parcelReview.reject(reason, note); setParcelReviewOpen(false);",
    ],
    mustNot: [],
  },
  // ------------- a buddy match speaks buddy, never parcel
  {
    repo: "web",
    file: "supabase/functions/message-handler/routes/match.ts",
    id: "buddy-match-message-is-buddy",
    why: "Client, 22 Oct 2026: two travel buddies who matched got the parcel line 'MATCH CONFIRMED! ... coordinate pickup details and confirm delivery after handover'. A buddy chat gets its own timeline text and inbox preview; the parcel text stays for parcel deals.",
    must: ["You're now travel buddies! Plan your trip together here. Stay safe!", "isBuddy ? \"🎉 You're now travel buddies\" : '🎉 Match confirmed'"],
    // Client, same day: the buddy line must not send them to My Travels.
    mustNot: ["confirm your journey in My Travels"],
  },
  // ------------- a match notification lands on the card, not just the Search page
  {
    repo: "web",
    file: "supabase/functions/_shared/matchLinks.ts",
    id: "match-link-names-listing",
    why: "Client, 22 Oct 2026: tapping a match notification opened Search and left the user to find their trip / parcel. Every match link now carries `for` = the recipient's own listing, so even a several-match summary lands on that listing's group.",
    must: ["params.set('for', forId)"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/features/search/pages/CustomerSearch.tsx",
    id: "match-link-names-listing",
    why: "Web scrolls to and rings the listing named by `?for=`; `?match=` still scrolls to the single card (NestedPackageProfile / BuddyMatchCard).",
    must: ['searchParams.get("for")', "data-listing-id", "scrollIntoView"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/services/notifications/notificationRoute.ts",
    id: "match-link-names-listing",
    why: "The app must read `for` off the link, or a summary notification only opens the tab.",
    must: ["params.forId = f[1]"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/search/SearchScreen.tsx",
    id: "match-link-names-listing",
    why: "Mobile highlighted a single parcel/trip match but never scrolled to it - the card could be screens below. `matchFocusTarget` picks the card or your listing's group and the screen scrolls there, for parcels, trips and buddies alike.",
    must: ["matchFocusTarget(", "scrollRef.current?.scrollTo", "forId"],
    mustNot: [],
  },
  // ---------------- travel buddy: exactly one production path, no local fakes
  {
    repo: "mobile",
    file: "src/navigation/RootNavigator.tsx",
    id: "no-fake-buddy-screens",
    why: "Two unreachable screens shipped inside the app and both lied. BuddyDetailsScreen had a Connect button that called `toggleBuddyConnection(name)` - a local zustand toggle over seed data that never touched the server. BuddyCompletionScreen defaulted the buddy to the seed name 'Sarah K.', hardcoded the reviewer as 'Alex Johnson', wrote the review with `addReview` into local state and toasted 'Review submitted!' while nothing reached the API. Both were registered in the navigator, so any deep link or future wiring would expose them. The real paths are SearchScreen -> Start chat -> chat Match/accept (buddy-handler / message-handler) and MyTravelsScreen -> ratingsApi.rateBuddy.",
    must: [],
    mustNot: ["BuddyDetailsTab", "BuddyDetailsScreen", "BuddyCompletionTab", "BuddyCompletionScreen"],
  },
  {
    repo: "mobile",
    file: "src/store/useAppStore.ts",
    id: "no-local-buddy-or-review-state",
    why: "`toggleBuddyConnection` and `addReview` let a screen fake a connection and a review in local state. A buddy connection may only come from buddy-handler, and a review only from rating-handler.",
    must: [],
    mustNot: ["toggleBuddyConnection", "addReview", "seedBuddies", "seedReviews"],
  },
  // ------------------------- a 4xx must never be retried, for EVERY query
  {
    repo: "web",
    file: "src/lib/queryClient.ts",
    id: "queries-do-not-retry-a-4xx",
    why: "React Query retries three times with backoff by default, which is right for a flaky connection and wrong for 'this record is not yours'. Measured on a forced 401: eight requests and 10.4 seconds before the screen could say 'Your session has expired'. Six hooks had set the policy individually and forty-two had not. Putting it on the QueryClient fixes the class rather than the instances and covers hooks nobody has written yet. Safe for a transient 401 because send() already refreshes the session and re-issues once before React Query ever sees it.",
    must: ["retry: retryUnlessClientError", "refetchOnWindowFocus: false"],
    mustNot: [],
  },
  // ===================== 23 Oct 2026 client QA + E2E findings =====================
  {
    repo: "web",
    file: "supabase/functions/_shared/fsm.ts",
    id: "verification-steps-never-offer-a-waiting-upload",
    why: "Client: after uploading the travel document the carrier was shown 'Upload' again while the sender had not reviewed it. The mobile apps render this CTA as-is, so the step answers from the upload status: whoever must act gets the action, the other side waits.",
    must: ["await_travel_doc_review", "await_parcel_review", "ctx.travelDocStatus === 'pending'", "ctx.parcelReviewStatus === 'pending'"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "supabase/functions/carrier-request-handler/index.ts",
    id: "no-travel-doc-reupload-while-pending",
    why: "Each upload spends one of the carrier's limited attempts; a stale Upload button could burn them before the sender ever looked.",
    must: ["Your travel document is with the sender for review."],
    mustNot: [],
  },
  {
    repo: "web",
    file: "supabase/functions/_shared/offerPricing.ts",
    id: "repriced-listing-beats-old-agreement",
    why: "Client: a $20 parcel opened the offer box at 3 - a re-match suggested the previous, cancelled deal's agreed price ahead of the listing the sender had since re-priced.",
    must: ["listingIsNewer"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "supabase/functions/_shared/stripe.ts",
    id: "inr-payout-in-settlement-currency",
    why: "A rupee charge settles to the US platform's USD balance and Stripe refuses a rupee transfer against it: every INR delivery left the carrier unpaid. Pay the share in the settled currency at the charge's own rate; reverse in the transfer's currency.",
    must: ["settledTransferAmount(", "export async function reversalMinorUnits("],
    mustNot: [],
  },
  {
    repo: "web",
    file: "supabase/functions/_shared/buddyTripChange.ts",
    id: "any-date-field-is-a-change",
    why: "Comparing the date window first read an edit of only travel_date / delivery_by as 'no change': the booked-trip lock and the notices both missed it (E2E PLAN-A6/B1/B11).",
    must: ["day(prior.travel_date) !== day(next.travel_date)"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "supabase/functions/trip-handler/index.ts",
    id: "booked-trip-route-and-dates-locked",
    why: "Client: a matched user changing dates must not silently move a booked deal. Same rule the parcel side already had for its route; matched-not-booked deals are told instead.",
    must: ["TRIP_LOCK_MESSAGE", "tellDealCounterparts(", "syncCompanionBuddyListing("],
    mustNot: [],
  },
  {
    repo: "web",
    file: "supabase/migrations/20261023120000_race_guards_capacity_and_buddy_requests.sql",
    id: "race-guards-in-the-database",
    why: "Many-user E2E: two simultaneous 4 kg handovers into 6 kg were both accepted, and two crossing buddy requests both landed. The database enforces both rules now - do not weaken them.",
    must: ["OR pr.locked_booking_id = b.id", "uq_buddy_requests_one_pending_per_pair"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "public/boot-profile.js",
    id: "boot-profile-skips-expired-token",
    why: "Every return visit sent an expired token first: a guaranteed 401, a console error and a wasted round trip before the refresh.",
    must: ["expiresAt * 1000 <= Date.now() + 30000"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/features/bookings/pages/CustomerCheckout.tsx",
    id: "pay-page-kyc-refusal-shows-prompt",
    why: "KYC revoked after accept: the pay page showed a bare error toast instead of the verify prompt, and trusted a minute-old KYC answer.",
    must: ['err.code === "KYC_REQUIRED"', 'queryKey: ["kyc", "status"]'],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/services/auth/appleOAuth.ts",
    id: "apple-sign-in-sends-the-nonce",
    why: "Production auth log: every iOS Apple sign-in refused with 'Passed nonce and nonce in id_token should either both exist or not' - no account was ever created. Apple gets SHA-256(nonce), Supabase the raw value (Apple + Supabase documented flow). App Review tests Sign in with Apple.",
    must: ["nonce: nonce.hashed", "appleSignInWithIdToken(credential.identityToken, nonce.raw)"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/services/api/auth.ts",
    id: "apple-id-token-carries-raw-nonce",
    why: "See apple-sign-in-sends-the-nonce.",
    must: ["nonce: rawNonce"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/auth/LoginScreen.tsx",
    id: "apple-failure-is-never-silent-login",
    why: "A tester saw 'nothing happen' when Apple sign-in failed. A failure must be impossible to miss.",
    must: ['Alert.alert("Sign in with Apple", message)'],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/auth/SignupScreen.tsx",
    id: "apple-failure-is-never-silent-signup",
    why: "See apple-failure-is-never-silent-login.",
    must: ['Alert.alert("Sign in with Apple", message)'],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/messages/ChatWorkflowPin.tsx",
    id: "pin-arrow-and-uploader-wait",
    why: "Client: the collapsible pin's arrow pointed the wrong way (it grows upward); and an upload already waiting for review must never offer Upload again.",
    must: ['name={expanded ? "chevron-down" : "chevron-up"}', 'waiting("await_travel_doc_review"'],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/components/chat/ParcelReviewModal.tsx",
    id: "review-sheet-shrinks-to-fit",
    why: "Client: Accept / Reject were cut off at the bottom on a ~700pt phone - a fixed 540 scroll height overflowed the 88%-capped sheet.",
    must: ["body: { flexShrink: 1 }"],
    mustNot: ["body: { maxHeight: 540 }"],
  },
  {
    repo: "mobile",
    file: "src/components/chat/TravelDocModal.tsx",
    id: "travel-doc-sheet-shrinks-to-fit",
    why: "See review-sheet-shrinks-to-fit.",
    must: ["body: { flexShrink: 1 }"],
    mustNot: ["body: { maxHeight: 520 }"],
  },
  {
    repo: "mobile",
    file: "src/features/messages/OfferChatScreen.tsx",
    id: "live-offer-from-the-server",
    why: "Android QA: in a long chat the offer card was not among the loaded messages, so Counter opened as 'Make an offer'. The selected deal's open offer comes from the server.",
    must: ['server.status === "open"'],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/messages/ChatDealSwitcher.tsx",
    id: "selected-deal-chip-visible",
    why: "Client: the selected 'Travel buddy' chip sat cut off past the right edge and read as unclickable; scroll it into view and mark the selection clearly, as on web.",
    must: ["scrollRef.current?.scrollTo", "chipOn: { backgroundColor: colors.primarySoft"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/search/components/SearchFilterFields.tsx",
    id: "search-labels-not-clipped-on-android",
    why: "Android drew only 'Travel' of 'Travel Buddy' - a shrink-wrapped row under-measured the bold label.",
    must: ['alignSelf: "stretch"', "checkboxLabel: { flex: 1"],
    mustNot: [],
  },
  // ============ 23 Oct 2026 (later): iPhone 8 / small-screen + stale-chat ============
  {
    repo: "mobile",
    dir: "src/hooks/api",
    id: "data-hooks-never-drop-a-refresh",
    why: "Client, iPhone: the chat sat on 'Waiting · Match request sent' over a 'MATCH CONFIRMED' message, and the document step was hidden behind the stale banner. `if (inFlight) return inFlight` DROPPED every realtime refresh that arrived while a fetch ran; accepting a match is a burst of writes, so the first fetch read too early and the rest joined it. Every data hook goes through useSingleFlight, which queues one trailing run.",
    must: [],
    mustNot: ["return inFlightRef.current", "if (inFlightRef.current)"],
  },
  {
    repo: "mobile",
    file: "src/utils/singleFlight.ts",
    id: "single-flight-queues-a-trailing-run",
    why: "See data-hooks-never-drop-a-refresh. Coalescing must queue the LATEST request, never discard it.",
    must: ["queued = task;", "next = queued;"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/hooks/api/useActiveDeal.ts",
    id: "chat-deal-state-is-per-conversation",
    why: "Opening chat B showed chat A's deals, step and offer until B's fetch returned, and a refresh for A in flight made B skip its own fetch. Data for another conversation is never shown.",
    must: ["dataConversationId === conversationId", "flight.run(", "currentConversationRef.current === conversationId"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: ["src/features/messages/chat/components/ChatMessageList.tsx", "src/features/messages/chat/hooks/useChatAutoScroll.ts"],
    id: "chat-opens-on-the-newest-message",
    why: "Client, iPhone 8: the chat opened mid-thread and read as 'messages not loading'. A one-off scrollToEnd lost the race with rows/images/bars settling (3 of 5 emulator runs). The list is INVERTED: it starts at the newest message by construction.",
    must: ["inverted", "data={newestFirst}", "onEndReached={handleReachOldest}", "scrollToOffset({ offset: 0"],
    mustNot: ["scrollToEnd("],
  },
  {
    repo: "mobile",
    file: "src/features/messages/chat/components/OfferBar.tsx",
    id: "offer-bar-amount-always-visible-and-own-offer-actionable",
    why: "Client, iPhone 8: the amount rendered as '₹…' beside three buttons; and 'Waiting…' with no action read as stuck. The row wraps (the amount keeps 150pt) and your own offer offers Change (the server supersedes it).",
    must: ['flexWrap: "wrap"', "flexBasis: 150", 'accessibilityLabel="Change your offer"', "Waiting for {firstName}…"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/messages/MessagesScreen.tsx",
    id: "inbox-filter-chips-fit-any-width",
    why: "Client, zoomed iPhone 8 (320pt): 'Requests' ran off the card and 'Unread chats' was cut. The chips shrink to the row and the label scales to fit - it needs a width bound (minWidth 0 + flexShrink) for adjustsFontSizeToFit to work.",
    must: ["adjustsFontSizeToFit", 'chipText: { fontSize: 12, fontWeight: "800", flexShrink: 1, minWidth: 0 }', "maxFontSizeMultiplier={COMPACT_CONTROL_MAX_FONT_SCALE}"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/messages/inbox/ConversationRow.tsx",
    id: "inbox-row-name-never-squeezed-away",
    why: "320pt + larger text: the status pill and 'Match again' left the name zero-width ('…'). The pill wraps under the name.",
    must: ['topRow: { flexDirection: "row", flexWrap: "wrap"'],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: ["src/features/trips/ListTripScreen.tsx", "src/features/parcels/SendParcelScreen.tsx"],
    id: "unit-toggles-never-run-off-screen",
    why: "Client, iPhone 8: 'Inches' and 'LBS' ran off the right edge. The label row wraps and the toggle keeps its size on the right.",
    must: ['labelToggleRow: { flexDirection: "row", flexWrap: "wrap"', 'marginLeft: "auto"'],
    mustNot: ['labelToggleRow: { flexDirection: "row", alignItems: "center", gap: 8 }'],
  },
  {
    repo: "mobile",
    file: "src/features/search/components/ResultTabs.tsx",
    id: "search-result-counts-visible",
    why: "320pt + larger text cut 'Packages (1…' / 'Receivers (7…' - the count is the point of the tab.",
    must: ["adjustsFontSizeToFit", "minWidth: 0"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/search/components/SearchFilterFields.tsx",
    id: "search-country-chip-label-visible",
    why: "Android at larger text drew only the flag of '🇺🇸 USA' (bold text under-measured in a centred row).",
    must: ['styles.countryChipText} numberOfLines={1} textBreakStrategy="simple"'],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/features/messages/components/ChatOfferPrompt.tsx",
    id: "own-open-offer-can-be-changed",
    why: "Client: 'Waiting' shown for a long time with no way out. The person waiting on their own offer can Change it (the server supersedes their open offer). Same as mobile.",
    must: ['intent: "revise"', "Waiting for {counterpartName}…"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "supabase/functions/message-handler/routes/offers.ts",
    id: "offer-in-a-stale-currency-is-refused",
    why: "Client: the sender switched $ to ₹ while the carrier's chat still showed $; the carrier's typed '20' was stored as ₹20. An offer whose currency is not the parcel's is refused, naming the new currency (apps send the currency they showed).",
    must: ["export function offerCurrencyMismatch(", "if (mismatch) return errorResponse('CONFLICT', mismatch);", "if (seedMismatch) return errorResponse('CONFLICT', seedMismatch);"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "supabase/functions/parcel-handler/index.ts",
    id: "price-or-currency-change-is-told-in-chat",
    why: "A price/currency change posted nothing to the chat, so the other side's open chat kept the old price and currency.",
    must: ["priceLabel: formatMoney(", "storedCurrency(prior.fee_currency) !== storedCurrency(now.fee_currency)"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/features/messages/components/MatchAndDeclineModals.tsx",
    id: "web-offer-sends-the-currency-it-showed",
    why: "See offer-in-a-stale-currency-is-refused.",
    must: ["amount, currency, note, idempotencyKey", "amount, currency, note }"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/messages/chat/hooks/useChatOfferActions.ts",
    id: "mobile-offer-sends-the-currency-it-showed",
    why: "See offer-in-a-stale-currency-is-refused (web repo).",
    must: ["amount, currency, note }, attemptKey", "seedOffer({ amount, currency, note })", "void refetchActiveDeal?.();"],
    mustNot: [],
  },
  {
    repo: "web",
    file: ["supabase/migrations/20261023140000_buddy_trip_cap_in_db.sql", "supabase/functions/_shared/buddyRequests.ts", "supabase/functions/_shared/buddyTrips.ts"],
    id: "five-buddy-cap-is-a-database-rule",
    why: "Plan AD5/G5: the 5-buddies-per-trip cap was count-then-insert, so accepts racing for the last slot could add a 6th. A trigger locks the listing and refuses; the app puts the losing request back to pending.",
    must: ["BEFORE INSERT ON public.buddy_connections", "FOR UPDATE", "if (isBuddyTripFull(connErr))", "if (isBuddyTripFull(error))"],
    mustNot: [],
  },
  {
    repo: "web",
    file: ["supabase/functions/_shared/rateLimit.ts", "supabase/functions/trip-handler/index.ts", "supabase/functions/parcel-handler/index.ts", "supabase/functions/buddy-handler/index.ts"],
    id: "listing-creation-is-rate-limited",
    why: "Plan AJ1: creating trips/parcels/buddy listings had no limit, so one account could flood search with fake listings.",
    must: ["name: 'trip-create'", "name: 'parcel-create'", "name: 'buddy-create'", "ROUTE_LIMITS['trip-handler']", "ROUTE_LIMITS['parcel-handler']", "ROUTE_LIMITS['buddy-handler']"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/travels/MyTravelsScreen.styles.ts",
    id: "travels-action-buttons-stack-when-narrow",
    why: "320pt iPhone + larger text: 'Carry a P...' / 'Send a Pa...'. The two buttons stack below ~2x140pt.",
    must: ['actionsRow: { flexDirection: "row", flexWrap: "wrap"', "flexBasis: 140"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/wallet/TransactionsScreen.tsx",
    id: "payments-labels-never-broken-mid-word",
    why: "320pt + larger text: the 'Transactions' tile broke as 'Transacti / ons'; row labels cut to 'Refu...'.",
    must: ["minimumFontScale={0.7}", '<Text style={styles.txLabel} numberOfLines={2}>'],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/bookings/components/BookingRowSummary.tsx",
    id: "booking-status-pill-fits",
    why: "320pt + larger text: 'CANCELLED MID-T...'. The status shrinks to fit and the fee wraps below.",
    must: ["minimumFontScale={0.75}", 'flexWrap: "wrap",'],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/messages/inbox/ConversationRow.tsx",
    id: "inbox-status-pill-not-broken",
    why: "320pt + larger text: the 'Unmatched' pill broke as 'Unmatch / ed'.",
    must: ["borderRadius: 999, flexShrink: 0 }"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/components/ui/FormSection.tsx",
    id: "country-name-shrinks-before-cut",
    why: "320pt + larger text: 'United States' read 'Unite...' beside the Switch pill on every listing form.",
    must: ["numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}"],
    mustNot: [],
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
  // `file` may list several files when the pinned code was split across
  // modules (a page and the components/hooks extracted from it): they are
  // checked as one unit, so a needle may live in any of them.
  // `dir` checks EVERY source file in a folder - for rules that must also hold
  // for files added later (e.g. no data hook may drop a refresh).
  const files = c.dir
    ? (existsSync(join(HERE, c.dir)) ? readdirSync(join(HERE, c.dir)) : [])
        .filter((n) => /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n))
        .map((n) => `${c.dir}/${n}`)
    : Array.isArray(c.file) ? c.file : [c.file];
  if (c.dir && files.length === 0) {
    failures.push(`${c.id}: ${c.dir} has no source files.
      why: ${c.why}`);
    continue;
  }
  const missingFile = files.find((f) => !existsSync(join(HERE, f)));
  if (missingFile) {
    failures.push(`${c.id}: ${missingFile} is missing.\n      why: ${c.why}`);
    continue;
  }
  checked++;
  const code = files
    .map((f) => norm(stripComments(readFileSync(join(HERE, f), "utf8"))))
    .join(" \n ");

  for (const needle of c.must) {
    if (!code.includes(norm(needle))) {
      failures.push(
        `${c.id}  (${c.file ?? c.dir})\n      MISSING: ${needle}\n      why: ${c.why}`,
      );
    }
  }
  for (const needle of c.mustNot) {
    if (code.includes(norm(needle))) {
      failures.push(
        `${c.id}  (${c.file ?? c.dir})\n      REVERTED TO: ${needle}\n      why: ${c.why}`,
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
          `${c.id}  (${c.file ?? c.dir})\n      OUT OF ORDER: "${c.ordered[i - 1]}" must come BEFORE "${c.ordered[i]}"\n      why: ${c.why}`,
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
