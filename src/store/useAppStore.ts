import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  seedBuddies,
  seedMessages,
  seedNotifications,
  seedParcels,
  seedTrips,
  seedBookings,
  seedDisputes,
  seedBids,
  seedOpportunities,
  seedReviews,
  seedSafetyAlerts,
} from "@/store/seedData";
import type { AppState, KycStatus, PaymentMethod, UserProfile } from "@/store/types";
import type { AppLanguage } from "@/i18n/translations";
import type { AppTimeFormat, AppTimeZone } from "@/features/profile/preferencesConfig";
import type { MessageThread, NotificationItem, Parcel, TravelBuddy } from "@/types/models";

function normalizeArrows(text: string): string {
  return text.replaceAll("\u002d\u003e", "\u2192");
}

function mergeSeedParcels(existing: Parcel[] = []): Parcel[] {
  const seen = new Set(existing.map((parcel) => parcel.id));
  const missingSeed = seedParcels.filter((parcel) => !seen.has(parcel.id));
  return [...existing, ...missingSeed];
}

function mergeSeedMessages(existing: MessageThread[] = []): MessageThread[] {
  const seen = new Set(existing.map((thread) => thread.name));
  const missingSeed = seedMessages.filter((thread) => !seen.has(thread.name));
  return [...existing, ...missingSeed];
}

function normalizeNotifications(existing: NotificationItem[] = []): NotificationItem[] {
  return existing.map((item) => ({
    ...item,
    title: normalizeArrows(item.title),
    desc: normalizeArrows(item.desc),
  }));
}

function mergeSeedBuddies(existing: TravelBuddy[] = []): TravelBuddy[] {
  const normalizedExisting = existing.map((buddy) => ({ ...buddy, connected: Boolean(buddy.connected) }));
  const seen = new Set(normalizedExisting.map((buddy) => buddy.name));
  const missingSeed = seedBuddies.filter((buddy) => !seen.has(buddy.name));
  return [...normalizedExisting, ...missingSeed];
}

const defaultUserProfile: UserProfile = {
  fullName: "Alex Johnson",
  email: "alex@email.com",
  phone: "+1 206 555 0123",
  bio: "Frequent traveler between US and India",
  city: "Seattle",
  country: "United States",
  kycStatus: "verified",
  rating: 4.8,
  totalTrips: 20,
  responseRate: 95,
  onTimeRate: 98,
  activeRole: "carrier",
};

/**
 * Coerce the API's free-form `kyc_status` string into the closed local union.
 * Falls back to "not_started" so unknown values can never poison the type.
 */
function normalizeKycStatus(value: string | null | undefined): KycStatus {
  if (value === "pending" || value === "verified" || value === "rejected") return value;
  return "not_started";
}

function normalizePaymentMethods(existing: PaymentMethod[] = []): PaymentMethod[] {
  return existing.map((method, index) => ({
    ...method,
    isDefault: index === 0 ? true : Boolean(method.isDefault),
  }));
}

const initialState = {
  splashDone: false,
  onboarded: false,
  profileSetupDone: false,
  authenticated: false,
  showLiveData: false,
  userProfile: defaultUserProfile,
  paymentMethods: [],
  walletBalance: 245.5,
  language: "en-US" as AppLanguage,
  timeFormat: "12h" as AppTimeFormat,
  timeZone: "America/New_York" as AppTimeZone,
  parcels: seedParcels,
  trips: seedTrips,
  buddies: seedBuddies,
  messages: seedMessages,
  notifications: seedNotifications,
  bookings: seedBookings,
  disputes: seedDisputes,
  bids: seedBids,
  opportunities: seedOpportunities,
  reviews: seedReviews,
  safetyAlerts: seedSafetyAlerts,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setSplashDone: () => set({ splashDone: true }),
      finishOnboarding: () => set({ onboarded: true }),
      finishProfileSetup: () => set({ profileSetupDone: true }),
      login: () => set({ authenticated: true }),
      logout: () => set({ authenticated: false, profileSetupDone: false }),
      toggleLiveDataVisibility: () => set((state) => ({ showLiveData: !state.showLiveData })),
      setLiveDataVisibility: (visible) => set({ showLiveData: visible }),
      setLanguage: (language) => set({ language }),
      setTimeFormat: (timeFormat) => set({ timeFormat }),
      setTimeZone: (timeZone) => set({ timeZone }),
      setWalletBalance: (nextBalance) => set({ walletBalance: Math.max(0, nextBalance) }),
      adjustWalletBalance: (delta) =>
        set((state) => ({ walletBalance: Math.max(0, state.walletBalance + delta) })),
      addPaymentMethod: (method) =>
        set((state) => {
          const hasDefault = state.paymentMethods.some((m) => m.isDefault);
          const newMethod: PaymentMethod = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            ...method,
            isDefault: !hasDefault,
          };
          return { paymentMethods: [newMethod, ...state.paymentMethods] };
        }),
      addNotification: (item) =>
        set((state) => {
          const nextItem: NotificationItem = {
            title: item.title,
            desc: item.desc,
            time: item.time,
            read: item.read ?? false,
            type: item.type,
          };
          return { notifications: [nextItem, ...state.notifications] };
        }),
      updateUserProfile: (patch) =>
        set((state) => ({ userProfile: { ...state.userProfile, ...patch } })),
      setUserProfileFromApi: (apiProfile, email) =>
        set((state) => ({
          userProfile: {
            ...state.userProfile,
            fullName: apiProfile.name ?? "",
            email,
            bio: apiProfile.bio ?? "",
            avatar: apiProfile.avatar_url ?? undefined,
            city: apiProfile.city ?? undefined,
            country: apiProfile.country ?? undefined,
            kycStatus: normalizeKycStatus(apiProfile.kyc_status),
            rating: apiProfile.rating ?? 0,
            totalTrips: apiProfile.total_trips ?? 0,
            totalDeliveries: apiProfile.total_deliveries ?? 0,
            responseRate: apiProfile.response_rate ?? 0,
            onTimeRate: apiProfile.on_time_rate ?? 0,
          },
        })),
      addParcel: (parcel) => set((state) => ({ parcels: [parcel, ...state.parcels] })),
      addTrip: (trip) => set((state) => ({ trips: [trip, ...state.trips] })),
      toggleBuddyConnection: (buddyName) =>
        set((state) => ({
          buddies: state.buddies.map((buddy) =>
            buddy.name === buddyName ? { ...buddy, connected: !buddy.connected } : buddy
          ),
        })),
      addBooking: (booking) => set((state) => ({ bookings: [booking, ...state.bookings] })),
      updateBookingStatus: (bookingId, status) =>
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  status,
                  timeline: b.timeline.map((t) => {
                    const statusOrder = ["created", "payment", "pickup", "in_transit", "delivered", "reviewed"];
                    const targetIdx = statusOrder.indexOf(status === "confirmed" ? "payment" : status === "picked_up" ? "pickup" : status);
                    const currentIdx = statusOrder.indexOf(t.status);
                    return currentIdx <= targetIdx ? { ...t, completed: true } : t;
                  }),
                }
              : b
          ),
        })),
      verifyOtp: (bookingId, otp) => {
        const booking = get().bookings.find((b) => b.id === bookingId);
        if (booking && booking.otp === otp) {
          set((state) => ({
            bookings: state.bookings.map((b) =>
              b.id === bookingId
                ? { ...b, status: "delivered" as const, otpVerified: true, deliveryDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) }
                : b
            ),
          }));
          return true;
        }
        return false;
      },
      addDispute: (dispute) => set((state) => ({ disputes: [dispute, ...state.disputes] })),
      updateDisputeStatus: (disputeId, status) =>
        set((state) => ({
          disputes: state.disputes.map((d) =>
            d.id === disputeId ? { ...d, status } : d
          ),
        })),
      addBid: (bid) => set((state) => ({ bids: [bid, ...state.bids] })),
      updateBidStatus: (bidId, status) =>
        set((state) => ({
          bids: state.bids.map((b) =>
            b.id === bidId ? { ...b, status } : b
          ),
        })),
      addReview: (review) => set((state) => ({ reviews: [review, ...state.reviews] })),
      dismissSafetyAlert: (alertId) =>
        set((state) => ({
          safetyAlerts: state.safetyAlerts.map((a) =>
            a.id === alertId ? { ...a, dismissed: true } : a
          ),
        })),
      addMessageToThread: (threadName, message) =>
        set((state) => ({
          messages: state.messages.map((thread) =>
            thread.name === threadName
              ? {
                  ...thread,
                  messages: [...thread.messages, { ...message, id: `msg-${Date.now()}` }],
                  last: message.text,
                  time: "Just now",
                }
              : thread
          ),
        })),
      updateThreadStatus: (threadName, status) =>
        set((state) => ({
          messages: state.messages.map((thread) =>
            thread.name === threadName ? { ...thread, status } : thread
          ),
        })),
      setActiveRole: (role) =>
        set((state) => ({ userProfile: { ...state.userProfile, activeRole: role } })),
    }),
    {
      name: "safarly-mobile-store",
      // v11: one-time onboarding replay — `migrate` resets `onboarded` so any
      // install persisted at an older version shows the onboarding flow again
      // exactly once. After the user finishes it, `finishOnboarding` re-persists
      // `onboarded: true` under v11 and it stays one-time from then on.
      version: 11,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState: unknown) => {
        if (!persistedState || typeof persistedState !== "object") return persistedState as AppState;
        const state = persistedState as Partial<AppState> & { userProfile?: UserProfile };
        const userProfile = state.userProfile ?? defaultUserProfile;
        return {
          ...state,
          userProfile,
          // One-time replay (see version note above).
          onboarded: false,
          profileSetupDone: state.profileSetupDone ?? false,
          paymentMethods: normalizePaymentMethods(state.paymentMethods),
          parcels: mergeSeedParcels(state.parcels),
          buddies: mergeSeedBuddies(state.buddies),
          messages: mergeSeedMessages(state.messages),
          notifications: normalizeNotifications(state.notifications),
          bookings: state.bookings ?? seedBookings,
          disputes: state.disputes ?? seedDisputes,
          bids: state.bids ?? seedBids,
          opportunities: state.opportunities ?? seedOpportunities,
          reviews: state.reviews ?? seedReviews,
          safetyAlerts: state.safetyAlerts ?? seedSafetyAlerts,
          language: (state.language as AppLanguage | undefined) ?? "en-US",
          timeFormat: (state.timeFormat as AppTimeFormat | undefined) ?? "12h",
          timeZone: (state.timeZone as AppTimeZone | undefined) ?? "America/New_York",
        };
      },
      partialize: (state) => ({
        onboarded: state.onboarded,
        profileSetupDone: state.profileSetupDone,
        authenticated: state.authenticated,
        showLiveData: state.showLiveData,
        userProfile: state.userProfile,
        paymentMethods: state.paymentMethods,
        parcels: state.parcels,
        trips: state.trips,
        buddies: state.buddies,
        messages: state.messages,
        notifications: state.notifications,
        bookings: state.bookings,
        disputes: state.disputes,
        bids: state.bids,
        opportunities: state.opportunities,
        reviews: state.reviews,
        safetyAlerts: state.safetyAlerts,
        walletBalance: state.walletBalance,
        language: state.language,
        timeFormat: state.timeFormat,
        timeZone: state.timeZone,
      }),
    }
  )
);
