import { fireEvent, render, screen } from "@testing-library/react-native";

import MarketScreen from "@/app/(app)/(tabs)/market";
import type { PriceRow } from "@/api/schemas";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
let mockPrices: PriceRow[] = [];
jest.mock("@/api/queries", () => ({
  useMarket: () => ({
    data: { prices: mockPrices, fertilizers: [], news: [] },
    isPending: false, isError: false, isRefetching: false,
    fetchStatus: "idle", dataUpdatedAt: 0, refetch: jest.fn(),
  }),
  useMe: () => ({ data: { favoriteCrops: [] } }),
}));

const quote = (category: PriceRow["category"]): PriceRow => ({
  slug: category, name: `Crop ${category}`, category, emoji: "", unit: "€/т",
  price: 205, changePct: null, sortIdx: 0, date: "2026-10-31T10:00:00.000Z",
});

it.each(["GRAIN", "OILSEED", "OTHER", "PROCESSED"] as const)(
  "shows only the populated %s category",
  async (category) => {
    mockPrices = [quote(category)];
    await render(<MarketScreen />);
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByText(`Crop ${category}`)).toBeTruthy();
    expect(screen.queryByText("Няма оферти")).toBeNull();
  },
);

it("falls back to a populated category when the selected category empties on refresh", async () => {
  mockPrices = [quote("GRAIN"), quote("PROCESSED")];
  const view = await render(<MarketScreen />);
  await fireEvent.press(screen.getByRole("tab", { name: "Преработени" }));
  expect(screen.getByText("Crop PROCESSED")).toBeTruthy();

  mockPrices = [quote("GRAIN")];
  await view.rerender(<MarketScreen />);
  expect(screen.queryByRole("tab", { name: "Преработени" })).toBeNull();
  expect(screen.getByRole("tab", { name: "Зърнени" }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByText("Crop GRAIN")).toBeTruthy();

  mockPrices = [quote("GRAIN"), quote("OILSEED")];
  await view.rerender(<MarketScreen />);
  expect(screen.getByRole("tab", { name: "Маслодайни" })).toBeTruthy();
});

it("shows an overall empty state without category tabs when all offers disappear", async () => {
  mockPrices = [quote("GRAIN")];
  const view = await render(<MarketScreen />);
  mockPrices = [];
  await view.rerender(<MarketScreen />);
  expect(screen.queryAllByRole("tab")).toHaveLength(0);
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.getByText("Няма оферти")).toBeTruthy();
  expect(screen.getByText("Все още няма публикувани пристанищни оферти.")).toBeTruthy();
});
