import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import { registerPushToken, removePushToken } from "@/api/queries";
import { internalPath } from "@/lib/notifications";

const TOKEN_KEY = "agro.push-token";

function projectId(): string | null {
  const id = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === "string" && id ? id : null;
}

/**
 * Remote push needs a development or store build and an EAS project: Expo Go
 * cannot receive it on Android, and a token cannot be issued without the id.
 * The module is imported lazily so Expo Go never loads it.
 */
export function pushSupported() {
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && projectId() !== null;
}

/** "granted", "denied" or "undetermined" for this device. */
export async function pushPermission() {
  if (!pushSupported()) return "unsupported" as const;
  const Notifications = await import("expo-notifications");
  return (await Notifications.getPermissionsAsync()).status;
}

/**
 * Asks for permission if needed, then tells the portal this phone's push
 * token. Resolves to false when the user declined or push is unavailable.
 */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const Notifications = await import("expo-notifications");

  if (Platform.OS === "android") {
    // Android shows no permission prompt until a channel exists.
    await Notifications.setNotificationChannelAsync("default", {
      name: "Известия",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return false;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId()! });
  await registerPushToken(token);
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return true;
}

/** Stops alerts for this phone: called when push is switched off and on sign-out. */
export async function disablePush() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await removePushToken(token);
  } finally {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Shows alerts that arrive while the app is open and opens the screen a tapped
 * alert points to. Returns a cleanup function.
 */
export async function listenForPush(open: (path: string) => void) {
  if (!pushSupported()) return () => undefined;
  const Notifications = await import("expo-notifications");

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const handle = (response: { notification: { request: { content: { data?: unknown } } } }) => {
    const url = (response.notification.request.content.data as { url?: unknown } | undefined)?.url;
    const path = internalPath(typeof url === "string" ? url : null);
    if (path) open(path);
  };

  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  // The alert that launched the app from a closed state.
  const initial = await Notifications.getLastNotificationResponseAsync();
  if (initial) handle(initial);

  return () => subscription.remove();
}
