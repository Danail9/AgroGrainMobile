import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Extends app.json with build-time settings that depend on the environment.
 * The Google Sign-In plugin needs the reversed iOS client id as a URL scheme,
 * so it is only added once `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is set.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const plugins = [...(config.plugins ?? [])];

  if (iosClientId) {
    const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace(
      /\.apps\.googleusercontent\.com$/,
      "",
    )}`;
    plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme }]);
  }

  const personalTeam = process.env.IOS_PERSONAL_TEAM === "1";
  if (personalTeam) {
    plugins.unshift("./plugins/withIosPersonalTeam");
  }

  return {
    ...(config as ExpoConfig),
    extra: { ...config.extra, iosPersonalTeam: personalTeam },
    ios: personalTeam
      ? { ...config.ios, usesAppleSignIn: false, associatedDomains: [] }
      : config.ios,
    plugins,
  };
};
