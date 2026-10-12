import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";

import HomeScreen from "@/app/(app)/(tabs)/index";

const mockRefetch = jest.fn();
let mockFetching = true;
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn(async () => undefined) }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/api/queries", () => ({
  keys: { trade: ["trade"] },
  useMe: () => ({ refetch: mockRefetch }),
  useHome: () => ({ refetch: mockRefetch, isRefetching: mockFetching }),
  useWeather: () => ({ refetch: mockRefetch, isRefetching: mockFetching }),
  useNotifications: () => ({ refetch: mockRefetch }),
}));
jest.mock("@/ui/Screen", () => {
  const { Button, Text } = require("react-native");
  return {
    Screen: ({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) => (
      <><Text testID="refreshing">{String(refreshing)}</Text><Button title="Refresh" onPress={onRefresh} /></>
    ),
  };
});
jest.mock("@/ui/QueryBoundary", () => ({
  QueryBoundary: ({ children }: { children: ReactNode }) => children,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFetching = true;
  mockRefetch.mockResolvedValue({});
});

it("does not show the pull spinner for background requests or returning to Home", async () => {
  const view = await render(<HomeScreen />);
  expect(screen.getByTestId("refreshing")).toHaveTextContent("false");
  mockFetching = false;
  await view.rerender(<HomeScreen />);
  mockFetching = true;
  await view.rerender(<HomeScreen />);
  expect(screen.getByTestId("refreshing")).toHaveTextContent("false");
});

it("shows the spinner only for a manual refresh and clears it on completion", async () => {
  let finish!: (value: unknown) => void;
  mockRefetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await render(<HomeScreen />);
  await fireEvent.press(screen.getByText("Refresh"));
  expect(screen.getByTestId("refreshing")).toHaveTextContent("true");
  await fireEvent.press(screen.getByText("Refresh"));
  expect(mockRefetch).toHaveBeenCalledTimes(3);
  await act(async () => { finish({}); });
  expect(screen.getByTestId("refreshing")).toHaveTextContent("false");
});

it("clears the spinner and reports unexpected refresh failures", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockRefetch.mockRejectedValueOnce(new Error("Failed"));
  await render(<HomeScreen />);
  await fireEvent.press(screen.getByText("Refresh"));
  expect(screen.getByTestId("refreshing")).toHaveTextContent("false");
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
