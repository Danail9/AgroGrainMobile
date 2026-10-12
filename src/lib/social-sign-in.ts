import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

/**
 * Native Google/Apple sign-in, returning only what the server needs: the
 * provider-signed identity token. `null` means the user cancelled.
 */

export type SocialProvider = "google" | "apple";

export type SocialCredential = {
  provider: SocialProvider;
  idToken: string;
  /** Apple shares the name only on the first authorisation. */
  name?: string;
};

type GoogleModule = typeof import("@react-native-google-signin/google-signin");

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? "";
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";

let google: GoogleModule | null | undefined;

/**
 * Loaded on demand: the module throws on import when the running binary was
 * built without it (an older development build), which must not break login.
 */
function loadGoogle(): GoogleModule | null {
  if (google !== undefined) return google;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@react-native-google-signin/google-signin") as GoogleModule;
    mod.GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    });
    google = mod;
  } catch {
    google = null;
  }
  return google;
}

/** Google needs the web client id (for the ID token) and, on iOS, the iOS id. */
export function isGoogleConfigured() {
  if (Platform.OS === "web" || !GOOGLE_WEB_CLIENT_ID) return false;
  if (Platform.OS === "ios" && !GOOGLE_IOS_CLIENT_ID) return false;
  return loadGoogle() !== null;
}

export async function isAppleAvailable() {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export class SocialSignInError extends Error {}

export async function signInWithGoogle(): Promise<SocialCredential | null> {
  const mod = loadGoogle();
  if (!mod) throw new SocialSignInError("Входът с Google не е наличен в тази версия.");
  const { GoogleSignin, isErrorWithCode, statusCodes } = mod;

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Always show the account chooser instead of silently reusing the last one.
    await GoogleSignin.signOut().catch(() => null);
    const response = await GoogleSignin.signIn();
    if (response.type !== "success") return null;
    if (!response.data.idToken) throw new SocialSignInError("Google не върна потвърждение.");
    return {
      provider: "google",
      idToken: response.data.idToken,
      name: response.data.user.name ?? undefined,
    };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
      if (error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new SocialSignInError("Google Play услугите не са налични на това устройство.");
      }
    }
    if (error instanceof SocialSignInError) throw error;
    throw new SocialSignInError("Входът с Google е неуспешен. Опитай отново.");
  }
}

export async function signInWithApple(): Promise<SocialCredential | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new SocialSignInError("Apple не върна потвърждение.");
    const name = credential.fullName
      ? AppleAuthentication.formatFullName(credential.fullName).trim()
      : "";
    return { provider: "apple", idToken: credential.identityToken, name: name || undefined };
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "ERR_REQUEST_CANCELED") return null;
    if (error instanceof SocialSignInError) throw error;
    throw new SocialSignInError("Входът с Apple е неуспешен. Опитай отново.");
  }
}
