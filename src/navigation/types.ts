export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
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
        source?: "home" | "offers" | "messages" | "buddies";
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
  Trips: undefined;
  Buddies: undefined;
  BuddyDetailsTab: { buddyName: string };
  /** Travel-buddy listing form. `editId` set → load existing for edit. */
  CreateBuddyTab: { editId?: string } | undefined;
  Profile: undefined;
  WalletTab: undefined;
  AddCardTab: undefined;
  EarningsTab: undefined;
  KycVerificationTab: undefined;
  EditProfileTab: undefined;
  ReviewsTab: undefined;
  SettingsTab: undefined;
  PreferencesTab: undefined;
  ChangePasswordTab: undefined;
  ChangeEmailTab: undefined;
  ForgotPasswordTab: undefined;
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
        source?: "home" | "offers" | "messages" | "buddies";
      }
    | undefined;
  ParcelDetailsTab: { parcelId: string };
  /** Owner-facing detail for a travel-partner listing. Sourced from `my_listings`. */
  PartnerDetailsTab: { listingId: string };
  // New screens
  SearchTab: undefined;
  OpportunitiesTab: undefined;
  /** Optional `expandId` auto-expands the matching booking card on mount —
   *  used by notification deep-links (`/customer/bookings/:id`). Web parity:
   *  `/customer/bookings/:id` does not exist as a route in web; the equivalent
   *  is opening the list and revealing the row inline. */
  BookingsTab: { expandId?: string } | undefined;
  OtpVerificationTab: { bookingId: string };
  DeliveryReviewTab: { bookingId: string };
  DisputesTab: undefined;
  FileDisputeTab: { bookingId: string };
  SafetyAlertsTab: undefined;
  MatchTab: { type?: "parcel" | "buddy"; matchName?: string; route?: string };
  BuddyCompletionTab: { buddyName: string };
};
