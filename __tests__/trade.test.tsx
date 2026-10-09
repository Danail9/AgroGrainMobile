import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

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
