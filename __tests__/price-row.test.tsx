import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { marketResponseSchema } from "@/api/schemas";
import { PriceRow, type PriceRowData } from "@/ui/PriceRow";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

const price: PriceRowData = {
  slug: "wheat-bread", name: "Пшеница хлебна", emoji: "🌾", category: "GRAIN",
  unit: "€/т", price: 205, changePct: null, sortIdx: 0, date: "2026-10-20T10:00:00.000Z",
  delivery: "VARNA", deliveryLabel: "Доставено до пристанище Варна",
  portPrices: [
    { destination: "VARNA", label: "Доставено до пристанище Варна", price: 205, date: "2026-10-20T10:00:00.000Z" },
    { destination: "BURGAS", label: "Доставено до пристанище Бургас", price: 210.5, date: "2026-10-20T09:00:00.000Z" },
  ],
};

it("keeps delivered-price metadata when parsing the mobile market response", () => {
  const result = marketResponseSchema.parse({ prices: [price], fertilizers: [], news: [] });
  expect(result.prices[0].delivery).toBe("VARNA");
  expect(result.prices[0].portPrices).toHaveLength(2);
});

it("shows port-only crops with the delivery basis and other port quote", async () => {
  await render(<PriceRow price={price} showChange={false} fullUnit />);
  expect(screen.getByText("Пшеница хлебна")).toBeTruthy();
  expect(screen.getByText("🌾")).toBeTruthy();
  expect(screen.getByText("Варна")).toBeTruthy();
  expect(screen.getByText("Бургас")).toBeTruthy();
  expect(screen.getByText("210,50 €/т")).toBeTruthy();
  expect(screen.getByText("205 €/т")).toBeTruthy();
  expect(screen.getByRole("button")).toHaveStyle({ flexDirection: "row" });
  expect(screen.getByRole("button").props.accessibilityLabel).toContain("Варна: 205,00 евро на тон");
  expect(screen.getByRole("button").props.accessibilityLabel).toContain("Бургас: 210,50 евро на тон");
  expect(screen.queryByText(/Национална/)).toBeNull();
  await fireEvent.press(screen.getByRole("button"));
  expect(router.push).toHaveBeenCalledWith("/market/wheat-bread");
});

it("shows an unavailable port explicitly without inventing a zero price", async () => {
  await render(<PriceRow price={{ ...price, portPrices: price.portPrices?.slice(0, 1) }} showChange={false} />);
  expect(screen.getByText("205 €/т")).toBeTruthy();
  expect(screen.getByText("—")).toBeTruthy();
  expect(screen.queryByText("0,00 €/т")).toBeNull();
  expect(screen.getByRole("button").props.accessibilityLabel).toContain("Бургас: Няма публикувана оферта");
});

it("still supports older API responses without delivery metadata", async () => {
  const { delivery: _delivery, deliveryLabel: _label, portPrices: _ports, ...legacy } = price;
  await render(<PriceRow price={legacy} showChange={false} />);
  expect(screen.getByText("Пшеница хлебна")).toBeTruthy();
  expect(screen.queryByText(/Доставено/)).toBeNull();
});
