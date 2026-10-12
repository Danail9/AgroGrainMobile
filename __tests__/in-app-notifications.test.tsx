import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { router } from "expo-router";

import { InAppNotifications, InAppNotificationSettings } from "@/ui/InAppNotifications";
import { HeaderActions } from "@/ui/HeaderActions";

let mockItems: { id: string; title: string; body: string; createdAt: string; readAt: string | null }[] = [];
jest.mock("@/api/queries", () => ({
  useNotifications: () => ({ data: { unreadCount: mockItems.length, items: mockItems } }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function app(masterEnabled = true) {
  return (
    <InAppNotifications userId="test" masterEnabled={masterEnabled}>
      <InAppNotificationSettings />
    </InAppNotifications>
  );
}
function item(id: string) {
  return { id, title: `Alert ${id}`, body: "New market alert", createdAt: new Date().toISOString(), readAt: null };
}
beforeEach(async () => {
  jest.clearAllMocks();
  mockItems = [];
  AppState.currentState = "active";
  await AsyncStorage.clear();
});

it("offers an opt-in and does not show banners by default", async () => {
  const view = await render(app());
  await waitFor(() => expect(screen.getByLabelText("Банери в приложението").props.disabled).toBe(false));
  mockItems = [item("1")];
  await view.rerender(app());
  expect(screen.queryByLabelText("Ново известие: Alert 1")).toBeNull();
  await fireEvent(screen.getByLabelText("Банери в приложението"), "valueChange", true);
  expect(await AsyncStorage.getItem("ag.notification-banners.test")).toBe("1");
});

it("updates while on another screen and opens the list on a banner tap", async () => {
  await AsyncStorage.setItem("ag.notification-banners.test", "1");
  mockItems = [item("old")];
  const view = await render(app());
  await waitFor(() => expect(screen.getByLabelText("Банери в приложението").props.value).toBe(true));
  expect(screen.queryByLabelText("Ново известие: Alert old")).toBeNull();
  mockItems = [item("new"), item("old")];
  await view.rerender(app());
  await waitFor(() => expect(screen.getByLabelText("Ново известие: Alert new")).toBeTruthy());
  await fireEvent.press(screen.getByLabelText("Ново известие: Alert new"));
  expect(router.push).toHaveBeenCalledWith("/notifications");
  expect(screen.queryByLabelText("Ново известие: Alert new")).toBeNull();
});

it("honors master-off and does not announce already read notifications", async () => {
  await AsyncStorage.setItem("ag.notification-banners.test", "1");
  const view = await render(app(false));
  await waitFor(() => expect(screen.getByLabelText("Банери в приложението").props.value).toBe(true));
  mockItems = [item("disabled")];
  await view.rerender(app(false));
  expect(screen.queryByLabelText("Ново известие: Alert disabled")).toBeNull();
  mockItems = [{ ...item("read"), readAt: new Date().toISOString() }];
  await view.rerender(app());
  expect(screen.queryByLabelText("Ново известие: Alert read")).toBeNull();
});

it("dismisses banners and does not replay the same notification", async () => {
  await AsyncStorage.setItem("ag.notification-banners.test", "1");
  const view = await render(app());
  await waitFor(() => expect(screen.getByLabelText("Банери в приложението").props.value).toBe(true));
  mockItems = [item("new")];
  await view.rerender(app());
  await waitFor(() => expect(screen.getByLabelText("Затвори известието")).toBeTruthy());
  await fireEvent.press(screen.getByLabelText("Затвори известието"));
  mockItems = [...mockItems];
  await view.rerender(app());
  expect(screen.queryByLabelText("Ново известие: Alert new")).toBeNull();
});

it("surfaces a failed preference save without enabling banners", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("Storage failed"));
  await render(app());
  await waitFor(() => expect(screen.getByLabelText("Банери в приложението").props.disabled).toBe(false));
  await fireEvent(screen.getByLabelText("Банери в приложението"), "valueChange", true);
  expect(screen.getByText("Настройката за банери не е запазена. Опитай отново.")).toBeTruthy();
  expect(screen.getByLabelText("Банери в приложението").props.value).toBe(false);
  log.mockRestore();
});

it("shows an unread bell indicator and navigates without needing to refresh Home", async () => {
  const view = await render(<HeaderActions unreadCount={3} />);
  expect(screen.getByLabelText("Известия, 3 нови")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Известия, 3 нови"));
  expect(router.push).toHaveBeenCalledWith("/notifications");
  await view.rerender(<HeaderActions unreadCount={0} />);
  expect(screen.getByLabelText("Известия")).toBeTruthy();
  expect(screen.queryByLabelText("Известия, 3 нови")).toBeNull();
});

it("automatically hides a banner after six seconds", async () => {
  jest.useFakeTimers();
  await AsyncStorage.setItem("ag.notification-banners.test", "1");
  const view = await render(app());
  await waitFor(() => expect(screen.getByLabelText("Банери в приложението").props.value).toBe(true));
  mockItems = [item("timed")];
  await view.rerender(app());
  await waitFor(() => expect(screen.getByLabelText("Ново известие: Alert timed")).toBeTruthy());
  await act(async () => { await jest.advanceTimersByTimeAsync(6000); });
  expect(screen.queryByLabelText("Ново известие: Alert timed")).toBeNull();
  jest.useRealTimers();
});

it("does not show a banner while backgrounded", async () => {
  await AsyncStorage.setItem("ag.notification-banners.test", "1");
  const view = await render(app());
  await waitFor(() => expect(screen.getByLabelText("Банери в приложението").props.value).toBe(true));
  AppState.currentState = "background";
  mockItems = [item("background")];
  await view.rerender(app());
  expect(screen.queryByLabelText("Ново известие: Alert background")).toBeNull();
});
