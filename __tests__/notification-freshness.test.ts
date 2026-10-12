import { QueryClient, QueryObserver, onlineManager } from "@tanstack/react-query";
import { AppState } from "react-native";

import { keys } from "@/api/queries";
import { NOTIFICATION_REFRESH_INTERVAL, watchNotificationFreshness } from "@/api/queryClient";

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it("checks every 10 seconds only while foregrounded and online, and stops on cleanup", async () => {
  jest.useFakeTimers();
  const client = new QueryClient();
  const invalidate = jest.spyOn(client, "invalidateQueries").mockResolvedValue();
  AppState.currentState = "active";
  onlineManager.setOnline(true);
  const listener = jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() });
  const stop = watchNotificationFreshness(client);
  const onChange = listener.mock.calls[0][1];
  await jest.advanceTimersByTimeAsync(NOTIFICATION_REFRESH_INTERVAL - 1);
  expect(invalidate).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenLastCalledWith({ queryKey: keys.notifications });
  onChange("background");
  await jest.advanceTimersByTimeAsync(30_000);
  expect(invalidate).toHaveBeenCalledTimes(1);
  onChange("active");
  expect(invalidate).toHaveBeenCalledTimes(2);
  onlineManager.setOnline(false);
  await jest.advanceTimersByTimeAsync(30_000);
  expect(invalidate).toHaveBeenCalledTimes(2);
  stop();
  onlineManager.setOnline(true);
  await jest.advanceTimersByTimeAsync(30_000);
  expect(invalidate).toHaveBeenCalledTimes(2);
  client.clear();
  jest.useRealTimers();
});

it("refreshes notifications on resume without invalidating home or weather", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  for (const key of [keys.home, keys.weather, keys.notifications]) client.setQueryData(key, "cached");
  const fetch = jest.fn(async () => "fresh");
  const observer = new QueryObserver(client, {
    queryKey: keys.notifications, queryFn: fetch, staleTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  AppState.currentState = "active";
  const remove = jest.fn();
  const listener = jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove });
  const stop = watchNotificationFreshness(client);
  const onChange = listener.mock.calls[0][1];
  onChange("active");
  expect(fetch).not.toHaveBeenCalled();
  onChange("background");
  onChange("active");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(keys.notifications)).toBe("fresh");
  for (const key of [keys.home, keys.weather]) {
    expect(client.getQueryData(key)).toBe("cached");
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  }
  onChange("active");
  expect(fetch).toHaveBeenCalledTimes(1);
  stop();
  expect(remove).toHaveBeenCalled();
  unsubscribe();
  client.clear();
});
