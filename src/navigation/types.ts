export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  /** Pre-auth password recovery. `email` pre-fills from the sign-in form. */
  ForgotPassword: { email?: string } | undefined;
  /** Enter the emailed recovery code + a new password. `email` is required
   *  because `verifyOtp` needs it alongside the code. */
  ResetPassword: { email: string };
  /** Signup email confirmation — enter the 6-digit code from the welcome email. */
  VerifyEmail: { email: string };
  AuthBootstrap: undefined;
  ProfileSetup: undefined;
  MainTabs: undefined;
  OfferChatTab:
    | {
        /** Real Supabase conversation id — when set, the chat loads server messages. */
        conversationId?: string;
        /** Display name + parcel kept for legacy callers (mock flow). */
        name: string;
        parcel?: string;
        source?: "home" | "messages" | "buddies" | "travels";
      }
    | undefined;
  SendParcel: undefined;
  ListTrip: undefined;
  Reviews: undefined;
  Earnings: undefined;
  KycVerification: undefined;
  EditProfile: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
  /** Company + platform information (web parity: `/about`). */
  About: undefined;
  /** Company contact details (web parity: `/contact`). */
  Contact: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  ActivityTab: undefined;
  MessagesTab: undefined;
  Notifications: undefined;
  /** My Travels. `tab` opens it on a specific list - a new parcel belongs in
   *  "packages", not the default "flights". */
  Parcels: { tab?: "flights" | "packages" | "partners" | "archive" } | undefined;
  /** `highlightId` deep-links a specific match card from a match-found
   *  notification (web parity: `/customer/search?match=<id>`).
   *  `tab` says WHICH results tab the notification is about — a carrier told
   *  "3 parcels match your trip" must land on Receiver Requests, not the default
   *  Package Delivery Matches (web parity: `&tab=receiver`). */
  Trips: { highlightId?: string; tab?: "package" | "receiver" | "buddy" } | undefined;
  Buddies: undefined;
  /** Travel-buddy listing form. Editing happens in `EditBuddyListingModal`. */
  CreateBuddyTab: undefined;
  Profile: undefined;
  /** Standalone Stripe Connect payout management (web `CustomerPayoutSetup`). */
  PayoutSetupTab: undefined;
  /** Payments / transaction history (web `CustomerTransactions`). */
  TransactionsTab: undefined;
  AddCardTab: undefined;
  EarningsTab: undefined;
  KycVerificationTab: undefined;
  EditProfileTab: undefined;
  ReviewsTab: undefined;
  SettingsTab: undefined;
  /** Security hub — lists Email + Change Password (web AccountSecuritySettings parity). */
  SecurityTab: undefined;
  PreferencesTab: undefined;
  ChangePasswordTab: undefined;
  ChangeEmailTab: undefined;
  /** Same screen as the root stack's `ForgotPassword`, reached from Change Password. */
  ForgotPasswordTab: { email?: string } | undefined;
  SendParcelTab: undefined;
  ReviewPayTab: {
    draft: {
      from: string;
      to: string;
      weight: string;
      fee: string;
      category: string;
    };
  };
  PaymentSuccessTab: {
    amount: string;
  };
  PaymentFailureTab: undefined;
  ListTripTab: { source?: "home" | "trips" } | undefined;
  ListTripSuccessTab: undefined;
  TripDetailsTab: { tripId: string };
  OfferChatTab:
    | {
        /** Real Supabase conversation id — when set, the chat loads server messages. */
        conversationId?: string;
        /** Display name + parcel kept for legacy callers (mock flow). */
        name: string;
        parcel?: string;
        source?: "home" | "messages" | "buddies" | "travels";
      }
    | undefined;
  ParcelDetailsTab: { parcelId: string };
  /** Owner-facing detail for a travel-partner listing. Sourced from `my_listings`. */
  PartnerDetailsTab: { listingId: string };
  /** Read-only public profile of another user (carrier / sender / buddy). */
  PublicProfileTab: { userId: string; name?: string };
  // New screens
  SearchTab: undefined;
  OpportunitiesTab: undefined;
  /** Optional `expandId` auto-expands the matching booking card on mount —
   *  used by notification deep-links (`/customer/bookings/:id`). Web parity:
   *  `/customer/bookings/:id` does not exist as a route in web; the equivalent
   *  is opening the list and revealing the row inline. */
  BookingsTab: { expandId?: string } | undefined;
  /** Escrow payment screen for a booking in `pending_payment` (sender-only). */
  PayBookingTab: { bookingId: string };
  DeliveryReviewTab: { bookingId: string };
  /** Read-only record of a completed delivery, incl. the journey timeline. */
  DeliveryDetailsTab: { bookingId: string };
  DisputesTab: undefined;
  /** `bookingId` preselects the booking (from chat); omitted → the form shows a
   *  booking picker (web parity). */
  FileDisputeTab: { bookingId?: string } | undefined;
  SafetyAlertsTab: undefined;
  MatchTab: { type?: "parcel" | "buddy"; matchName?: string; route?: string };
};
