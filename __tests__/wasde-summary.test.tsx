import { fireEvent, render, screen } from "@testing-library/react-native";

import * as Linking from "expo-linking";

import { WasdeSummaryCard } from "@/ui/WasdeSummaryCard";

jest.mock("@/config", () => ({
  API_BASE: "https://www.agrograinhub.com/api/v1",
  API_FALLBACK_BASE: "https://www.agrograinhub.bg/api/v1",
  USER_AGENT: "AgroMobile/1.0.0 (iPhone)",
}));

jest.mock("expo-linking", () => ({
  openURL: jest.fn().mockResolvedValue(true),
}));

describe("WasdeSummaryCard", () => {
  it("shows the Bulgarian summary and links to the official report", async () => {
    const sourceUrl = "https://www.usda.gov/oce/commodity/wasde/wasde1026.pdf";
    await render(
      <WasdeSummaryCard
        summary={{
          reportMonth: "October 2026",
          sourceUrl,
          unit: "млн. метрични тона",
          comparisonMonth: "септември 2026",
          highlights: ["Пшеница (2026/27 г.): производство 825 млн. метрични тона."],
          estimates: [{
            commodity: "Пшеница",
            marketYear: "2026/27",
            production: 825,
            totalUse: 810,
            endingStocks: 270,
            productionChange: 5,
            endingStocksChange: 2,
          }, {
            commodity: "Ориз (смлян)",
            marketYear: "2026/27",
            production: 533.08,
            totalUse: 600.15,
            endingStocks: 198.5,
            productionChange: -0.77,
            endingStocksChange: 1.51,
          }],
        }}
        loading={false}
        error={false}
      />,
    );

    expect(screen.getByText("Световен баланс")).toBeTruthy();
    expect(screen.getAllByText("Производство")).toHaveLength(2);
    expect(screen.getAllByText("Остава в края на сезона")).toHaveLength(2);
    expect(screen.getByText("Оставащо количество след потреблението за сезона.")).toBeTruthy();
    expect(screen.getAllByText("Сезон 2026/27")).toHaveLength(2);
    expect(screen.getByText(/количествата са в млн\. метрични тона/)).toBeTruthy();
    expect(screen.getByText("825,00")).toBeTruthy();
    expect(screen.getByText("270,00")).toBeTruthy();
    expect(screen.getByText("Ориз (смлян)")).toBeTruthy();
    expect(screen.getByText("533,08")).toBeTruthy();
    expect(screen.getByText("198,50")).toBeTruthy();
    expect(screen.getByText(/не са прогноза или цени за България/)).toBeTruthy();
    expect(screen.queryByText(/810,00 млн\. т/)).toBeNull();

    await fireEvent.press(screen.getByText("Подробности и промени"));
    expect(screen.getAllByText("Общо потребление")).toHaveLength(2);
    expect(screen.getByText("810,00 млн. т")).toBeTruthy();
    expect(screen.getByText("Промяна: производство +5,00, наличност в края на сезона +2,00 млн. т")).toBeTruthy();

    await fireEvent.press(screen.getByText("Пълен доклад (PDF)"));
    expect(Linking.openURL).toHaveBeenCalledWith(sourceUrl);
  });

  it("shows an explicit error when the report cannot be loaded", async () => {
    await render(<WasdeSummaryCard loading={false} error />);

    expect(screen.getByText("Докладът WASDE временно не е достъпен")).toBeTruthy();
    expect(screen.getByText("Страница с докладите на USDA")).toBeTruthy();
  });
});
