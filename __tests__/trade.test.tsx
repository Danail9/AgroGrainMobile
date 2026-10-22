import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { PriceRow } from "@/api/schemas";
import {
  expiryOf,
  filterOffers,
  findMarketRow,
  formatPrice,
  groupByDay,
  marketDelta,
} from "@/lib/trade";
import { DismissibleHint } from "@/ui/DismissibleHint";
import { Tabs } from "@/ui/Tabs";
import { OfferForm } from "@/ui/TradeForms";

let mockPortPrices: PriceRow[] = [];
jest.mock("@/api/queries", () => ({
  useMarket: () => ({ data: { prices: mockPortPrices } }),
  useMe: () => ({ data: { favoriteCrops: ["wheat"] } }),
  useCreateOffer: () => ({ mutate: jest.fn(), isPending: false }),
  useCreateListing: () => ({ mutate: jest.fn(), isPending: false }),
}));

const NOW = new Date(2026, 9, 9, 10, 0).getTime();
const DAY = 86_400_000;
const row = (name: string, price: number, unit = "€/т") =>
  ({ slug: name, name, price, unit, emoji: "🌾" }) as unknown as PriceRow;

describe("trade helpers", () => {
  it("drops cents from whole prices only", () => {
    expect(formatPrice(700, "€/т")).toBe("700 €/т");
    expect(formatPrice(12.5, "€/кг")).toBe("12,50 €/кг");
    expect(formatPrice(1250)).toBe("1250");
  });

  it("offers explicit port-price fills without a misleading generic market comparison", async () => {
    mockPortPrices = [{
      ...row("Пшеница", 205), slug: "wheat", category: "GRAIN", portPrices: [
        { destination: "VARNA", label: "Доставено до пристанище Варна", price: 205, date: "2026-10-20" },
        { destination: "BURGAS", label: "Доставено до пристанище Бургас", price: 210.5, date: "2026-10-20" },
      ],
    }];
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <OfferForm crops={[{ slug: "wheat", name: "Пшеница" }]} fertilizers={[]} />
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByLabelText("Избери Пшеница"));
    expect(screen.getByText("205,00 €/т")).toBeTruthy();
    expect(screen.getByText("210,50 €/т")).toBeTruthy();
    expect(screen.queryByText(/Пазарна цена днес/)).toBeNull();
    await fireEvent.press(screen.getByText("Използвай Бургас"));
    expect(screen.getByLabelText("Цена").props.value).toBe("210.5");
    expect(screen.queryByText(/над пазара|под пазара|Колкото пазара/)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Мярка"), "€/кг");
    expect(screen.queryByText("Използвай Варна")).toBeNull();
    expect(screen.queryByText("Използвай Бургас")).toBeNull();
  });

  it("matches an offer to its market row by name, ignoring case and spaces", () => {
    const prices = [row("Пшеница хлебна", 225), row("Рапица", 512)];
    expect(findMarketRow(" пшеница хлебна ", prices)?.price).toBe(225);
    expect(findMarketRow("Лен", prices)).toBeNull();
    expect(findMarketRow("Рапица", undefined)).toBeNull();
  });

  it("compares with the market only in the same unit", () => {
    expect(marketDelta(250, "€/т", row("x", 200))).toBe(25);
    expect(marketDelta(150, "€/т", row("x", 200))).toBe(-25);
    expect(marketDelta(250, "€/кг", row("x", 200))).toBeNull();
    expect(marketDelta(null, "€/т", row("x", 200))).toBeNull();
    expect(marketDelta(250, "€/т", null)).toBeNull();
  });

  it("does not compare a trade price against an unspecified port's delivered quote", () => {
    const delivered: PriceRow = {
      ...row("Пшеница", 205), delivery: "VARNA", portPrices: [
        { destination: "VARNA", label: "Доставено до пристанище Варна", price: 205, date: new Date(NOW).toISOString() },
      ],
    };
    expect(marketDelta(250, "€/т", delivered)).toBeNull();
    expect(marketDelta(250, "€/т", { ...delivered, portPrices: undefined })).toBeNull();
  });

  it("words the expiry and warns in the last three days", () => {
    expect(expiryOf(null, NOW)).toBeNull();
    expect(expiryOf(new Date(NOW - 1000).toISOString(), NOW)).toEqual({ label: "изтекла", tone: "danger" });
    expect(expiryOf(new Date(NOW + 5 * 3_600_000).toISOString(), NOW)?.label).toBe("изтича днес");
    expect(expiryOf(new Date(NOW + 2.5 * DAY).toISOString(), NOW)).toEqual({
      label: "изтича след 3 дни",
      tone: "warn",
    });
    expect(expiryOf(new Date(2026, 9, 30, 12).toISOString(), NOW)).toEqual({ label: "до 30.10", tone: "muted" });
  });

  const offers = [
    { id: "a", category: "CROP", title: "Пшеница", price: 200, createdAt: new Date(NOW - 2 * DAY).toISOString() },
    { id: "b", category: "FERTILIZER", title: "Карбамид", price: 600, createdAt: new Date(NOW - 3600_000).toISOString() },
    { id: "c", category: "CROP", title: "Рапица", price: 500, createdAt: new Date(NOW - DAY).toISOString() },
  ];
  const ids = (list: { id: string }[]) => list.map((o) => o.id);

  it("filters by category and favourites, and sorts", () => {
    expect(ids(filterOffers(offers, { category: "ALL", sort: "new", favoritesOnly: false }))).toEqual(["b", "c", "a"]);
    expect(ids(filterOffers(offers, { category: "ALL", sort: "price", favoritesOnly: false }))).toEqual(["b", "c", "a"]);
    expect(ids(filterOffers(offers, { category: "CROP", sort: "price", favoritesOnly: false }))).toEqual(["c", "a"]);
    expect(ids(filterOffers(offers, { category: "ALL", sort: "new", favoritesOnly: true }, ["пшеница"]))).toEqual(["a"]);
  });

  it("groups into today and earlier, dropping empty groups", () => {
    const groups = groupByDay(offers, NOW);
    expect(groups.map((g) => [g.title, ids(g.items)])).toEqual([
      ["Днес", ["b"]],
      ["По-рано", ["a", "c"]],
    ]);
    expect(groupByDay([offers[0]], NOW).map((g) => g.title)).toEqual(["По-рано"]);
  });
});

describe("segmented Tabs", () => {
  it("shows counts, hides zero, and reports the chosen tab", async () => {
    const onChange = jest.fn();
    await render(
      <Tabs
        variant="segmented"
        onChange={onChange}
        items={[
          { key: "a", label: "Оферти", count: 4, content: <Text>first</Text> },
          { key: "b", label: "Запазени", count: 0, content: <Text>second</Text> },
        ]}
      />,
    );
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByLabelText("Оферти, 4")).toBeTruthy();
    await fireEvent.press(screen.getByText("Запазени"));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.getByText("second")).toBeTruthy();
  });
});

describe("DismissibleHint", () => {
  beforeEach(() => AsyncStorage.clear());

  it("closes and remembers the choice", async () => {
    await render(<DismissibleHint id="t" icon="swap-horizontal">Подсказка</DismissibleHint>);
    expect(await screen.findByText("Подсказка")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Скрий подсказката"));
    expect(screen.queryByText("Подсказка")).toBeNull();
    expect(await AsyncStorage.getItem("hint-dismissed:t")).toBe("1");
  });

  it("stays hidden once dismissed", async () => {
    await AsyncStorage.setItem("hint-dismissed:t", "1");
    await render(<DismissibleHint id="t" icon="swap-horizontal">Подсказка</DismissibleHint>);
    await act(async () => {
      await AsyncStorage.getItem("hint-dismissed:t");
    });
    expect(screen.queryByText("Подсказка")).toBeNull();
  });
});
