/**
 * Dynamic Expo config layered over app.json.
 *
 * app.json holds everything that is the same for every build. This file adds the
 * values that differ per environment and must not be hard-coded, all read from
 * EXPO_PUBLIC_* / EAS environment variables (see .env.example):
 *
 * - Google Sign-In on iOS. The @react-native-google-signin config plugin
 *   refuses to run without `iosUrlScheme` — listing it bare in app.json made
 *   `expo prebuild -p ios` fail outright. When the iOS OAuth client is not
 *   configured the plugin is left out instead, and the app hides the Google
 *   button on iOS rather than showing one that cannot work. Android is
 *   unaffected either way: the plugin only touches iOS, and android/ is
 *   committed.
 * - google-services.json, which is gitignored: EAS supplies it as the file
 *   variable GOOGLE_SERVICES_JSON (see scripts/eas-google-services.mjs).
 * - The EAS project id, which push token registration requires. `eas init`
 *   cannot write into a dynamic config, so it is supplied as EAS_PROJECT_ID.
 * - The iOS push environment. expo-notifications writes aps-environment
 *   "development" unless told otherwise; store builds are pointed at APNs
 *   production explicitly rather than relying on the export step to rewrite
 *   the entitlement. EAS sets EAS_BUILD_PROFILE on its builders.
 */
module.exports = ({ config }) => {
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
  const easProjectId = process.env.EAS_PROJECT_ID?.trim();
  const pushMode =
    process.env.EAS_BUILD_PROFILE === "production" || process.env.APNS_MODE === "production"
      ? "production"
      : "development";

  const plugins = (config.plugins ?? []).flatMap((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name === "expo-notifications") {
      const options = Array.isArray(plugin) ? plugin[1] ?? {} : {};
      return [[name, { ...options, mode: pushMode }]];
    }
    if (name !== "@react-native-google-signin/google-signin") return [plugin];
    return iosUrlScheme ? [[name, { iosUrlScheme }]] : [];
  });

  return {
    ...config,
    plugins,
    android: {
      ...config.android,
      // On EAS the gitignored file arrives through a file-type environment
      // variable; locally the checked-out path in app.json is used.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
    },
    extra: {
      ...config.extra,
      ...(easProjectId ? { eas: { ...config.extra?.eas, projectId: easProjectId } } : {}),
    },
  };
};
