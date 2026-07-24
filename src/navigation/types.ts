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
        source?: "home" | "offers" | "messages" | "buddies" | "travels";
      }
    | undefined;
  SendParcel: undefined;
  ListTrip: undefined;
  Wallet: undefined;
  Reviews: undefined;
  Earnings: undefined;
  KycVerification: undefined;
  EditProfile: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  ActivityTab: undefined;
  MessagesTab: undefined;
  Notifications: undefined;
  Parcels: undefined;
  /** `highlightId` deep-links a specific match card from a match-found
   *  notification (web parity: `/customer/search?match=<id>`). */
  Trips: { highlightId?: string } | undefined;
  Buddies: undefined;
  BuddyDetailsTab: { buddyName: string };
  /** Travel-buddy listing form. Editing happens in `EditBuddyListingModal`. */
  CreateBuddyTab: undefined;
  Profile: undefined;
  WalletTab: undefined;
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
  OffersTab: undefined;
  OfferChatTab:
    | {
        /** Real Supabase conversation id — when set, the chat loads server messages. */
        conversationId?: string;
        /** Display name + parcel kept for legacy callers (mock flow). */
        name: string;
        parcel?: string;
        source?: "home" | "offers" | "messages" | "buddies" | "travels";
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
  OtpVerificationTab: { bookingId: string };
  DeliveryReviewTab: { bookingId: string };
  /** Read-only record of a completed delivery, incl. the journey timeline. */
  DeliveryDetailsTab: { bookingId: string };
  DisputesTab: undefined;
  /** `bookingId` preselects the booking (from chat); omitted → the form shows a
   *  booking picker (web parity). */
  FileDisputeTab: { bookingId?: string } | undefined;
  SafetyAlertsTab: undefined;
  MatchTab: { type?: "parcel" | "buddy"; matchName?: string; route?: string };
  BuddyCompletionTab: { buddyName: string };
};
