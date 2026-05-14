import type {
  Bid,
  Booking,
  Dispute,
  MessageThread,
  NotificationItem,
  Opportunity,
  Parcel,
  Review,
  SafetyAlert,
  TravelBuddy,
  Trip,
} from "@/types/models";

export const seedParcels: Parcel[] = [
  { id: "PKG-2847", from: "New York", to: "Mumbai", weight: "2.5 kg", fee: "$45", date: "Mar 18", category: "Electronics", sender: "Priya Sharma", status: "in_transit", desc: "iPhone 15 Pro Max, sealed box." },
  { id: "PKG-2846", from: "San Francisco", to: "Bangalore", weight: "1.2 kg", fee: "$32", date: "Mar 17", category: "Documents", sender: "Anita Desai", status: "open", desc: "Legal documents in sealed envelope." },
  { id: "PKG-2845", from: "Los Angeles", to: "Chennai", weight: "3.0 kg", fee: "$58", date: "Mar 16", category: "Clothing", sender: "Mike Chen", status: "delivered", desc: "Festival wear, vacuum packed." },
  { id: "PKG-2844", from: "Toronto", to: "Delhi", weight: "2.1 kg", fee: "$41", date: "Mar 15", category: "Medicines", sender: "Neha Kapoor", status: "in_transit", desc: "OTC medicines and supplements." },
  { id: "PKG-2843", from: "London", to: "Hyderabad", weight: "0.9 kg", fee: "$27", date: "Mar 14", category: "Documents", sender: "Arjun Rao", status: "open", desc: "University transcripts in hard case." },
  { id: "PKG-2842", from: "Dubai", to: "Pune", weight: "1.6 kg", fee: "$36", date: "Mar 13", category: "Gadgets", sender: "Sara Ali", status: "disputed", desc: "Bluetooth speaker with billing mismatch." },
  { id: "PKG-2841", from: "Singapore", to: "Kolkata", weight: "2.8 kg", fee: "$52", date: "Mar 12", category: "Kitchen", sender: "Ravi Mehta", status: "delivered", desc: "Cookware set, fragile handling requested." },
];

export const seedTrips: Trip[] = [
  { id: "T1", from: "Seattle", to: "Hyderabad", date: "Mar 30", capacity: "5 kg", offers: 3, earnings: "$135", buddyAvailable: true },
  { id: "T2", from: "NYC", to: "Mumbai", date: "Apr 8", capacity: "3 kg", offers: 1, earnings: "$45", buddyAvailable: false },
];

export const seedBuddies: TravelBuddy[] = [
  { name: "Sarah K.", route: "NYC \u2192 Mumbai", date: "Mar 25", rating: 4.8, trips: 12, avatar: "S", bio: "Frequent flyer between NYC and Mumbai.", connected: true, languages: ["English", "Hindi"], verified: true },
  { name: "Rahul M.", route: "SF \u2192 Bangalore", date: "Mar 28", rating: 4.9, trips: 24, avatar: "R", bio: "Software engineer, travel 4x/year to India.", connected: false, languages: ["English", "Kannada", "Hindi"], verified: true },
  { name: "Emily W.", route: "Chicago \u2192 Delhi", date: "Apr 1", rating: 4.7, trips: 8, avatar: "E", bio: "Graduate student flying between Chicago and Delhi.", connected: false, languages: ["English"], verified: true },
  { name: "Fatima A.", route: "Dubai \u2192 Karachi", date: "Apr 5", rating: 4.6, trips: 5, avatar: "F", bio: "Business traveler, Dubai-Karachi route.", connected: false, languages: ["Arabic", "Urdu"], verified: false },
];

export const seedMessages: MessageThread[] = [
  {
    name: "Priya S.",
    last: "Can you carry electronics?",
    time: "2m",
    unread: 2,
    avatar: "P",
    conversationType: "booking",
    status: "active",
    messages: [
      { id: "m1", from: "them", text: "Hi! I saw your trip to Mumbai.", time: "10:30 AM" },
      { id: "m2", from: "them", text: "Can you carry electronics?", time: "10:33 AM" },
      { id: "m3", from: "me", text: "Yes, I can! What do you need delivered?", time: "10:35 AM" },
      { id: "m4", from: "them", text: "An iPhone 15 Pro Max, sealed box. 2.5 kg.", time: "10:36 AM" },
      { id: "m5", from: "me", text: "Sure, I have enough capacity. What fee are you offering?", time: "10:38 AM" },
      { id: "m6", from: "them", text: "How about $45?", time: "10:39 AM" },
      { id: "m7", from: "them", text: "I can also share the product invoice for verification.", time: "10:40 AM", attachment: { id: "att1", type: "pdf", name: "invoice_iphone15.pdf", size: "245 KB" } },
    ],
  },
  {
    name: "James W.",
    last: "I'll be at the airport by 3pm",
    time: "1h",
    unread: 0,
    avatar: "J",
    conversationType: "booking",
    status: "matched",
    messages: [
      { id: "m8", from: "them", text: "Hey, I accepted your offer for the documents delivery.", time: "9:00 AM" },
      { id: "m9", from: "me", text: "Great! When can we arrange pickup?", time: "9:15 AM" },
      { id: "m10", from: "them", text: "I'll be at the airport by 3pm", time: "9:48 AM" },
      { id: "m11", from: "me", text: "Perfect, see you there!", time: "9:50 AM" },
    ],
  },
  {
    name: "Anita D.",
    last: "Package ready for pickup!",
    time: "3h",
    unread: 1,
    avatar: "A",
    conversationType: "booking",
    status: "active",
    messages: [
      { id: "m12", from: "them", text: "Package ready for pickup!", time: "7:40 AM" },
      { id: "m13", from: "them", text: "I've packed everything securely.", time: "7:41 AM", attachment: { id: "att2", type: "image", name: "package_photo.jpg", size: "1.2 MB" } },
    ],
  },
  {
    name: "Sarah K.",
    last: "Looking forward to traveling together!",
    time: "5h",
    unread: 0,
    avatar: "S",
    conversationType: "buddy",
    status: "matched",
    messages: [
      { id: "m14", from: "them", text: "Hi! I saw we're both flying NYC to Mumbai on Mar 25.", time: "6:00 AM" },
      { id: "m15", from: "me", text: "Yes! Would love a travel companion.", time: "6:10 AM" },
      { id: "m16", from: "them", text: "Great! I've done this route 12 times. I can help with transit.", time: "6:12 AM" },
      { id: "m17", from: "me", text: "That sounds amazing. Let's connect!", time: "6:15 AM" },
      { id: "m18", from: "them", text: "Looking forward to traveling together!", time: "6:16 AM" },
    ],
  },
];

export const seedNotifications: NotificationItem[] = [
  { title: "New parcel match!", desc: "3 parcels match your Seattle \u2192 Hyderabad route", time: "Just now", read: false, type: "match" },
  { title: "Delivery confirmed", desc: "PKG-098 was delivered successfully", time: "2h ago", read: false, type: "delivery" },
  { title: "Payment received", desc: "$45 added to your wallet for PKG-2845", time: "5h ago", read: true, type: "payment" },
  { title: "New travel buddy request", desc: "Emily W. wants to travel with you on the Chicago \u2192 Delhi route", time: "1d ago", read: true, type: "match" },
  { title: "KYC reminder", desc: "Complete your verification to unlock all features", time: "2d ago", read: true, type: "system" },
];

export const seedBookings: Booking[] = [
  {
    id: "BK-001",
    parcelId: "PKG-2847",
    carrierId: "user-1",
    carrierName: "Alex Johnson",
    receiverId: "user-2",
    receiverName: "Priya Sharma",
    from: "New York",
    to: "Mumbai",
    status: "in_transit",
    amount: "$45",
    date: "Mar 18",
    otp: "4829",
    otpVerified: false,
    pickupDate: "Mar 18",
    timeline: [
      { status: "created", label: "Booking Created", date: "Mar 16", completed: true },
      { status: "payment", label: "Payment Confirmed", date: "Mar 16", completed: true },
      { status: "pickup", label: "Package Picked Up", date: "Mar 18", completed: true },
      { status: "in_transit", label: "In Transit", date: "Mar 18", completed: true },
      { status: "delivered", label: "Delivered", date: "", completed: false },
      { status: "reviewed", label: "Review", date: "", completed: false },
    ],
  },
  {
    id: "BK-002",
    parcelId: "PKG-2845",
    carrierId: "user-3",
    carrierName: "Mike Chen",
    receiverId: "user-1",
    receiverName: "Alex Johnson",
    from: "Los Angeles",
    to: "Chennai",
    status: "delivered",
    amount: "$58",
    date: "Mar 16",
    otp: "7153",
    otpVerified: true,
    pickupDate: "Mar 14",
    deliveryDate: "Mar 16",
    timeline: [
      { status: "created", label: "Booking Created", date: "Mar 12", completed: true },
      { status: "payment", label: "Payment Confirmed", date: "Mar 12", completed: true },
      { status: "pickup", label: "Package Picked Up", date: "Mar 14", completed: true },
      { status: "in_transit", label: "In Transit", date: "Mar 14", completed: true },
      { status: "delivered", label: "Delivered", date: "Mar 16", completed: true },
      { status: "reviewed", label: "Review", date: "Mar 16", completed: true },
    ],
  },
  {
    id: "BK-003",
    parcelId: "PKG-2846",
    carrierId: "user-1",
    carrierName: "Alex Johnson",
    receiverId: "user-4",
    receiverName: "Anita Desai",
    from: "San Francisco",
    to: "Bangalore",
    status: "pending_payment",
    amount: "$32",
    date: "Mar 17",
    timeline: [
      { status: "created", label: "Booking Created", date: "Mar 17", completed: true },
      { status: "payment", label: "Payment Pending", date: "", completed: false },
      { status: "pickup", label: "Pickup", date: "", completed: false },
      { status: "in_transit", label: "In Transit", date: "", completed: false },
      { status: "delivered", label: "Delivered", date: "", completed: false },
      { status: "reviewed", label: "Review", date: "", completed: false },
    ],
  },
];

export const seedDisputes: Dispute[] = [
  {
    id: "DSP-001",
    bookingId: "BK-004",
    category: "damaged",
    description: "Bluetooth speaker arrived with cracked casing. The packaging was intact but the item inside was damaged.",
    status: "investigating",
    date: "Mar 14",
    evidence: ["damage_photo_1.jpg", "damage_photo_2.jpg"],
    messages: [
      { from: "user", text: "The item arrived damaged. I have photos as evidence.", time: "Mar 14, 2:30 PM" },
      { from: "support", text: "Thank you for reporting. We're reviewing the evidence. We'll update you within 48 hours.", time: "Mar 14, 3:15 PM" },
      { from: "user", text: "Please hurry, I need a resolution before the weekend.", time: "Mar 15, 9:00 AM" },
    ],
  },
];

export const seedBids: Bid[] = [
  { id: "BID-001", parcelId: "PKG-2843", carrierId: "user-5", carrierName: "David K.", carrierRating: 4.7, carrierTrips: 15, amount: "$25", message: "I fly this route monthly. Can deliver safely.", status: "pending" },
  { id: "BID-002", parcelId: "PKG-2843", carrierId: "user-6", carrierName: "Meera P.", carrierRating: 4.9, carrierTrips: 32, amount: "$30", message: "Experienced carrier with 100% delivery rate.", status: "pending" },
  { id: "BID-003", parcelId: "PKG-2846", carrierId: "user-1", carrierName: "Alex Johnson", carrierRating: 4.8, carrierTrips: 20, amount: "$32", status: "accepted" },
];

export const seedOpportunities: Opportunity[] = [
  { id: "OPP-001", parcelId: "PKG-2843", from: "London", to: "Hyderabad", weight: "0.9 kg", fee: "$27", date: "Mar 14", category: "Documents", senderName: "Arjun Rao", senderRating: 4.5 },
  { id: "OPP-002", parcelId: "PKG-2846", from: "San Francisco", to: "Bangalore", weight: "1.2 kg", fee: "$32", date: "Mar 17", category: "Documents", senderName: "Anita Desai", senderRating: 4.3 },
  { id: "OPP-003", parcelId: "PKG-NEW1", from: "NYC", to: "Mumbai", weight: "1.8 kg", fee: "$38", date: "Apr 5", category: "Gifts", senderName: "Ritu Patel", senderRating: 4.6 },
  { id: "OPP-004", parcelId: "PKG-NEW2", from: "Seattle", to: "Hyderabad", weight: "2.0 kg", fee: "$42", date: "Mar 28", category: "Medicines", senderName: "Kiran V.", senderRating: 4.8 },
];

export const seedReviews: Review[] = [
  { id: "REV-001", bookingId: "BK-002", reviewerName: "Mike Chen", reviewerAvatar: "M", rating: 5, text: "Excellent service! Package delivered safely and on time.", date: "Mar 16" },
  { id: "REV-002", bookingId: "BK-005", reviewerName: "Sarah K.", reviewerAvatar: "S", rating: 5, text: "Great travel companion. Very helpful at transit.", date: "Mar 10" },
  { id: "REV-003", bookingId: "BK-006", reviewerName: "Neha Kapoor", reviewerAvatar: "N", rating: 4, text: "Good communication. Slight delay but overall good experience.", date: "Mar 5" },
  { id: "REV-004", bookingId: "BK-007", reviewerName: "James W.", reviewerAvatar: "J", rating: 5, text: "Very professional. Would use again.", date: "Feb 28" },
];

export const seedSafetyAlerts: SafetyAlert[] = [
  {
    id: "SA-001",
    type: "kyc_failure",
    title: "KYC Verification Failed",
    message: "Your ID document could not be verified. Please re-upload a clear photo of your government-issued ID.",
    severity: "danger",
    date: "Mar 20",
    actionLabel: "Re-upload ID",
  },
  {
    id: "SA-002",
    type: "account_restricted",
    title: "Account Temporarily Restricted",
    message: "Your account has been temporarily restricted due to multiple failed delivery attempts. Please contact support.",
    severity: "danger",
    date: "Mar 19",
    actionLabel: "Contact Support",
  },
  {
    id: "SA-003",
    type: "suspicious_activity",
    title: "Suspicious Activity Detected",
    message: "We noticed unusual login activity on your account. If this wasn't you, please change your password immediately.",
    severity: "warning",
    date: "Mar 18",
    actionLabel: "Change Password",
  },
  {
    id: "SA-004",
    type: "referral_blocked",
    title: "Referral Program Suspended",
    message: "Your referral privileges have been suspended due to policy violations. Referral bonuses will not be credited.",
    severity: "warning",
    date: "Mar 17",
  },
];
