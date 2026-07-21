export {
  api,
  ApiClientError,
  getErrorMessage,
  isAbortError,
  newIdempotencyKey,
} from "./client";
export type { ApiResponse, ApiError, QueryParams, QueryParamValue } from "./client";

export { authApi } from "./auth";
export type { AuthUser, AuthSession, AuthMethodInfo } from "./auth";

export { usersApi } from "./users";
export type { UserProfile, UserPreferences, UserStats } from "./users";

export { parcelsApi } from "./parcels";
export type {
  Parcel,
  ParcelListParams,
  ParcelCarrierMatch,
  DeliveryDateMode,
} from "./parcels";

export { tripsApi } from "./trips";
export type { Trip, TripListParams, TripParcelMatch } from "./trips";

export { carriersApi } from "./carriers";
export type { CarrierRequest } from "./carriers";

export { bookingsApi } from "./bookings";
export type { Booking, BookingDetailResponse } from "./bookings";

export { paymentsApi, isPayoutPending } from "./payments";
export type {
  Transaction,
  CreateIntentResult,
  ConfirmPaymentResult,
  StripeConnectStatus,
} from "./payments";

export { walletApi } from "./wallet";
export type { Wallet, SavedCard, Earnings } from "./wallet";

export { messagesApi } from "./messages";
export type {
  Conversation,
  Message,
  MessageKind,
  MessagePayload,
  OfferStatus,
  OfferCardPayload,
  OfferAcceptPayload,
  OfferRejectPayload,
  SystemEventName,
  SystemEventPayload,
  DeliveryHistoryItem,
  RNUploadFile,
} from "./messages";

export { offersApi } from "./offers";
export type {
  SeedOfferInput,
  SeedOfferResult,
  CounterOfferInput,
  CounterOfferResult,
  AcceptOfferResult,
  RejectOfferResult,
} from "./offers";

export { notificationsApi } from "./notifications";
export type { Notification } from "./notifications";

export { kycApi } from "./kyc";
export type {
  KycSubmission,
  KycSubmissionFile,
  KycDocType,
  KycFileType,
  KycUploadFile,
  KycSubmitInput,
} from "./kyc";

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
  SearchQuota,
  PackageMatch,
  BuddySearchMatch,
} from "./search";
