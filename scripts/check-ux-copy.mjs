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
  // ------------------------------------------------- sign-in anti-enumeration
  {
    repo: "web",
    file: "src/components/auth/RoleLogin.tsx",
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
    file: "src/customer/pages/CustomerSearch.tsx",
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
    file: "src/customer/pages/CustomerSearch.tsx",
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
    file: "src/customer/pages/CustomerListTrip.tsx",
    id: "trip-validation-speaks-up",
    why: "The submit handler ended in a bare `return`. With only a size problem - whose warning renders sections above the button - pressing Submit produced no request, no toast and no focus change, which reads as a dead button.",
    must: ["focusFirstFormError()", "Size exceeds airline carry-on limit"],
    mustNot: ["if (Object.keys(errs).length > 0 || hasSizeError) return;"],
  },
  {
    repo: "web",
    file: "src/customer/pages/CustomerSendParcel.tsx",
    id: "parcel-validation-speaks-up",
    why: "Same silent-return bug as the trip form; mobile already scrolled to the offending field.",
    must: ["focusFirstFormError()", "Size exceeds airline carry-on limit"],
    mustNot: ["if (Object.keys(errs).length > 0 || hasSizeError) return;"],
  },

  // ------------------------------------------------------- one rating per booking
  {
    repo: "web",
    file: "src/customer/pages/CustomerRateDelivery.tsx",
    id: "rating-reflects-existing",
    why: "The API already returns `viewer_has_rated`; the page ignored it and offered a blank star rating to someone who had already reviewed, who then hit a CONFLICT after filling it in.",
    must: ["booking.viewer_has_rated", "You already reviewed this delivery"],
    mustNot: [],
  },
  // ------------------------------------------- a listing's owner can act on it
  {
    repo: "web",
    file: "src/customer/pages/CustomerParcelDetail.tsx",
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
    file: "src/customer/pages/CustomerSendParcel.tsx",
    id: "receive-request-opens-my-packages",
    why: "Client-reported: posting a receive request dropped you on My Flights. /customer/my-trips with no ?tab falls back to 'flights', so the CTA must name its tab rather than lean on the default.",
    must: ["my-trips?tab=packages"],
    mustNot: ['navigate("/customer/my-trips")'],
  },
  {
    repo: "web",
    file: "src/customer/pages/CustomerCreateBuddy.tsx",
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
    file: "src/customer/pages/CustomerMessages.tsx",
    id: "pin-reads-live-offer-from-thread",
    why: "Client-reported: an OPEN $49 counter sat in the thread with Accept/Counter/Decline directly above a bar reading 'Receiver listed this delivery at $45. [Accept $45]'. activeDeal is a SEPARATE fetch from the messages, so while it lagged the two halves of one screen gave different answers and the bar quoted the stale one. The timeline reconciles every card and arrives with the message, so it answers first - which is what mobile has always done (resolveOffers).",
    must: ["const liveOffer", "offerResolutions.get", "liveOffer={liveOffer}"],
    mustNot: [],
  },
  {
    repo: "web",
    file: "src/customer/components/ChatOfferPrompt.tsx",
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
    file: "supabase/functions/message-handler/index.ts",
    id: "offer-card-status-cannot-freeze",
    why: "The offer_card message is written AFTER the offer row with the status captured at insert. A counter landing in that window supersedes the offer and runs its own card sync, which finds no card yet and silently does nothing - freezing the card at 'open' on a dead offer forever. Two such rows existed in production. Re-read once the card exists and correct it.",
    must: ["settled.status !== offer.status", "syncOfferCardStatus(supabase, offer.id"],
    mustNot: [],
  },
  // ------------------------- the parcel review names the person, not just the role
  {
    repo: "web",
    file: "src/customer/components/ChatParcelReviewPrompt.tsx",
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
    file: "src/customer/components/ChatDealSwitcher.tsx",
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
    file: "src/customer/pages/CustomerMessages.tsx",
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
    file: "src/customer/pages/CustomerMessages.tsx",
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
    file: "src/customer/layouts/CustomerLayout.tsx",
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
    file: "src/components/auth/RoleLogin.tsx",
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
    file: "src/customer/pages/CustomerBookings.tsx",
    id: "retry-does-not-reboot-the-app",
    why: "Try Again ran window.location.reload(), throwing away every other piece of app state to retry one request - and on a genuinely offline device a reload cannot fetch the document at all, which would strand the user on a browser error page instead of the app.",
    must: ["refetch()"],
    mustNot: ["window.location.reload"],
  },
  {
    repo: "web",
    file: "src/customer/pages/CustomerMyTrips.tsx",
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
  // ------------- travel buddy: the connect action that was never wired to the UI
  {
    repo: "web",
    file: "src/customer/pages/CustomerSearch.tsx",
    id: "buddy-match-can-connect",
    why: "The whole Travel Buddy lifecycle - request, accept, connection, two-tap journey completion, mutual rating - was built and deployed in buddy-handler, and `useSendBuddyRequest` existed, but NOTHING in either app ever called it. A buddy match offered only View profile and Start chat, and a chat creates no connection. Production proved it: 0 buddy_requests, 0 buddy_connections and 0 buddy ratings against 12 delivery ratings. Remove this and the feature dead-ends again.",
    must: ["useSendBuddyRequest", "buddyListingId", "handleConnect"],
    mustNot: [],
  },
  {
    repo: "mobile",
    file: "src/features/search/SearchScreen.tsx",
    id: "buddy-match-can-connect",
    why: "Same missing entry point on mobile - the two platforms must not drift on the only action that starts a buddy connection.",
    must: ["buddiesApi.sendRequest", "handleConnect"],
    mustNot: [],
  },
  // ---------------- travel buddy: exactly one production path, no local fakes
  {
    repo: "mobile",
    file: "src/navigation/RootNavigator.tsx",
    id: "no-fake-buddy-screens",
    why: "Two unreachable screens shipped inside the app and both lied. BuddyDetailsScreen had a Connect button that called `toggleBuddyConnection(name)` - a local zustand toggle over seed data that never touched the server. BuddyCompletionScreen defaulted the buddy to the seed name 'Sarah K.', hardcoded the reviewer as 'Alex Johnson', wrote the review with `addReview` into local state and toasted 'Review submitted!' while nothing reached the API. Both were registered in the navigator, so any deep link or future wiring would expose them. The real paths are SearchScreen -> buddiesApi.sendRequest and MyTravelsScreen -> ratingsApi.rateBuddy.",
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
