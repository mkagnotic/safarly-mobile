import type { UserProfile as ApiUserProfile } from "@/services/api";
import type {
  Bid,
  Booking,
  BookingStatus,
  Dispute,
  MessageThread,
  NotificationItem,
  Opportunity,
  Parcel,
  Review,
  SafetyAlert,
  TravelBuddy,
  Trip,
  UserRole,
} from "@/types/models";
import type { AppLanguage } from "@/i18n/translations";
import type { AppTimeFormat, AppTimeZone } from "@/features/profile/preferencesConfig";

export type KycStatus = "not_started" | "pending" | "verified" | "rejected";

/**
 * Cross-screen inline notice. Set on the source screen before navigating;
 * the destination renders it via `<FormBanner />` and calls `clearPendingNotice`
 * on dismiss. Used in place of toasts for flows like signup → login.
 */
export type PendingNotice = {
  variant: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
  /** Optional screen key — destination can choose to ignore notices not addressed to it. */
  target?: "login" | "home" | "profile-setup";
};

export type UserProfile = {
  fullName: string;
  email: string;
  phone: string;
  bio: string;
  avatar?: string;
  city?: string;
  country?: string;
  kycStatus?: KycStatus;
  rating?: number;
  totalTrips?: number;
  /** Number of completed deliveries — present on the API profile, kept in store for cross-screen reads. */
  totalDeliveries?: number;
  responseRate?: number;
  onTimeRate?: number;
  activeRole?: UserRole;
};

export type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
};

export interface AppState {
  splashDone: boolean;
  onboarded: boolean;
  profileSetupDone: boolean;
  authenticated: boolean;
  /** Transient — true while AuthContext fetches the server profile after sign-in to decide whether to show ProfileSetup. */
  authBootstrapping: boolean;
  showLiveData: boolean;
  userProfile: UserProfile;
  parcels: Parcel[];
  trips: Trip[];
  buddies: TravelBuddy[];
  messages: MessageThread[];
  notifications: NotificationItem[];
  bookings: Booking[];
  disputes: Dispute[];
  bids: Bid[];
  opportunities: Opportunity[];
  reviews: Review[];
  safetyAlerts: SafetyAlert[];
  paymentMethods: PaymentMethod[];
  walletBalance: number;
  language: AppLanguage;
  timeFormat: AppTimeFormat;
  timeZone: AppTimeZone;
  /** Transient — not persisted. See `PendingNotice`. */
  pendingNotice: PendingNotice | null;

  // Actions
  setSplashDone: () => void;
  setPendingNotice: (notice: PendingNotice | null) => void;
  clearPendingNotice: () => void;
  finishOnboarding: () => void;
  finishProfileSetup: () => void;
  setProfileSetupDone: (done: boolean) => void;
  setAuthBootstrapping: (bootstrapping: boolean) => void;
  login: () => void;
  logout: () => void;
  toggleLiveDataVisibility: () => void;
  setLiveDataVisibility: (visible: boolean) => void;
  setLanguage: (language: AppLanguage) => void;
  setTimeFormat: (timeFormat: AppTimeFormat) => void;
  setTimeZone: (timeZone: AppTimeZone) => void;
  setWalletBalance: (nextBalance: number) => void;
  adjustWalletBalance: (delta: number) => void;
  addPaymentMethod: (method: Omit<PaymentMethod, "id" | "isDefault">) => void;
  addNotification: (item: Omit<NotificationItem, "read"> & { read?: boolean }) => void;
  updateUserProfile: (patch: Partial<UserProfile>) => void;
  /** Replace the profile slice from a freshly-fetched API profile, preserving only fields the API doesn't own (e.g. `phone`). */
  setUserProfileFromApi: (apiProfile: ApiUserProfile, email: string) => void;
  addParcel: (parcel: Parcel) => void;
  addTrip: (trip: Trip) => void;
  toggleBuddyConnection: (buddyName: string) => void;
  addBooking: (booking: Booking) => void;
  updateBookingStatus: (bookingId: string, status: BookingStatus) => void;
  verifyOtp: (bookingId: string, otp: string) => boolean;
  addDispute: (dispute: Dispute) => void;
  updateDisputeStatus: (disputeId: string, status: Dispute["status"]) => void;
  addBid: (bid: Bid) => void;
  updateBidStatus: (bidId: string, status: Bid["status"]) => void;
  addReview: (review: Review) => void;
  dismissSafetyAlert: (alertId: string) => void;
  addMessageToThread: (threadName: string, message: { from: "me" | "them"; text: string; time: string }) => void;
  updateThreadStatus: (threadName: string, status: MessageThread["status"]) => void;
  setActiveRole: (role: UserRole) => void;
}
