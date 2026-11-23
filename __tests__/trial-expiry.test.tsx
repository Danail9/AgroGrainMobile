import { act, render, screen } from "@testing-library/react-native";

import AppLayout from "@/app/(app)/_layout";

const mockRefetch = jest.fn();
let mockTrialActive = true;
let mockNewsPromptPending = false;
const deadline = "2026-02-28T10:15:00Z";
jest.mock("@/api/queries", () => ({
  useMe: () => ({
    refetch: mockRefetch,
    data: {
      user: { id: "trader-1", role: "TRADER" },
      subscription: { active: true, trialActive: mockTrialActive, trialEndsAt: deadline },
      notificationPrefs: { enabled: true, push: true, newsPromptPending: mockNewsPromptPending },
    },
  }),
}));
jest.mock("expo-router", () => ({ Stack: () => null }));
jest.mock("@/ui/Gate", () => ({ Gate: () => null, SignOutButton: () => null }));
jest.mock("@/ui/ActivityTracker", () => ({ ActivityTracker: () => null }));
jest.mock("@/ui/UpdateBanner", () => ({ UpdateBanner: () => null }));
jest.mock("@/ui/PushRegistrar", () => ({
  PushRegistrar: ({ enabled }: { enabled: boolean }) => {
    const { Text } = require("react-native");
    return <Text>{enabled ? "push-ready-to-register" : "push-deferred"}</Text>;
  },
}));
jest.mock("@/ui/BiometricLock", () => ({ BiometricOffer: () => null }));
jest.mock("@/ui/NewsNotificationWelcome", () => ({
  NewsNotificationWelcome: () => {
    const { Text } = require("react-native");
    return <Text>news-welcome</Text>;
  },
}));
jest.mock("@/ui/Paywall", () => ({ Paywall: () => null }));
jest.mock("@/lib/useAppleBillingSync", () => ({ useAppleBillingSync: jest.fn() }));
jest.mock("@/ui/QueryBoundary", () => ({ ErrorState: () => null, Loading: () => null }));
jest.mock("@/ui/InAppNotifications", () => ({
  InAppNotifications: ({ children }: { children: import("react").ReactNode }) => children,
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-01-31T10:15:00Z"));
  mockRefetch.mockReset().mockResolvedValue({});
  mockTrialActive = true;
  mockNewsPromptPending = false;
});

it("defers device push permission until the new user has made their news choice", async () => {
  mockNewsPromptPending = true;
  const view = await render(<AppLayout />);
  expect(screen.getByText("news-welcome")).toBeTruthy();
  expect(screen.getByText("push-deferred")).toBeTruthy();
  mockNewsPromptPending = false;
  await view.rerender(<AppLayout />);
  expect(screen.queryByText("news-welcome")).toBeNull();
  expect(screen.getByText("push-ready-to-register")).toBeTruthy();
});
afterEach(() => jest.useRealTimers());

it("refreshes exactly at trial expiry even when the month exceeds the timer limit", async () => {
  await render(<AppLayout />);
  await act(async () => { jest.advanceTimersByTime(2_147_483_647); });
  expect(mockRefetch).not.toHaveBeenCalled();
  const remaining = new Date(deadline).getTime() - Date.now();
  await act(async () => { jest.advanceTimersByTime(remaining - 1); });
  expect(mockRefetch).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

it("clears the trial timer after payment supplies access", async () => {
  const view = await render(<AppLayout />);
  mockTrialActive = false;
  await view.rerender(<AppLayout />);
  await act(async () => { jest.advanceTimersByTime(31 * 24 * 60 * 60 * 1000); });
  expect(mockRefetch).not.toHaveBeenCalled();
});

it("cleans up the timer when leaving the app layout", async () => {
  const view = await render(<AppLayout />);
  await view.unmount();
  await act(async () => { jest.advanceTimersByTime(31 * 24 * 60 * 60 * 1000); });
  expect(mockRefetch).not.toHaveBeenCalled();
});
