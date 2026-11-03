import { render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import TabsLayout from "@/app/(app)/(tabs)/_layout";
import LogisticsRedirect from "@/app/(app)/logistics";

let mockRole = "FARMER";
jest.mock("@/api/queries", () => ({ useMe: () => ({ data: { user: { role: mockRole } } }) }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router/js-tabs", () => {
  const { View, Text } = require("react-native");
  const Tabs = ({ children }: { children: ReactNode }) => <View>{children}</View>;
  Tabs.Screen = ({ name, options }: { name: string; options: { title?: string; href?: null } }) =>
    options.href === null ? null : <Text testID={`tab-${name}`}>{options.title}</Text>;
  return { Tabs };
});
jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return { Redirect: ({ href }: { href: string }) => <Text>{href}</Text> };
});

it.each(["FARMER", "TRADER"])("exposes Карта and preserves existing tabs for %s", async (role) => {
  mockRole = role;
  await render(<TabsLayout />);
  expect(screen.getByTestId("tab-map")).toHaveTextContent("Карта");
  for (const name of ["index", "market", "trade", "news", "ai"]) expect(screen.getByTestId(`tab-${name}`)).toBeTruthy();
  expect(!!screen.queryByTestId("tab-weather")).toBe(role === "FARMER");
  expect(screen.getAllByTestId(/^tab-/).map((tab) => tab.props.testID)).toEqual(
    (role === "FARMER" ? ["index", "weather", "market", "trade", "news", "map", "ai"] :
      ["index", "trade", "market", "news", "map", "ai"]).map((name) => `tab-${name}`),
  );
});

it("keeps old Logistics links working by redirecting to the map tab", async () => {
  await render(<LogisticsRedirect />);
  expect(screen.getByText("/map")).toBeTruthy();
});
