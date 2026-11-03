import { fireEvent, render, screen } from "@testing-library/react-native";
import MarketAnalysisScreen from "@/app/(app)/ai/market";
import { compareCropPorts } from "@/lib/market-analysis";
import type { PriceRow } from "@/api/schemas";
const mockInsight = jest.fn();
const mockCrop: PriceRow = { slug: "wheat", name: "Пшеница хлебна", emoji: "", category: "GRAIN", unit: "€/т",
  price: 205, changePct: null, sortIdx: 0, date: "2026-11-01T00:00:00Z", portPrices: [
    { destination: "VARNA", label: "Варна", price: 205, date: "2026-11-01T00:00:00Z" },
    { destination: "BURGAS", label: "Бургас", price: 206, date: "2026-11-01T00:00:00Z" },
  ] };
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/ui/Screen", () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/ui/QueryBoundary", () => ({ QueryBoundary: ({ query, children }: {
  query: { data: unknown }; children: (data: unknown) => React.ReactNode;
}) => children(query.data) }));
jest.mock("@/api/queries", () => ({
  useMe: () => ({ data: { favoriteCrops: [] } }),
  useMarket: () => ({ data: { prices: [mockCrop], news: [
    { slug: "wheat-news", title: "Пшеницата в Европа", summary: "Context", source: "Source", publishedAt: "2026-11-01T00:00:00Z" },
    { slug: "other", title: "Друга новина", summary: "Unrelated", source: "Source", publishedAt: "2026-11-01T00:00:00Z" },
  ] } }),
  useCropInsight: (...args: unknown[]) => { mockInsight(...args); return { data: { content: "Comment", source: "openai" } }; },
}));
it("compares same-date prices, refuses mismatched dates and handles missing ports", () => {
  expect(compareCropPorts(mockCrop).difference).toBe(1);
  expect(compareCropPorts(mockCrop).percent).toBeCloseTo(100 / 205);
  expect(compareCropPorts({ ...mockCrop, portPrices: [] }).difference).toBeNull();
  expect(compareCropPorts({ ...mockCrop, portPrices: mockCrop.portPrices?.map((p) =>
    p.destination === "BURGAS" ? { ...p, date: "2026-10-31T00:00:00Z" } : p) }).difference).toBeNull();
});
it("leads with factual comparison, filters news and loads commentary only on request", async () => {
  await render(<MarketAnalysisScreen />);
  expect(screen.getByText("Бургас е с 1 €/т над Варна.")).toBeTruthy();
  expect(screen.getByText("Пшеницата в Европа")).toBeTruthy();
  expect(screen.queryByText("Друга новина")).toBeNull();
  expect(screen.getByText(/Няма достатъчно исторически данни/)).toBeTruthy();
  expect(mockInsight).toHaveBeenLastCalledWith("wheat", undefined, false);
  await fireEvent.press(screen.getByRole("button", { name: "Зареди коментар" }));
  expect(mockInsight).toHaveBeenLastCalledWith("wheat", undefined, true);
  expect(screen.getByText("Comment")).toBeTruthy();
});
