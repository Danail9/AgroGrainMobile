import { fireEvent, render, screen } from "@testing-library/react-native";

import * as Linking from "expo-linking";

import { WasdeSummaryCard } from "@/ui/WasdeSummaryCard";

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
          }],
        }}
        loading={false}
        error={false}
      />,
    );

    expect(screen.getByText("Световен баланс")).toBeTruthy();
    expect(screen.getByText("825,00")).toBeTruthy();
    expect(screen.getByText("270,00")).toBeTruthy();
    expect(screen.getByText(/не са прогноза или цени за България/)).toBeTruthy();
    expect(screen.queryByText(/Потребление 810,00/)).toBeNull();

    await fireEvent.press(screen.getByText("Подробности и промени"));
    expect(screen.getByText(/Потребление 810,00/)).toBeTruthy();
    expect(screen.getByText(/произв\. \+5,00/)).toBeTruthy();

    await fireEvent.press(screen.getByText("Пълен доклад (PDF)"));
    expect(Linking.openURL).toHaveBeenCalledWith(sourceUrl);
  });

  it("shows an explicit error when the report cannot be loaded", async () => {
    await render(<WasdeSummaryCard loading={false} error />);

    expect(screen.getByText("Докладът WASDE временно не е достъпен")).toBeTruthy();
    expect(screen.getByText("Страница с докладите на USDA")).toBeTruthy();
  });
});
