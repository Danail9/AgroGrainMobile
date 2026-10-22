import { fireEvent, render, screen } from "@testing-library/react-native";

import type { PriceRow } from "@/api/schemas";
import { CropValueCalculator } from "@/ui/CropValueCalculator";

const price: Pick<PriceRow, "portPrices"> = {
  portPrices: [
    { destination: "VARNA", label: "Варна", price: 204, date: "2026-10-20T10:00:00Z" },
    { destination: "BURGAS", label: "Бургас", price: 206, date: "2026-10-20T10:00:00Z" },
  ],
};

it("starts with 100 tonnes and estimates both port values and their difference", async () => {
  await render(<CropValueCalculator price={price} />);
  expect(screen.getByLabelText("Количество (т)").props.value).toBe("100");
  expect(screen.getByText("20 400 €")).toBeTruthy();
  expect(screen.getByText("20 600 €")).toBeTruthy();
  expect(screen.getByText("Разлика: 200 €")).toBeTruthy();
  expect(screen.queryByText(/,00 €/)).toBeNull();
  expect(screen.getByText("Ориентировъчна стойност по публикуваните цени")).toBeTruthy();
  expect(screen.getByText(/По-висока стойност за Бургас/)).toBeTruthy();
  expect(screen.getByText(/не отчита разходите до пристанището/)).toBeTruthy();
});

it.each(["12,5", "12.5"])("accepts a decimal quantity: %s", async (quantity) => {
  await render(<CropValueCalculator price={price} />);
  await fireEvent.changeText(screen.getByLabelText("Количество (т)"), quantity);
  expect(screen.getByText("2550 €")).toBeTruthy();
  expect(screen.getByText("2575 €")).toBeTruthy();
  expect(screen.getByText("Разлика: 25 €")).toBeTruthy();
});

it.each(["0", "-2", "abc", "1,2,3", "Infinity", "1e3", "."])("rejects invalid quantity %s without misleading totals", async (quantity) => {
  await render(<CropValueCalculator price={price} />);
  await fireEvent.changeText(screen.getByLabelText("Количество (т)"), quantity);
  expect(screen.getByText("Въведи количество, по-голямо от нула, с точка или запетая.")).toBeTruthy();
  expect(screen.queryByText("20 400 €")).toBeNull();
  expect(screen.queryByText(/Разлика:/)).toBeNull();
});

it("clears results and gives guidance when the input is empty, then recovers", async () => {
  await render(<CropValueCalculator price={price} />);
  await fireEvent.changeText(screen.getByLabelText("Количество (т)"), "");
  expect(screen.getByText("Въведи количество, за да изчислиш стойността.")).toBeTruthy();
  expect(screen.getAllByText("—")).toHaveLength(2);
  expect(screen.queryByText(/Разлика:/)).toBeNull();
  await fireEvent.changeText(screen.getByLabelText("Количество (т)"), "1");
  expect(screen.getByText("204 €")).toBeTruthy();
  expect(screen.getByText("206 €")).toBeTruthy();
});

it("never treats a missing port price as zero or compares it against a valid quote", async () => {
  await render(<CropValueCalculator price={{ portPrices: price.portPrices?.slice(0, 1) }} />);
  expect(screen.getByText("20 400 €")).toBeTruthy();
  expect(screen.getByText("Няма публикувана оферта")).toBeTruthy();
  expect(screen.queryByText(/Разлика:/)).toBeNull();
  expect(screen.queryByText("0 €")).toBeNull();
});

it("supports no quotes and equal quotes", async () => {
  const view = await render(<CropValueCalculator price={{}} />);
  expect(screen.getAllByText("Няма публикувана оферта")).toHaveLength(2);
  expect(screen.queryByText(/Разлика:/)).toBeNull();
  await view.rerender(<CropValueCalculator price={{
    portPrices: price.portPrices?.map((quote) => ({ ...quote, price: 204 })),
  }} />);
  expect(screen.getByText("Разлика: 0 €")).toBeTruthy();
  expect(screen.getByText("Еднаква стойност за двете пристанища.")).toBeTruthy();
});

it("uses refreshed quotes with the entered quantity and identifies Varna when higher", async () => {
  const view = await render(<CropValueCalculator price={price} />);
  await fireEvent.changeText(screen.getByLabelText("Количество (т)"), "10");
  await view.rerender(<CropValueCalculator price={{
    portPrices: price.portPrices?.map((quote) => ({ ...quote, price: quote.destination === "VARNA" ? 210 : 206 })),
  }} />);
  expect(screen.getByText("2100 €")).toBeTruthy();
  expect(screen.getByText("2060 €")).toBeTruthy();
  expect(screen.getByText("Разлика: 40 €")).toBeTruthy();
  expect(screen.getByText(/По-висока стойност за Варна/)).toBeTruthy();
});

it("rounds fractional euro values to two decimals", async () => {
  await render(<CropValueCalculator price={price} />);
  await fireEvent.changeText(screen.getByLabelText("Количество (т)"), "0,333");
  expect(screen.getByText("67,93 €")).toBeTruthy();
  expect(screen.getByText("68,60 €")).toBeTruthy();
  expect(screen.getByText("Разлика: 0,67 €")).toBeTruthy();
});

it("reports totals too large to represent safely", async () => {
  await render(<CropValueCalculator price={price} />);
  await fireEvent.changeText(screen.getByLabelText("Количество (т)"), "999999999999");
  expect(screen.getByText("Количеството е твърде голямо за изчисление.")).toBeTruthy();
  expect(screen.queryByText(/Разлика:/)).toBeNull();
});
