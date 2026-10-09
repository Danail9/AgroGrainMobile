import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { PriceRow } from "@/api/schemas";
import { catalogSections } from "@/lib/trade";
import { CatalogPicker, OTHER } from "@/ui/CatalogPicker";

const row = (slug: string, name: string, category: string, price = 200) =>
  ({ slug, name, category, price, unit: "€/т" }) as unknown as PriceRow;

const options = [
  { slug: "wheat", name: "Пшеница", emoji: "🌾" },
  { slug: "rapeseed", name: "Рапица", emoji: "🌼" },
  { slug: "alfalfa", name: "Люцерна" },
];
const prices = [row("wheat", "Пшеница", "GRAIN", 225), row("rapeseed", "Рапица", "OILSEED", 512)];

describe("catalogSections", () => {
  it("puts favourites first, groups the rest like the market", () => {
    const sections = catalogSections(options, prices, ["rapeseed"]);
    expect(sections.map((s) => [s.title, s.data.map((d) => d.option.name)])).toEqual([
      ["Любими", ["Рапица"]],
      ["Зърнени", ["Пшеница"]],
      ["Без пазарна цена", ["Люцерна"]],
    ]);
    expect(sections[0].data[0].market?.price).toBe(512);
  });

  it("filters by search, ignoring case, and drops empty sections", () => {
    const sections = catalogSections(options, prices, [], "  пш");
    expect(sections).toHaveLength(1);
    expect(sections[0].data.map((d) => d.option.name)).toEqual(["Пшеница"]);
  });

  it("lists everything under one section when there are no prices", () => {
    expect(catalogSections(options, undefined).map((s) => s.title)).toEqual(["Всички"]);
  });
});

function Harness() {
  const [choice, setChoice] = useState("");
  const [custom, setCustom] = useState("");
  return (
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
    >
      <CatalogPicker
      label="Култура"
      noun="култура"
      options={options}
      choice={choice}
      custom={custom}
      onChoice={setChoice}
      onCustom={setCustom}
      placeholder="Люцерна"
      prices={prices}
      favorites={["wheat"]}
      />
    </SafeAreaProvider>
  );
}

describe("CatalogPicker", () => {
  it("picks a crop from the searchable sheet and shows its market price", async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByLabelText("Избери култура"));
    await fireEvent.changeText(screen.getByLabelText("Търси"), "рап");
    expect(screen.queryByText("Люцерна")).toBeNull();
    await fireEvent.press(screen.getByText("Рапица"));
    expect(await screen.findByText("Пазарна цена днес: 512 €/т")).toBeTruthy();
  });

  it("offers favourites as one-tap chips", async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByLabelText("Избери Пшеница"));
    expect(await screen.findByText("Пазарна цена днес: 225 €/т")).toBeTruthy();
  });

  it("falls back to a typed name", async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByLabelText("Избери култура"));
    await fireEvent.press(screen.getByText("Не е в списъка — напиши име"));
    expect(await screen.findByLabelText("Наименование")).toBeTruthy();
    expect(OTHER).toBe("__other__");
  });
});

describe("numericInput", () => {
  it("keeps only digits and one decimal separator", () => {
    const { numericInput } = jest.requireActual("@/lib/forms") as typeof import("@/lib/forms");
    expect(numericInput("500")).toBe("500");
    expect(numericInput("5a0b0 т")).toBe("500");
    expect(numericInput("-12,5")).toBe("12,5");
    expect(numericInput("1.2.3")).toBe("1.23");
    expect(numericInput("12,345")).toBe("12,34");
    expect(numericInput(",5")).toBe("0,5");
    expect(numericInput("abc")).toBe("");
  });
});
