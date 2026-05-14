import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View, type ViewStyle, useColorScheme } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
// BuddiesScreen kept on disk but no longer rendered — Buddies bottom tab now
// hosts the Inbox (MessagesScreen) to match web's `Home / Search / My Travels / Inbox` nav.
import { HomeScreen } from "@/features/tabs/HomeScreen";
import { NotificationsScreen } from "@/features/tabs/NotificationsScreen";
import { MyTravelsScreen } from "@/features/travels/MyTravelsScreen";
import { ProfileScreen } from "@/features/tabs/ProfileScreen";
import { SearchScreen } from "@/features/search/SearchScreen";
import { AllActivityScreen } from "@/features/activity/AllActivityScreen";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { SignupScreen } from "@/features/auth/SignupScreen";
import { ProfileSetupScreen } from "@/features/auth/ProfileSetupScreen";
import { ForgotPasswordScreen } from "@/features/auth/ForgotPasswordScreen";
import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen";
import { SendParcelScreen } from "@/features/parcels/SendParcelScreen";
import { ParcelDetailsScreen } from "@/features/parcels/ParcelDetailsScreen";
import { ReviewPayScreen } from "@/features/parcels/ReviewPayScreen";
import { PaymentSuccessScreen } from "@/features/parcels/PaymentSuccessScreen";
import { PaymentFailureScreen } from "@/features/parcels/PaymentFailureScreen";
import { ListTripScreen } from "@/features/trips/ListTripScreen";
import { ListTripSuccessScreen } from "@/features/trips/ListTripSuccessScreen";
import { ParcelOffersScreen } from "@/features/trips/ParcelOffersScreen";
import { TripDetailsScreen } from "@/features/trips/TripDetailsScreen";
import { OfferChatScreen } from "@/features/messages/OfferChatScreen";
import { MessagesScreen } from "@/features/messages/MessagesScreen";
import { BuddyDetailsScreen } from "@/features/buddies/BuddyDetailsScreen";
import { CreateBuddyScreen } from "@/features/buddies/CreateBuddyScreen";
import { SplashScreen } from "@/features/splash/SplashScreen";
import { EditProfileScreen } from "@/features/profile/EditProfileScreen";
import { EarningsScreen } from "@/features/earnings/EarningsScreen";
import { WalletScreen } from "@/features/wallet/WalletScreen";
import { AddCardScreen } from "@/features/wallet/AddCardScreen";
import { ReviewsScreen } from "@/features/reviews/ReviewsScreen";
import { KycVerificationScreen } from "@/features/profile/KycVerificationScreen";
import { SettingsScreen } from "@/features/profile/SettingsScreen";
import { PreferencesScreen } from "@/features/profile/PreferencesScreen";
import { ChangePasswordScreen } from "@/features/profile/ChangePasswordScreen";
import { ChangeEmailScreen } from "@/features/profile/ChangeEmailScreen";
// New screens
import { OpportunitiesScreen } from "@/features/opportunities/OpportunitiesScreen";
import { BookingsScreen } from "@/features/bookings/BookingsScreen";
import { OtpVerificationScreen } from "@/features/bookings/OtpVerificationScreen";
import { DeliveryReviewScreen } from "@/features/bookings/DeliveryReviewScreen";
import { DisputesScreen } from "@/features/disputes/DisputesScreen";
import { FileDisputeScreen } from "@/features/disputes/FileDisputeScreen";
import { SafetyAlertsScreen } from "@/features/safety/SafetyAlertsScreen";
import { MatchScreen } from "@/features/matching/MatchScreen";
import { BuddyCompletionScreen } from "@/features/matching/BuddyCompletionScreen";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import { useDimPulse } from "@/context/DimPulseContext";
import { usePresenceBroadcast } from "@/hooks/realtime/usePresenceBroadcast";
import { useRealtimeSync } from "@/hooks/realtime/useRealtimeSync";
import { useUnreadInboxCount } from "@/hooks/api/useUnreadInboxCount";
import { colors, glassBlurIntensity, glassDimPulse, glassTabBarFallback, screenCanvas } from "@/theme/colors";
import { t } from "@/i18n/translations";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

/**
 * Bridges navigation into SignupScreen's prop-based callback so the screen
 * stays presentational. Going back to Login pops the modal-style stack route
 * (configured with `slide_from_bottom`).
 */
function SignupScreenWrapper() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "Signup">>();
  const onSwitchToLogin = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Login");
  }, [navigation]);
  return <SignupScreen onSwitchToLogin={onSwitchToLogin} />;
}
const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  ActivityTab: "list-outline",
  MessagesTab: "chatbox-outline",
  Notifications: "notifications-outline",
  Parcels: "cube-outline",
  Trips: "search-outline",
  Buddies: "chatbox-outline",
  BuddyDetailsTab: "person-outline",
  Profile: "person-outline",
  WalletTab: "wallet-outline",
  AddCardTab: "card-outline",
  EarningsTab: "cash-outline",
  KycVerificationTab: "shield-checkmark-outline",
  EditProfileTab: "create",
  ReviewsTab: "star-outline",
  SettingsTab: "settings-outline",
  PreferencesTab: "options-outline",
  ChangePasswordTab: "lock-closed-outline",
  ChangeEmailTab: "mail-open-outline",
  ForgotPasswordTab: "mail-outline",
  SendParcelTab: "cube-outline",
  ReviewPayTab: "card-outline",
  PaymentSuccessTab: "checkmark-circle",
  PaymentFailureTab: "close-circle",
  ListTripTab: "airplane-outline",
  ListTripSuccessTab: "checkmark-circle",
  TripDetailsTab: "document-text-outline",
  OffersTab: "list-outline",
  OfferChatTab: "chatbubble-outline",
  ParcelDetailsTab: "cube-outline",
  SearchTab: "search-outline",
  OpportunitiesTab: "flash-outline",
  BookingsTab: "receipt-outline",
  OtpVerificationTab: "key-outline",
  DeliveryReviewTab: "star-outline",
  DisputesTab: "alert-circle",
  FileDisputeTab: "flag",
  SafetyAlertsTab: "shield-outline",
  MatchTab: "people-circle",
  BuddyCompletionTab: "checkmark-done-circle",
};

function renderGlassTabBarBackground() {
  return <GlassTabBarBackground />;
}

function GlassTabBarBackground() {
  const dimPulse = useDimPulse();
  const pulseLayer = (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          backgroundColor: glassDimPulse.layer,
          opacity: dimPulse.interpolate({
            inputRange: [0, 1],
            outputRange: [glassDimPulse.opacityMin, glassDimPulse.opacityMax],
          }),
        },
      ]}
    />
  );

  if (Platform.OS === "web") {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: glassTabBarFallback },
            { backdropFilter: "blur(26px)", WebkitBackdropFilter: "blur(26px)" } as ViewStyle,
          ]}
        />
        {pulseLayer}
      </View>
    );
  }
  if (Platform.OS === "android") {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: glassTabBarFallback }]} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(255, 255, 255, 0.12)" }]} />
        {pulseLayer}
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <BlurView intensity={glassBlurIntensity.tabBar} tint="light" style={StyleSheet.absoluteFillObject} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(255, 255, 255, 0.12)" }]} />
      {pulseLayer}
    </View>
  );
}

function renderTabIcon(routeName: string, color: string, size: number) {
  return (
    <Ionicons
      name={TAB_ICONS[routeName] ?? "ellipse"}
      size={size}
      color={color}
    />
  );
}

/** Helper to create hidden tab screen options */
const HIDDEN_TAB = { tabBarButton: () => null, tabBarItemStyle: { display: "none" as const } };

function MainTabs() {
  const insets = useSafeAreaInsets();
  const language = useAppStore((s) => s.language);
  const colorScheme = useColorScheme();
  const usesEdgeToEdge = insets.bottom > 0;
  const bottomPadding = usesEdgeToEdge ? Math.max(insets.bottom - 2, 8) : 10;
  const barHeight = 62 + bottomPadding;
  const transitionBackground = colorScheme === "dark" ? "#0B0B0C" : screenCanvas;

  // Web parity (`CustomerNavbar.tsx:103-107`): show an unread-count pill on the
  // Inbox link. React Navigation's `tabBarBadge` accepts a string|number — we
  // pass `undefined` when zero so the dot disappears.
  const { count: inboxUnread } = useUnreadInboxCount();
  const inboxBadge = inboxUnread > 0 ? (inboxUnread > 9 ? "9+" : inboxUnread) : undefined;

  const tabScreenOptions = useMemo(
    () =>
      ({ route }: { route: { name: string } }) => ({
        headerShown: false,
        animation: "fade" as const,
        transitionSpec: {
          animation: "timing" as const,
          config: { duration: 210, easing: Easing.out(Easing.cubic) },
        },
        unmountOnBlur: false,
        freezeOnBlur: true,
        sceneStyle: { backgroundColor: transitionBackground },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" as const, marginBottom: usesEdgeToEdge ? 0 : 2 },
        tabBarBackground: renderGlassTabBarBackground,
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: barHeight,
          paddingTop: 6,
          paddingBottom: bottomPadding,
        },
        tabBarIcon: ({ color, size }: { color: string; size: number }) => renderTabIcon(route.name, color, size),
      }),
    [barHeight, bottomPadding, transitionBackground, usesEdgeToEdge]
  );

  return (
    <Tabs.Navigator backBehavior="history" screenOptions={tabScreenOptions}>
      {/* Visible tabs */}
      <Tabs.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t(language, "tabs.home") }} />
      <Tabs.Screen name="Parcels" component={MyTravelsScreen} options={{ tabBarLabel: t(language, "tabs.parcels") }} />
      <Tabs.Screen name="Trips" component={SearchScreen} options={{ tabBarLabel: t(language, "tabs.trips") }} />
      <Tabs.Screen
        name="Buddies"
        component={MessagesScreen}
        options={{
          tabBarLabel: t(language, "tabs.buddies"),
          tabBarBadge: inboxBadge,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.white, fontSize: 10, fontWeight: "800" },
        }}
      />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t(language, "tabs.profile") }} />

      {/* Hidden tab routes */}
      <Tabs.Screen name="ActivityTab" component={AllActivityScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="MessagesTab" component={MessagesScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="Notifications" component={NotificationsScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="BuddyDetailsTab" component={BuddyDetailsScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="CreateBuddyTab" component={CreateBuddyScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="WalletTab" component={WalletScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="AddCardTab" component={AddCardScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="EarningsTab" component={EarningsScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="KycVerificationTab" component={KycVerificationScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="EditProfileTab" component={EditProfileScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="ReviewsTab" component={ReviewsScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="SettingsTab" component={SettingsScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="PreferencesTab" component={PreferencesScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="ChangePasswordTab" component={ChangePasswordScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="ChangeEmailTab" component={ChangeEmailScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="ForgotPasswordTab" component={ForgotPasswordScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="SendParcelTab" component={SendParcelScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="ReviewPayTab" component={ReviewPayScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="PaymentSuccessTab" component={PaymentSuccessScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="PaymentFailureTab" component={PaymentFailureScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="ListTripTab" component={ListTripScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="ListTripSuccessTab" component={ListTripSuccessScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="TripDetailsTab" component={TripDetailsScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="OffersTab" component={ParcelOffersScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="OfferChatTab" component={OfferChatScreen} options={{ ...HIDDEN_TAB, tabBarHideOnKeyboard: true }} />
      <Tabs.Screen name="ParcelDetailsTab" component={ParcelDetailsScreen} options={HIDDEN_TAB} />
      {/* New screens */}
      <Tabs.Screen name="SearchTab" component={SearchScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="OpportunitiesTab" component={OpportunitiesScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="BookingsTab" component={BookingsScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="OtpVerificationTab" component={OtpVerificationScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="DeliveryReviewTab" component={DeliveryReviewScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="DisputesTab" component={DisputesScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="FileDisputeTab" component={FileDisputeScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="SafetyAlertsTab" component={SafetyAlertsScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="MatchTab" component={MatchScreen} options={HIDDEN_TAB} />
      <Tabs.Screen name="BuddyCompletionTab" component={BuddyCompletionScreen} options={HIDDEN_TAB} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const transitionBackground = colorScheme === "dark" ? "#0B0B0C" : screenCanvas;
  const { splashDone, onboarded, profileSetupDone, authenticated, showLiveData, toggleLiveDataVisibility } = useAppStore(
    useShallow((s) => ({
      splashDone: s.splashDone,
      onboarded: s.onboarded,
      profileSetupDone: s.profileSetupDone,
      authenticated: s.authenticated,
      showLiveData: s.showLiveData,
      toggleLiveDataVisibility: s.toggleLiveDataVisibility,
    }))
  );

  // Web parity: broadcast our presence so other users see us as "online" in
  // their chat headers (`useConversationPresence.online`). Hook self-guards on
  // a missing user id, so it's safe to mount unconditionally.
  usePresenceBroadcast();
  // One consolidated channel that fans out into the realtime bus — drives
  // inbox auto-update, unread badges, notification toasts (when wired), etc.
  useRealtimeSync();

  return (
    <View style={styles.container}>
      <Stack.Navigator
        screenOptions={{
          animation: "slide_from_right",
          animationDuration: 280,
          fullScreenGestureEnabled: true,
          gestureEnabled: true,
          presentation: "card",
          headerStyle: { backgroundColor: screenCanvas },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: transitionBackground },
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        {!splashDone && <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />}
        {splashDone && !onboarded && <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />}
        {splashDone && onboarded && !authenticated && (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Signup" component={SignupScreenWrapper} options={{ headerShown: false, animation: "slide_from_bottom" }} />
          </>
        )}
        {splashDone && onboarded && authenticated && !profileSetupDone && (
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ headerShown: false }} />
        )}
        {splashDone && onboarded && authenticated && profileSetupDone && (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Wallet" component={WalletScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Reviews" component={ReviewsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Earnings" component={EarningsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="KycVerification" component={KycVerificationScreen} options={{ headerShown: false }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
      <Pressable
        onPress={toggleLiveDataVisibility}
        style={[styles.dataToggle, { top: Math.max(insets.top + 8, 18) }]}
        accessibilityRole="button"
        accessibilityLabel={showLiveData ? "Hide app data" : "Show app data"}
      >
        <Ionicons name={showLiveData ? "eye-outline" : "eye-off-outline"} size={14} color={colors.white} />
        <Text style={styles.dataToggleText}>{showLiveData ? "Data On" : "Data Off"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: screenCanvas },
  dataToggle: {
    position: "absolute",
    left: 12,
    zIndex: 30,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  dataToggleText: { color: colors.white, fontSize: 11, fontWeight: "700" },
});
