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
 * - The EAS project id, which push token registration requires. `eas init`
 *   cannot write into a dynamic config, so it is supplied as EAS_PROJECT_ID.
 */
module.exports = ({ config }) => {
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
  const easProjectId = process.env.EAS_PROJECT_ID?.trim();

  const plugins = (config.plugins ?? []).flatMap((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name !== "@react-native-google-signin/google-signin") return [plugin];
    return iosUrlScheme ? [[name, { iosUrlScheme }]] : [];
  });

  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      ...(easProjectId ? { eas: { ...config.extra?.eas, projectId: easProjectId } } : {}),
    },
  };
};
