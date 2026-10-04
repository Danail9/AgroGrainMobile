import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Where the AgroGrain portal's API lives.
 *
 * Set `EXPO_PUBLIC_API_URL` for staging and production. In development it is
 * derived from the machine running `expo start`: the phone already reaches
 * that machine to load the bundle, and the portal's `next dev` listens on port
 * 3000 there, so scanning the QR code needs no extra configuration.
 */
function resolveApiUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const hostUri =
    Constants.expoConfig?.hostUri ?? (Constants as any).expoGoConfig?.debuggerHost;
  const host = typeof hostUri === "string" ? hostUri.split(":")[0] : null;
  if (host) return `http://${host}:3000`;

  // Android emulators reach the host machine at 10.0.2.2, not localhost.
  return Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";
}

export const API_URL = resolveApiUrl();
export const API_BASE = `${API_URL}/api/v1`;

export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

/**
 * Sent as the User-Agent. The portal's single-device rule and its admin
 * screens describe a device by this string, and it recognises "iPhone" and
 * "Android".
 */
export const USER_AGENT = `AgroMobile/${APP_VERSION} (${Platform.OS === "ios" ? "iPhone" : "Android"})`;

