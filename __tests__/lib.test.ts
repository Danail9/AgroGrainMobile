import { Ionicons } from "@expo/vector-icons";

import { buildChart } from "@/lib/chart";
import { SECTION_STYLE, WEATHER_ICONS } from "@/lib/icons";
import { averagePrice, changeSentence, latestDay, strongestSignal } from "@/lib/market";
import { NOTIFICATION_ICONS, internalPath } from "@/lib/notifications";
import { planName, subscriptionLabel } from "@/lib/plans";
import { pushSupported } from "@/lib/push";
import { compareVersions, isUnsupported, updateAvailable } from "@/lib/version";
import { voiceError } from "@/lib/voice";
import { describeSoilMoisture, riskTone, riskyHours, weatherSummary } from "@/lib/weather";

describe("plans", () => {
  it("names a plan without any price", () => {
    expect(planName("MONTH", "BASE")).toBe("Стопанин · месечен");
    expect(planName("YEAR", "TRADER")).toBe("Търговец · годишен");
  });

  it("labels every account state", () => {
    const base = { exempt: false, freeAccess: false, interval: null, tier: null } as const;
    expect(subscriptionLabel({ ...base, exempt: true })).toBe("Администраторски достъп");
    expect(subscriptionLabel({ ...base, freeAccess: true })).toBe("Свободен достъп");
    expect(subscriptionLabel({ ...base, interval: "YEAR", tier: "BASE" })).toBe("Стопанин · годишен");
    expect(subscriptionLabel(base)).toBe("Няма активен план");
  });

  it("never carries a currency amount (reader-app rule)", () => {
    const all = [
      planName("MONTH", "BASE"),
      planName("YEAR", "TRADER"),
      subscriptionLabel({ exempt: false, freeAccess: false, interval: null, tier: null }),
    ].join(" ");
    expect(all).not.toMatch(/€|евро|\d/);
  });
});

describe("internalPath", () => {
  it("follows plain in-app paths", () => {
    expect(internalPath("/weather")).toBe("/weather");
    expect(internalPath("/trade/offers/ck3x9a")).toBe("/trade/offers/ck3x9a");
  });

  it("refuses anything that is not a plain path", () => {
    expect(internalPath(null)).toBeNull();
    expect(internalPath("")).toBeNull();
    expect(internalPath("https://evil.example/phish")).toBeNull();
    expect(internalPath("//evil.example")).toBeNull();
    expect(internalPath("/a?x=1")).toBeNull();
    expect(internalPath("javascript:alert(1)")).toBeNull();
  });
});

describe("weather helpers", () => {
  it("labels soil moisture", () => {
    expect(describeSoilMoisture(0.1)).toBe("Суха");
    expect(describeSoilMoisture(0.24)).toBe("Оптимална");
    expect(describeSoilMoisture(0.4)).toBe("Преовлажнена");
  });

  it("grades rain risk", () => {
    expect(riskTone(10)).toBe("brand");
    expect(riskTone(30)).toBe("warn");
    expect(riskTone(60)).toBe("danger");
  });

  it("summarises the day", () => {
    expect(
      weatherSummary({
        label: "Слънчево",
        temperature: 21,
        windSpeed: 9,
        humidity: 55,
        precipitationProbability: 10,
      }),
    ).toBe("Слънчево, 21°C. Вятър 9 km/h, влажност 55%, валежният риск е нисък.");
  });

  it("picks at most three risky hours from the next twelve", () => {
    const hour = (rain: number, wind: number) => ({ precipitationProbability: rain, windSpeed: wind });
    const hours = [
      hour(0, 0),
      hour(40, 0),
      hour(0, 20),
      hour(70, 30),
      hour(35, 0),
      ...Array.from({ length: 10 }, () => hour(90, 40)),
    ];
    const risky = riskyHours(hours);
    expect(risky).toHaveLength(3);
    expect(risky[0]).toEqual(hour(40, 0));
    // Hours beyond the twelfth are never considered.
    const calm = Array.from({ length: 12 }, () => hour(0, 0));
    expect(riskyHours([...calm, hour(99, 99)])).toEqual([]);
  });
});

describe("market analysis", () => {
  const row = (
    name: string,
    price: number,
    changePct: number | null,
    date = "2026-10-04T08:00:00.000Z",
  ) => ({ name, price, unit: "€/т", changePct, date });

  it("describes the day's movement", () => {
    const prices = [row("a", 1, 2), row("b", 1, -1), row("c", 1, 0), row("d", 1, 3)];
    expect(changeSentence(prices)).toBe("2 култури поскъпват, 1 поевтинява, 1 е без промяна.");
    expect(changeSentence([row("a", 1, 1)])).toContain("1 култура поскъпва");
  });

  it("says so when there is nothing to compare", () => {
    expect(changeSentence([row("a", 1, null)])).toBe(
      "Днес има публикувани цени, но без надеждна база за дневно сравнение.",
    );
  });

  it("finds the strongest mover in either direction", () => {
    expect(strongestSignal([row("a", 1, 2), row("b", 1, -5), row("c", 1, null)])?.name).toBe("b");
    expect(strongestSignal([row("a", 1, null)])).toBeUndefined();
  });

  it("averages, and survives an empty list", () => {
    expect(averagePrice([row("a", 100, 0), row("b", 201, 0)])).toBe(151);
    expect(averagePrice([])).toBe(0);
  });

  it("keeps only the most recent day's prices", () => {
    const result = latestDay([
      row("old", 1, 0, "2026-10-03T08:00:00.000Z"),
      row("new1", 2, 0, "2026-10-04T08:00:00.000Z"),
      row("new2", 3, 0, "2026-10-04T09:00:00.000Z"),
    ]);
    expect(result.prices.map((p) => p.name)).toEqual(["new1", "new2"]);
    expect(latestDay([]).prices).toEqual([]);
  });
});

describe("price chart geometry", () => {
  it("needs at least two points and a width", () => {
    expect(buildChart([5], 300)).toBeNull();
    expect(buildChart([5, 6], 0)).toBeNull();
  });

  it("maps min to the bottom and max to the top, within the padding", () => {
    const chart = buildChart([10, 20], 320, 112)!;
    expect(chart.min).toBe(10);
    expect(chart.max).toBe(20);
    expect(chart.rising).toBe(true);
    // The last point is the maximum, so it sits on the top padding line.
    expect(chart.end).toEqual({ x: 314, y: 12 });
    expect(chart.line.startsWith("M6,100")).toBe(true);
  });

  it("does not divide by zero on a flat series", () => {
    const chart = buildChart([50, 50, 50], 300)!;
    expect(chart.line).not.toMatch(/NaN|Infinity/);
    expect(chart.area).not.toMatch(/NaN|Infinity/);
  });

  it("reports a falling series", () => {
    expect(buildChart([20, 10], 300)!.rising).toBe(false);
  });
});

describe("icon names exist in the bundled icon set", () => {
  const glyphs = Ionicons.glyphMap as Record<string, number>;
  const names = [
    ...Object.values(WEATHER_ICONS).map((i) => i.name),
    ...Object.values(NOTIFICATION_ICONS),
    ...Object.values(SECTION_STYLE).map((s) => s.icon),
  ];

  it.each([...new Set(names)])("%s", (name) => {
    expect(glyphs[name]).toBeDefined();
  });
});

describe("version gate", () => {
  it("compares numerically, not as text", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("0.9.9", "1.0.0")).toBeLessThan(0);
  });

  it("flags only builds older than the minimum", () => {
    expect(isUnsupported("1.0.0", "1.0.0")).toBe(false);
    expect(isUnsupported("1.2.0", "1.0.0")).toBe(false);
    expect(isUnsupported("1.0.0", "1.1.0")).toBe(true);
  });

  it("reports a newer published build", () => {
    expect(updateAvailable("1.0.0", "1.1.0")).toBe(true);
    expect(updateAvailable("1.1.0", "1.1.0")).toBe(false);
  });

  it("treats a malformed version as 0 rather than throwing", () => {
    expect(isUnsupported("1.0.0", "abc")).toBe(false);
  });
});

describe("push and voice helpers", () => {
  it("push stays off without an EAS project id", () => {
    expect(pushSupported()).toBe(false);
  });

  it("maps speech errors to Bulgarian, with a safe fallback", () => {
    expect(voiceError("not-allowed")).toMatch(/микрофона/);
    expect(voiceError("something-new")).toBe("Гласовото въвеждане не е налично в момента.");
  });
});
