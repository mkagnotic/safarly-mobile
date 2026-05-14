export {
  api,
  ApiClientError,
  getErrorMessage,
  isAbortError,
} from "./client";
export type { ApiResponse, ApiError, QueryParams, QueryParamValue } from "./client";

export { authApi } from "./auth";
export type { AuthUser, AuthSession } from "./auth";

export { usersApi } from "./users";
export type { UserProfile, UserPreferences, UserStats } from "./users";

export { parcelsApi } from "./parcels";
export type { Parcel, ParcelListParams } from "./parcels";

export { tripsApi } from "./trips";
export type { Trip, TripListParams } from "./trips";

export { carriersApi } from "./carriers";
export type { CarrierRequest } from "./carriers";

export { bookingsApi } from "./bookings";
export type { Booking, BookingDetailResponse } from "./bookings";

export { paymentsApi } from "./payments";
export type { Transaction } from "./payments";

export { walletApi } from "./wallet";
export type { Wallet, SavedCard, Earnings } from "./wallet";

export { messagesApi } from "./messages";
export type {
  Conversation,
  Message,
  DeliveryHistoryItem,
  RNUploadFile,
} from "./messages";

export { notificationsApi } from "./notifications";
export type { Notification } from "./notifications";

export { kycApi } from "./kyc";
export type { KycSubmission } from "./kyc";

export { ratingsApi } from "./ratings";
export type { Rating, UserRatings } from "./ratings";

export { buddiesApi } from "./buddies";
export type {
  BuddyListing,
  BuddyListingUser,
  BuddyListingInput,
  BuddyRequest,
  BuddyConnection,
  BuddyMatch,
} from "./buddies";

export { disputesApi } from "./disputes";
export type { Dispute } from "./disputes";

export { adminApi } from "./admin";
export type {
  AdminStats,
  AdminUser,
  AdminSettings,
  AuditLogEntry,
  HealthCheckResponse,
} from "./admin";

export { cmsApi } from "./cms";
export type {
  CmsPage,
  BlogPost,
  CareerPosition,
  PlatformStats,
  Testimonial,
} from "./cms";

export { feedApi } from "./feed";
export type { FeedItem } from "./feed";

export { searchApi } from "./search";
export type {
  SearchFilters,
  SearchResults,
  SearchMeta,
  PackageMatch,
  BuddySearchMatch,
} from "./search";
