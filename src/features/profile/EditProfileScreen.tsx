import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useShallow } from "zustand/react/shallow";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import {
  ProfileFormFields,
  type ProfileFormErrors,
} from "@/features/profile/ProfileFormFields";
import { initialsFromFullName } from "@/features/profile/profileUtils";
import { useMyProfile } from "@/hooks/api/useMyProfile";
import { t } from "@/i18n/translations";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { getErrorMessage, usersApi } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function EditProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { profile, loading: initialLoading, error: loadError, refetch } = useMyProfile();
  const { language, setUserProfileFromApi } = useAppStore(
    useShallow((s) => ({
      language: s.language,
      setUserProfileFromApi: s.setUserProfileFromApi,
    })),
  );

  // Form state — seeded from API on first load and after refetch.
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Track if user has typed since last hydration so we don't blow away their
  // edits if a background refetch lands.
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!profile) return;
    if (dirtyRef.current) return;
    setName(profile.name ?? "");
    setBio(profile.bio ?? "");
    setCity(profile.city ?? "");
    setCountry(profile.country ?? null);
  }, [profile]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const validate = useCallback((): boolean => {
    const next: ProfileFormErrors = {};
    if (!name.trim()) next.name = "Name is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [name]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Profile");
  }, [navigation]);

  const handleSave = useCallback(async () => {
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await usersApi.updateMyProfile({
        name: name.trim(),
        bio: bio.trim() || undefined,
        city: city.trim() || undefined,
        country: country ?? undefined,
      });
      const saved = res.data;

      // Reflect API truth in the store so ProfileScreen + others see it instantly.
      if (saved) {
        setUserProfileFromApi(saved, user?.email ?? "");
      }

      // Clear dirty flag so any subsequent refetch can re-hydrate.
      dirtyRef.current = false;

      showToast({ title: "Profile updated", variant: "success" });
      goBack();
    } catch (err) {
      showToast({
        title: "Couldn't save profile",
        message: getErrorMessage(err),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    validate,
    name,
    bio,
    city,
    country,
    user?.email,
    setUserProfileFromApi,
    goBack,
  ]);

  // ───────── Loading state (initial fetch) ─────────
  if (initialLoading && !profile) {
    return (
      <Screen refreshEnabled={false}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t(language, "profile.editProfile")}</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centeredText}>Loading profile…</Text>
        </View>
      </Screen>
    );
  }

  // ───────── Error state (only when we have nothing to seed the form with) ─────────
  if (loadError && !profile) {
    return (
      <Screen refreshEnabled={false}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t(language, "profile.editProfile")}</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedText} />
          <Text style={styles.errorTitle}>Couldn't load your profile</Text>
          <Text style={styles.errorBody}>{getErrorMessage(loadError)}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const avatarUrl = profile?.avatar_url ?? null;
  const initials = initialsFromFullName(name || profile?.name || "");

  return (
    <Screen contentContainerStyle={styles.scroll} refreshEnabled={false}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backButton}
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          disabled={submitting}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t(language, "profile.editProfile")}</Text>
      </View>

      <View style={styles.avatarWrap}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <Pressable
          style={styles.cameraBadge}
          onPress={() => showToast({ title: "Photo upload coming soon", variant: "info" })}
          accessibilityRole="button"
          accessibilityLabel={t(language, "profile.changePhoto")}
        >
          <Ionicons name="camera-outline" size={16} color={colors.white} />
        </Pressable>
      </View>

      <ProfileFormFields
        name={name}
        city={city}
        country={country}
        bio={bio}
        onName={(v) => {
          setName(v);
          markDirty();
          if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
        }}
        onCity={(v) => {
          setCity(v);
          markDirty();
        }}
        onCountry={(v) => {
          setCountry(v);
          markDirty();
        }}
        onBio={(v) => {
          setBio(v);
          markDirty();
        }}
        errors={errors}
        disabled={submitting}
        nameRequired
      />

      <Pressable
        style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel={t(language, "profile.saveChanges")}
      >
        {submitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.saveButtonLabel}>{t(language, "profile.saveChanges")}</Text>
        )}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    marginBottom: 18,
    minHeight: 34,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  centeredText: { color: colors.mutedText, fontSize: 14, fontWeight: "500" },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  errorBody: { color: colors.mutedText, fontSize: 13, textAlign: "center", maxWidth: 280 },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  retryButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  avatarWrap: { alignSelf: "center", marginBottom: 24, position: "relative" },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#FFF1EC",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 104, height: 104, borderRadius: 52 },
  avatarInitials: { color: colors.primary, fontWeight: "800", fontSize: 36, lineHeight: 40 },
  cameraBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.card,
  },
  saveButton: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonLabel: { color: colors.white, fontSize: 16, lineHeight: 22, fontWeight: "800" },
});
