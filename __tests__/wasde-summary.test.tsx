import { fireEvent, render, screen } from "@testing-library/react-native";

import * as Linking from "expo-linking";

import { wasdeSummarySchema } from "@/api/schemas";
import { WasdeSummaryCard, formatWasdeDate, percentChange } from "@/ui/WasdeSummaryCard";

jest.mock("@/config", () => ({
  API_BASE: "https://www.agrograinhub.com/api/v1",
  API_FALLBACK_BASE: "https://www.agrograinhub.bg/api/v1",
  USER_AGENT: "AgroMobile/1.0.0 (iPhone)",
}));

jest.mock("expo-linking", () => ({
  openURL: jest.fn().mockResolvedValue(true),
}));

const sourceUrl = "https://www.usda.gov/oce/commodity/wasde/wasde1026.pdf";
const wheat = {
  commodity: "Пшеница", marketYear: "2026/27", production: 822.39, totalUse: 827.9, trade: 208.97,
  tradeLabel: "Търговия" as const, endingStocks: 276.04, productionChange: -0.04, totalUseChange: 1.15,
  tradeChange: -2.8, endingStocksChange: -0.25, stocksToUse: 33.3, signal: "tighter" as const,
  previousYear: { marketYear: "2025/26", production: 844.06, totalUse: 822.9, trade: 226.91, endingStocks: 281.55, stocksToUse: 34.2 },
  regions: [
    {
      name: "Русия", production: 88, exports: 40, imports: 0.3, endingStocks: 19.09,
      productionChange: 0, exportsChange: -3, previousYearProduction: 90.3, previousYearExports: 48,
    },
    {
      name: "Украйна", production: 26, exports: 12.5, imports: 0.1, endingStocks: 6.1,
      productionChange: 0, exportsChange: 0, previousYearProduction: 24.1, previousYearExports: 14.1,
    },
  ],
  context: "Русия, Украйна и ЕС са преките конкуренти на българската пшеница.",
};
const rice = {
  commodity: "Ориз (смлян)", marketYear: "2026/27", production: 533.08, totalUse: 600.15, trade: 61.35,
  tradeLabel: "Износ" as const, endingStocks: 198.5, productionChange: -0.77, totalUseChange: -2.08,
  tradeChange: -1.27, endingStocksChange: 1.51, stocksToUse: 33.1, signal: "steady" as const,
  previousYear: null, regions: [], context: "",
};
const summary = {
  reportMonth: "октомври 2026", sourceUrl, unit: "млн. метрични тона", comparisonMonth: "септември 2026",
  highlights: ["…"], estimates: [wheat, rice], releaseDate: "2026-10-09", nextReleaseDate: "2026-11-10",
};

describe("WasdeSummaryCard", () => {
  it("formats schedule dates and seasonal changes deterministically", () => {
    expect(formatWasdeDate("2026-11-10")).toBe("10 ноември 2026");
    expect(formatWasdeDate("2027-01-02")).toBe("2 януари 2027");
    expect(percentChange(822.39, 844.06)).toBe(-2.6);
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(10, null)).toBeNull();
  });

  it("shows release dates, headline metrics, the balance signal and per-crop details", async () => {
    await render(<WasdeSummaryCard summary={summary} loading={false} error={false} />);

    expect(screen.getByText("Световен баланс на зърното")).toBeTruthy();
    expect(screen.getByText("Доклад за октомври 2026 · публикуван на 9 октомври 2026")).toBeTruthy();
    expect(screen.getByText("10 ноември 2026")).toBeTruthy();
    expect(screen.getByText("По-стегнат баланс")).toBeTruthy();
    expect(screen.getByText("Без ясна посока")).toBeTruthy();
    expect(screen.getByText("Сезон 2026/27 · спрямо 2025/26")).toBeTruthy();
    expect(screen.getByText("822,39")).toBeTruthy();
    expect(screen.getByText("−2,6% г/г")).toBeTruthy();
    expect(screen.getByText("33,3%")).toBeTruthy();
    expect(screen.getByText("−0,9 п. г/г")).toBeTruthy();
    expect(screen.getByText("Сезон 2026/27")).toBeTruthy();
    expect(screen.queryByText("Ключови региони за България")).toBeNull();
    expect(screen.queryByText("827,90")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Покажи подробности за Пшеница"));
    expect(screen.getByText("Запасите спрямо потреблението намаляват — предлагането е по-ограничено.")).toBeTruthy();
    expect(screen.getByText("827,90")).toBeTruthy();
    expect(screen.getByText("Търговия")).toBeTruthy();
    expect(screen.getByText("Ревизия на запасите спрямо септември 2026")).toBeTruthy();
    expect(screen.getByText("−0,25")).toBeTruthy();
    expect(screen.getByText("Ключови региони за България")).toBeTruthy();
    expect(screen.getByText("Русия")).toBeTruthy();
    expect(screen.getByText("−16,7% спрямо 2025/26 · −3,00 за месеца")).toBeTruthy();
    expect(screen.getByText("+7,9% спрямо 2025/26")).toBeTruthy();
    expect(screen.getByText(/Русия, Украйна и ЕС са преките конкуренти/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Покажи подробности за Ориз (смлян)"));
    expect(screen.queryByText("Русия")).toBeNull();
    expect(screen.getByText("Износ")).toBeTruthy();
    expect(screen.queryByText("Ключови региони за България")).toBeNull();
    expect(screen.queryByText(/Защо е важно/)).toBeNull();

    await fireEvent.press(screen.getByText("Пълен доклад (PDF)"));
    expect(Linking.openURL).toHaveBeenCalledWith(sourceUrl);
  });

  it("accepts summaries cached by older app versions and hides what they lack", async () => {
    const legacy = wasdeSummarySchema.parse({
      reportMonth: "октомври 2026", sourceUrl, unit: "млн. метрични тона", comparisonMonth: null, highlights: [],
      estimates: [{
        commodity: "Пшеница", marketYear: "2026/27", production: 825, totalUse: 810, endingStocks: 270,
        productionChange: null, endingStocksChange: null,
      }],
    });
    await render(<WasdeSummaryCard summary={legacy} loading={false} error />);
    expect(screen.getByText("Доклад за октомври 2026")).toBeTruthy();
    expect(screen.queryByText(/Следващ доклад/)).toBeNull();
    expect(screen.queryByText(/баланс$/)).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText(/показваме последното заредено обобщение/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Покажи подробности за Пшеница"));
    expect(screen.getByText("Ревизия на производството")).toBeTruthy();
  });

  it("shows an explicit error when the report cannot be loaded", async () => {
    await render(<WasdeSummaryCard loading={false} error />);

    expect(screen.getByText("Докладът WASDE временно не е достъпен")).toBeTruthy();
    expect(screen.getByText("Страница с докладите на USDA")).toBeTruthy();
  });
});
