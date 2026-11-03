import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import HomeScreen from "@/app/(app)/(tabs)/index";

const mockOffers = Array.from({ length: 5 }, (_, i) => ({
  id: String(i), title: `Offer ${i}`, price: 300 + i, unit: "€/т", regionSlug: i === 4 ? "dobrich" : "varna",
  trader: { name: "Trader", farmName: null },
}));
let mockCurrentOffers = mockOffers;
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock("@/ui/Screen", () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/ui/QueryBoundary", () => ({
  QueryBoundary: ({ query, children }: { query: { data: unknown }; children: (data: unknown) => React.ReactNode }) => children(query.data),
}));
jest.mock("@/ui/PriceRow", () => ({ PriceRow: ({ price }: { price: { slug: string } }) => {
  const { Text } = require("react-native");
  return <Text>{price.slug}</Text>;
} }));
jest.mock("@/api/queries", () => ({
  keys: { trade: ["trade"] },
  useMe: () => ({ data: { user: { name: "Farmer", role: "FARMER", regionSlug: "dobrich" },
    subscription: { canTrade: true }, favoriteCrops: ["crop4"] } }),
  useNotifications: () => ({ data: { unreadCount: 0 } }),
  useWeather: () => ({}),
  useRegions: () => ({ data: { regions: [{ slug: "dobrich", name: "Добрич" }, { slug: "varna", name: "Варна" }] } }),
  useMarket: () => ({ dataUpdatedAt: Date.now() }),
  useHome: () => ({ data: {
    role: "FARMER", regionName: "Добрич", offers: mockCurrentOffers,
    prices: Array.from({ length: 5 }, (_, i) => ({ slug: `crop${i}`, changePct: null })),
    weather: { current: { condition: { icon: "cloudy", label: "Облачно" }, temperature: 10,
      apparentTemperature: 9, windSpeed: 4, humidity: 80 }, today: null, fieldWork: null, isFallback: false },
    summary: { sections: [
      { icon: "weather", title: "Duplicate weather", body: "Repeated weather" },
      { icon: "market", title: "Duplicate prices", body: "Repeated prices" },
      { icon: "tip", title: "Useful tip", body: "One actionable insight" },
      { icon: "news", title: "More news", body: "Full overview only" },
    ] },
  } }),
}));
beforeEach(() => { jest.clearAllMocks(); mockCurrentOffers = mockOffers; });
it("limits favourite-first prices and region-first offers to three and removes repeated briefing sections", async () => {
  await render(<HomeScreen />);
  expect(screen.getByText("crop4")).toBeTruthy();
  expect(screen.getByText("crop0")).toBeTruthy();
  expect(screen.getByText("crop1")).toBeTruthy();
  expect(screen.queryByText("crop2")).toBeNull();
  expect(screen.getByText("Offer 4")).toBeTruthy();
  expect(screen.getByText("Offer 0")).toBeTruthy();
  expect(screen.getByText("Offer 1")).toBeTruthy();
  expect(screen.queryByText("Offer 2")).toBeNull();
  expect(screen.getAllByText("Добрич")).toHaveLength(2);
  expect(screen.queryByText("Влажност")).toBeNull();
  expect(screen.getByText("One actionable insight")).toBeTruthy();
  expect(screen.queryByText("Repeated weather")).toBeNull();
  expect(screen.queryByText("Repeated prices")).toBeNull();
  expect(screen.queryByText("Full overview only")).toBeNull();
  expect(screen.getByText("Полезен съвет")).toBeTruthy();
  expect(screen.getByText("Твоят дневен обзор")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: /Отвори дневния обзор/ }));
  expect(router.push).toHaveBeenCalledWith("/ai/daily");
});
it("provides an honest empty-offers state", async () => {
  mockCurrentOffers = [];
  await render(<HomeScreen />);
  expect(screen.getByText(/Няма налични оферти/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: /Отвори борсата/ }));
  expect(router.push).toHaveBeenCalledWith("/trade");
});
it("shows explicit full-width market and exchange actions instead of small header links", async () => {
  await render(<HomeScreen />);
  expect(screen.queryByText("Виж всички")).toBeNull();
  expect(screen.queryByText("Към борсата")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: /Виж всички пазарни цени/ }));
  expect(router.push).toHaveBeenLastCalledWith("/market");
  await fireEvent.press(screen.getByRole("button", { name: /Отвори борсата/ }));
  expect(router.push).toHaveBeenLastCalledWith("/trade");
});
