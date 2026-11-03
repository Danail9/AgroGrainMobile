import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import AiScreen from "@/app/(app)/(tabs)/ai";
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/ui/Screen", () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/ui/QueryBoundary", () => ({ QueryBoundary: () => null }));
jest.mock("@/api/queries", () => ({ useMe: () => ({}), useWeather: () => ({}) }));
it("uses two content-sized tool rows and preserves all four destinations", async () => {
  await render(<AiScreen />);
  for (const index of [0, 1]) {
    const row = screen.getByTestId(`ai-tool-row-${index}`);
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: "row" });
    expect(StyleSheet.flatten(row.props.style).height).toBeUndefined();
  }
  for (const [label, href] of [
    ["Дневен обзор", "/ai/daily"], ["Анализ на времето", "/ai/weather"],
    ["Пазарен обзор", "/ai/market"], ["Калкулатори", "/ai/calculator"],
  ]) {
    await fireEvent.press(screen.getByRole("button", { name: label }));
    expect(router.push).toHaveBeenLastCalledWith(href);
  }
  expect(screen.getByText("Примерни въпроси")).toBeTruthy();
});
