import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, onlineManager, defaultShouldDehydrateQuery, type Query } from "@tanstack/react-query";
import { AppState } from "react-native";

import { isApiError } from "@/api/client";
import { CACHE_MAX_AGE, keys } from "@/api/queries";
import { APP_VERSION } from "@/config";
import { reportError } from "@/lib/monitoring";

/**
 * A 4xx answer is a verdict, not a glitch: retrying a 403 or 404 only delays
 * the message. Connectivity failures and 5xx get a couple of tries.
 */
export function shouldRetry(failureCount: number, error: unknown) {
  if (failureCount >= 2) return false;
  if (isApiError(error)) {
    if (error.isConnectivity) return true;
    return error.status >= 500 || error.code === "bad_response";
  }
  return false;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      // Keep answers long enough for the offline cache; each query sets its
      // own staleTime from how quickly its data really changes.
      gcTime: CACHE_MAX_AGE,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "agro.query-cache",
  throttleTime: 2000,
});

export const persistOptions = {
  persister,
  maxAge: CACHE_MAX_AGE,
  // Invalidate national prices even for OTA updates within the same app version.
  buster: `${APP_VERSION}:manual-port-prices-v1`,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      query.meta?.persist !== false && defaultShouldDehydrateQuery(query),
  },
};

/**
 * Lets the query layer know when the phone is offline, so it pauses fetching
 * and keeps showing the cached screen instead of flashing errors.
 * `isInternetReachable` is null while unknown, which must not count as offline.
 */
export function watchConnectivity() {
  return NetInfo.addEventListener((state) => {
    onlineManager.setOnline(state.isConnected !== false && state.isInternetReachable !== false);
  });
}

export const NOTIFICATION_REFRESH_INTERVAL = 10_000;

/** Refresh only notifications while navigation is unlocked and foregrounded. */
export function watchNotificationFreshness(client: QueryClient = queryClient) {
  let previous = AppState.currentState;
  const refresh = () => {
    if (!onlineManager.isOnline()) return;
    void client.invalidateQueries({ queryKey: keys.notifications }).catch((error) =>
      reportError("Refreshing notifications failed", error),
    );
  };
  const timer = setInterval(() => {
    if (previous === "active") refresh();
  }, NOTIFICATION_REFRESH_INTERVAL);
  const subscription = AppState.addEventListener("change", (state) => {
    const resumed = state === "active" && previous !== "active";
    previous = state;
    if (resumed) refresh();
  });
  return () => {
    clearInterval(timer);
    subscription.remove();
  };
}

/** Wipes every cached answer, in memory and on disk. Called on sign-out. */
export async function clearCache() {
  queryClient.clear();
  await persister.removeClient();
}

/**
 * A plan can lapse while the app is open. Any request that is refused for
 * that reason re-checks the account, so the layout switches to the gate
 * screen instead of every tab showing its own error.
 */
export function watchGates() {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "error") return;
    const error = event.action.error;
    if (isApiError(error) && error.code === "subscription_inactive") {
      void queryClient.invalidateQueries({ queryKey: keys.me });
    }
  });
}
