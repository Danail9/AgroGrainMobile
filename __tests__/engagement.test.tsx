import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { computeProfit, CALCULATORS, initialValues, runCalculator } from "@/lib/calculators";
import { buildComparisonChart, buildChart, canCompare, yearOverYear } from "@/lib/chart";
import { favoritesFirst, homePrices } from "@/lib/favorites";
import { DialogHost, confirmDialog, resetDialogs, showDialog } from "@/ui/Dialog";

const day = (d: number) => new Date(Date.UTC(2026, 0, 1 + d)).toISOString();

describe("profit calculator", () => {
  it("computes revenue, profit and break-even points", () => {
    const r = computeProfit({ area: 100, yieldKg: 500, price: 200, cost: 80 });
    expect(r.tonnes).toBe(50);
    expect(r.revenue).toBe(10_000);
    expect(r.expenses).toBe(8_000);
    expect(r.profit).toBe(2_000);
    expect(r.profitPerDka).toBe(20);
    expect(r.breakEvenPrice).toBe(160);
    expect(r.breakEvenYield).toBe(400);
  });

  it("returns null instead of dividing by zero", () => {
    const r = computeProfit({ area: 0, yieldKg: 0, price: 0, cost: 80 });
    expect(r.profitPerDka).toBeNull();
    expect(r.breakEvenPrice).toBeNull();
    expect(r.breakEvenYield).toBeNull();
  });

  it("labels a negative result as a loss", () => {
    const def = CALCULATORS.find((c) => c.key === "profit")!;
    const labels = runCalculator(def, { ...initialValues(def), price: "10" }).map((r) => r.label);
    expect(labels).toContain("Загуба");
    expect(labels).not.toContain("Печалба");
  });
});

describe("price history comparison", () => {
  const series = [0, 10, 20, 30].map((d, i) => ({ date: day(d), price: 200 + i * 10 }));

  it("draws last year on the same axes and only over the overlap", () => {
    const compare = [-5, 0, 15, 30, 40].map((d) => ({ date: day(d), price: 150 }));
    const geo = buildComparisonChart(series, compare, 300)!;
    expect(geo.line).toMatch(/^M/);
    expect(geo.compareLine).toMatch(/^M/);
    // Three overlapping points → one move and two line segments.
    expect(geo.compareLine!.split("L")).toHaveLength(3);
  });

  it("omits the comparison line when last year has no overlap", () => {
    const geo = buildComparisonChart(series, [{ date: day(-60), price: 100 }], 300)!;
    expect(geo.compareLine).toBeNull();
  });

  it("needs at least two points, like the plain chart", () => {
    expect(buildComparisonChart(series.slice(0, 1), [], 300)).toBeNull();
    expect(buildChart([1], 300)).toBeNull();
  });

  it("allows the comparison only with two last-year points in the window", () => {
    expect(canCompare(series, undefined)).toBe(false);
    expect(canCompare(series, [{ date: day(-60), price: 1 }, { date: day(5), price: 1 }])).toBe(false);
    expect(canCompare(series, [{ date: day(5), price: 1 }, { date: day(25), price: 1 }])).toBe(true);
  });

  it("compares the latest price with the nearest one a year ago", () => {
    expect(yearOverYear(series, [{ date: day(28), price: 200 }])).toBeCloseTo(15);
  });

  it("skips year-over-year when no point is within two weeks", () => {
    expect(yearOverYear(series, [{ date: day(0), price: 200 }])).toBeNull();
    expect(yearOverYear(series, [])).toBeNull();
  });
});

describe("favoritesFirst", () => {
  const items = [{ slug: "wheat" }, { slug: "corn" }, { slug: "barley" }];

  it("moves followed crops up and keeps the remaining order", () => {
    expect(favoritesFirst(items, ["barley"]).map((i) => i.slug)).toEqual(["barley", "wheat", "corn"]);
  });

  it("returns the list unchanged without favourites", () => {
    expect(favoritesFirst(items)).toBe(items);
  });
});

describe("Dialog", () => {
  afterEach(async () => {
    await act(async () => resetDialogs());
  });

  it("shows queued dialogs one at a time", async () => {
    await render(<DialogHost />);
    await act(async () => {
      showDialog({ title: "Първи", actions: [{ label: "OK" }] });
      showDialog({ title: "Втори" });
    });
    expect(screen.getByText("Първи")).toBeTruthy();
    expect(screen.queryByText("Втори")).toBeNull();
    await fireEvent.press(screen.getByText("OK"));
    expect(screen.getByText("Втори")).toBeTruthy();
  });

  it("resolves confirmDialog with the chosen action", async () => {
    await render(<DialogHost />);
    let confirmed: Promise<boolean>;
    await act(async () => {
      confirmed = confirmDialog({ title: "Сигурен ли си?", confirmLabel: "Да" });
    });
    await fireEvent.press(screen.getByText("Да"));
    await expect(confirmed!).resolves.toBe(true);

    await act(async () => {
      confirmed = confirmDialog({ title: "Отново?", confirmLabel: "Да", cancelLabel: "Не" });
    });
    await fireEvent.press(screen.getByText("Не"));
    await expect(confirmed!).resolves.toBe(false);
  });
});

describe("homePrices", () => {
  const home = ["wheat", "sunflower", "rapeseed", "barley"].map((slug) => ({ slug }));
  const market = [...home, { slug: "alfalfa" }, { slug: "corn" }];
  const slugs = (list: { slug: string }[]) => list.map((i) => i.slug);

  it("adds favourites missing from the server list from the market list", () => {
    expect(slugs(homePrices(home, market, ["alfalfa", "wheat"]))).toEqual([
      "alfalfa", "wheat", "sunflower", "rapeseed",
    ]);
  });

  it("shows every favourite even past four rows", () => {
    expect(slugs(homePrices(home, market, ["corn", "alfalfa", "barley", "wheat", "rapeseed"]))).toHaveLength(5);
  });

  it("keeps the server list without favourites or market data", () => {
    expect(homePrices(home, undefined, [])).toBe(home);
    expect(slugs(homePrices(home, undefined, ["alfalfa"]))).toEqual(slugs(home));
  });
});
