import Constants from "expo-constants";
import { Platform } from "react-native";

import { enablePush, pushSupported, pushUnavailableReason } from "@/lib/push";
import { listenForNotificationResponses } from "@/lib/push-responses";

jest.mock("@/api/queries", () => ({ registerPushToken: jest.fn(), removePushToken: jest.fn() }));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    executionEnvironment: "bare",
    expoConfig: { extra: { iosPersonalTeam: true, eas: { projectId: "project-id" } } },
  },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
const notifications = {
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(),
};

afterEach(() => jest.restoreAllMocks());

it("explains and skips remote push in free Personal Team iPhone builds", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  expect(pushSupported()).toBe(false);
  expect(pushUnavailableReason()).toContain("платен Apple Developer");
  expect(await enablePush()).toBe(false);
});

it("keeps remote push available in paid-team iPhone builds", () => {
  jest.replaceProperty(Platform, "OS", "ios");
  const extra = Constants.expoConfig!.extra!;
  jest.replaceProperty(extra, "iosPersonalTeam", false);
  expect(pushSupported()).toBe(true);
});

it("does not apply the iPhone Personal Team restriction to Android", () => {
  jest.replaceProperty(Platform, "OS", "android");
  expect(pushSupported()).toBe(true);
});

it("does not expose remote push on web", () => {
  jest.replaceProperty(Platform, "OS", "web");
  expect(pushSupported()).toBe(false);
});

it("does not replay the launch notification after a biometric unlock remount", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  notifications.getLastNotificationResponseAsync.mockResolvedValue({
    actionIdentifier: "default",
    notification: { request: { identifier: "cold-start", content: { data: { url: "/notifications" } } } },
  });
  const open = jest.fn();
  const stop = await listenForNotificationResponses(notifications, open);
  stop();
  const stopAgain = await listenForNotificationResponses(notifications, open);
  stopAgain();
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith("/notifications");
});

it("does not navigate from an aborted listener after the app locks", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  notifications.getLastNotificationResponseAsync.mockResolvedValue({
    actionIdentifier: "default",
    notification: { request: { identifier: "aborted", content: { data: { url: "/notifications" } } } },
  });
  const controller = new AbortController();
  controller.abort();
  const open = jest.fn();
  const stop = await listenForNotificationResponses(notifications, open, controller.signal);
  stop();
  expect(open).not.toHaveBeenCalled();
});

it("cleans up the listener when reading the launch notification fails", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  const remove = jest.fn();
  notifications.addNotificationResponseReceivedListener.mockReturnValueOnce({ remove });
  notifications.getLastNotificationResponseAsync.mockRejectedValueOnce(new Error("Native failure"));
  await expect(listenForNotificationResponses(notifications, jest.fn())).rejects.toThrow("Native failure");
  expect(remove).toHaveBeenCalled();
});
