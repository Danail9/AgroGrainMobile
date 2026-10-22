import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { WeatherStats } from "@/ui/WeatherStats";
import { colors } from "@/theme/tokens";

describe("WeatherStats", () => {
  it("summarizes year-to-date rainfall and highlights monthly differences", async () => {
    await render(
      <WeatherStats
        regionName="Добрич"
        history={{
          through: "2026-02-28",
          periods: [{
            key: "ytd",
            label: "От началото на годината",
            from: "2026-01-01",
            to: "2026-02-28",
            current: {
              year: 2026,
              days: 59,
              avgTemp: 5,
              maxTemp: 16,
              minTemp: -2,
              precipitation: 175,
              rainDays: 12,
            },
            previous: {
              year: 2025,
              days: 59,
              avgTemp: 4,
              maxTemp: 15,
              minTemp: -3,
              precipitation: 125,
              rainDays: 10,
            },
          }],
          months: [{
            month: 1,
            label: "яну",
            current: { precipitation: 125, avgTemp: 4, days: 31 },
            previous: { precipitation: 75, avgTemp: 3, days: 31 },
          }, {
            month: 2,
            label: "фев",
            current: { precipitation: 50, avgTemp: 6, days: 28 },
            previous: { precipitation: 75, avgTemp: 5, days: 28 },
          }],
        }}
      />,
    );

    expect(screen.getByText("Валежи по месеци")).toBeTruthy();
    expect(screen.getByText("Сравнение за януари – февруари")).toBeTruthy();
    expect(screen.getByText("2026 · натрупани валежи")).toBeTruthy();
    expect(screen.getAllByText("175 mm")).toHaveLength(2);
    expect(screen.getByText("150 mm")).toBeTruthy();
    expect(screen.getByText("↑ 50 mm")).toBeTruthy();
    expect(screen.getByText("↓ 25 mm")).toBeTruthy();
    expect(screen.getByText("+25 mm")).toBeTruthy();
    expect(screen.getByText("+17%")).toBeTruthy();
    expect(screen.getByText("Общо за периода: 175 mm през 2026 срещу 150 mm през 2025.")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText("+25 mm").props.style).color).toBe(colors.up);
    expect(StyleSheet.flatten(screen.getByText("↑ 50 mm").props.style).color).toBe(colors.up);
    expect(StyleSheet.flatten(screen.getByText("↓ 25 mm").props.style).color).toBe(colors.down);
  });
});
