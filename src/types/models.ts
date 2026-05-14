export type ParcelStatus = "open" | "in_transit" | "delivered" | "disputed";

export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "disputed";

export type DisputeStatus = "open" | "investigating" | "resolved" | "escalated";
export type DisputeCategory =
  | "damaged"
  | "late_delivery"
  | "wrong_items"
  | "missing_items"
  | "no_show"
  | "other";

export type KycStatus = "not_started" | "pending" | "verified" | "rejected";

export type UserRole = "carrier" | "receive" | "travel_buddy";

export interface Parcel {
  id: string;
  from: string;
  to: string;
  weight: string;
  fee: string;
  date: string;
  category: string;
  sender: string;
  status: ParcelStatus;
  desc?: string;
}

export interface Trip {
  id: string;
  from: string;
  to: string;
  date: string;
  capacity: string;
  offers: number;
  earnings: string;
  buddyAvailable?: boolean;
}

export interface TravelBuddy {
  name: string;
  route: string;
  date: string;
  rating: number;
  trips: number;
  avatar: string;
  bio: string;
  connected: boolean;
  languages?: string[];
  verified?: boolean;
}

export interface ChatAttachment {
  id: string;
  type: "image" | "pdf" | "document";
  name: string;
  size?: string;
  uri?: string;
}

export interface ChatMessage {
  id?: string;
  from: "me" | "them";
  text: string;
  time: string;
  attachment?: ChatAttachment;
  type?: "text" | "system" | "cta";
  ctaType?: "match" | "decline" | "otp" | "payment";
}

export interface MessageThread {
  name: string;
  last: string;
  time: string;
  unread: number;
  avatar: string;
  messages: ChatMessage[];
  conversationType?: "booking" | "buddy";
  status?: "active" | "matched" | "declined" | "blocked";
}

export interface NotificationItem {
  title: string;
  desc: string;
  time: string;
  read: boolean;
  type?: "match" | "delivery" | "payment" | "safety" | "system";
}

export interface Booking {
  id: string;
  parcelId: string;
  carrierId: string;
  carrierName: string;
  receiverId: string;
  receiverName: string;
  from: string;
  to: string;
  status: BookingStatus;
  amount: string;
  date: string;
  otp?: string;
  otpVerified?: boolean;
  pickupDate?: string;
  deliveryDate?: string;
  timeline: BookingTimelineEvent[];
}

export interface BookingTimelineEvent {
  status: string;
  label: string;
  date: string;
  completed: boolean;
}

export interface Dispute {
  id: string;
  bookingId: string;
  category: DisputeCategory;
  description: string;
  status: DisputeStatus;
  date: string;
  evidence?: string[];
  messages: DisputeMessage[];
}

export interface DisputeMessage {
  from: "user" | "support";
  text: string;
  time: string;
}

export interface Bid {
  id: string;
  parcelId: string;
  carrierId: string;
  carrierName: string;
  carrierRating: number;
  carrierTrips: number;
  amount: string;
  message?: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
}

export interface Opportunity {
  id: string;
  parcelId: string;
  from: string;
  to: string;
  weight: string;
  fee: string;
  date: string;
  category: string;
  senderName: string;
  senderRating: number;
}

export interface Review {
  id: string;
  bookingId: string;
  reviewerName: string;
  reviewerAvatar: string;
  rating: number;
  text: string;
  date: string;
}

export interface SafetyAlert {
  id: string;
  type: "kyc_failure" | "account_restricted" | "suspicious_activity" | "referral_blocked";
  title: string;
  message: string;
  severity: "warning" | "danger" | "info";
  date: string;
  actionLabel?: string;
  dismissed?: boolean;
}
