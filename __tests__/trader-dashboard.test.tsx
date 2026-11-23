import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import HomeScreen from "@/app/(app)/(tabs)/index";

const mockNow = new Date("2026-11-22T12:00:00Z").getTime();
const mockData = {
  role: "TRADER",
  stats: { activeOffers: 18, openListings: 2, totalTonnage: 1000 },
  latestListings: [{
    id: "listing-1", title: "Пшеница хлебна", quantityT: 500, askPrice: 200, unit: "€/т",
    farmer: { name: "Фермер", farmName: "Агро" }, createdAt: "2026-10-01T12:00:00Z",
    hectolitre: null, protein: null, gluten: null,
  }],
  prices: [{
    slug: "wheat", name: "Пшеница", emoji: "🌾", unit: "€/т", price: 205, changePct: null,
    date: "2026-10-20T12:00:00Z",
    portPrices: [
      { destination: "VARNA", price: 205, date: "2026-10-20T12:00:00Z" },
      { destination: "BURGAS", price: 210, date: "2026-10-19T12:00:00Z" },
    ],
  }],
};
let mockHome = mockData;
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock("@/ui/Screen", () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/ui/HeaderActions", () => ({ HeaderActions: () => null }));
jest.mock("@/ui/QueryBoundary", () => ({
  QueryBoundary: ({ query, children }: { query: { data: unknown }; children: (data: unknown) => React.ReactNode }) => children(query.data),
}));
jest.mock("@/api/queries", () => ({
  keys: { trade: ["trade"] },
  useMe: () => ({ data: { user: { name: "Търговец", role: "TRADER" }, favoriteCrops: [] } }),
  useHome: () => ({ data: mockHome, dataUpdatedAt: mockNow }),
  useNotifications: () => ({ data: { unreadCount: 0 } }),
  useWeather: () => ({}),
  useMarket: () => ({}),
  useTrade: () => ({ data: { myOffers: [] } }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockHome = mockData;
});

it("labels listing totals and keeps the trader dashboard actions and listing navigation", async () => {
  await render(<HomeScreen />);
  expect(screen.getByText("Последни обяви от фермери")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Моите активни оферти: 18" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Обяви от фермери: 2" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Общо количество в обявите от фермери: 1000 т" }));
  expect(router.push).toHaveBeenLastCalledWith("/trade?tab=listings");
  for (const [label, href] of [
    ["Нова оферта", "/trade?tab=offers"],
    ["Пазарен обзор", "/ai/market"],
    ["Калкулатор", "/ai/calculator"],
  ]) {
    await fireEvent.press(screen.getByRole("button", { name: label }));
    expect(router.push).toHaveBeenLastCalledWith(href);
  }
  await fireEvent.press(screen.getByText("Пшеница хлебна"));
  expect(router.push).toHaveBeenLastCalledWith("/trade/listings/listing-1");
});

it("shows each port quote's actual date and handles missing market prices", async () => {
  const view = await render(<HomeScreen />);
  expect(screen.getByText("20.10.2026")).toBeTruthy();
  expect(screen.getByText("19.10.2026")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Варна: 205,00 евро на тон, към 20\.10\.2026/ })).toBeTruthy();
  await view.unmount();
  mockHome = { ...mockData, latestListings: [], prices: [] };
  await render(<HomeScreen />);
  expect(screen.getByText("Няма налични пазарни цени.")).toBeTruthy();
  expect(screen.getByText(/Все още няма отворени обяви/)).toBeTruthy();
});
