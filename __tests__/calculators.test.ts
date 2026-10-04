import {
  CALCULATORS,
  initialValues,
  runCalculator,
  sanitizeDecimal,
  toNumber,
} from "@/lib/calculators";
import { splitPhone, telHref } from "@/lib/phone";

const NBSP = " ";
const byKey = (key: string) => CALCULATORS.find((c) => c.key === key)!;

function resultsOf(key: string, overrides: Record<string, string> = {}) {
  const def = byKey(key);
  const rows = runCalculator(def, { ...initialValues(def), ...overrides });
  return Object.fromEntries(rows.map((r) => [r.label, r.value]));
}

describe("number parsing", () => {
  it("accepts the Bulgarian decimal comma", () => {
    expect(toNumber("1,6")).toBe(1.6);
    expect(toNumber("34.4")).toBe(34.4);
  });

  it("treats empty and garbage as zero, so typing never shows NaN", () => {
    expect(toNumber("")).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("abc")).toBe(0);
  });

  it("strips everything except digits and separators", () => {
    expect(sanitizeDecimal("1a2,5-€")).toBe("12,5");
  });
});

describe("calculators (default values, checked by hand)", () => {
  it("has the six calculators of the portal", () => {
    expect(CALCULATORS.map((c) => c.key)).toEqual([
      "seeds",
      "fertilizer",
      "spray",
      "yield",
      "area",
      "cost",
    ]);
  });

  it("seeds: 100 дка × 22 кг/дка at 1,6 €/кг", () => {
    expect(resultsOf("seeds")).toEqual({
      "Общо семена": "2200 кг",
      "Чували по 25 кг": "88",
      "Обща стойност": "3520,00 €",
    });
  });

  it("fertilizer: 100 дка × 18 кг/дка, 34,4% N, 950 €/т", () => {
    expect(resultsOf("fertilizer")).toEqual({
      "Общо тор": "1800 кг",
      "Чист азот": "619 кг",
      "Съдържание на активно вещество": "6,2 кг/дка",
      "Обща стойност": "1710,00 €",
    });
  });

  it("spray: 100 дка, 120 мл/дка, 20 л/дка, 2000 л tank", () => {
    expect(resultsOf("spray")).toEqual({
      "Общо препарат": "12,00 л",
      "Работен разтвор": "2000 л",
      "Брой пълнения": "1",
      "Препарат на резервоар": "12,00 л",
    });
  });

  it("spray: rounds the number of tank fills up", () => {
    expect(resultsOf("spray", { area: "101" })["Брой пълнения"]).toBe("2");
  });

  it("spray: a zero tank or water field never produces Infinity or NaN", () => {
    const zeroTank = resultsOf("spray", { tank: "0" });
    expect(zeroTank["Брой пълнения"]).toBe("0");
    const zeroWater = resultsOf("spray", { water: "0" });
    expect(zeroWater["Препарат на резервоар"]).toBe("0,00 л");
    for (const value of [...Object.values(zeroTank), ...Object.values(zeroWater)]) {
      expect(value).not.toMatch(/Infinity|NaN/);
    }
  });

  it("yield: 100 дка × 520 кг/дка at 380 €/т", () => {
    expect(resultsOf("yield")).toEqual({
      "Общ добив": "52,00 т",
      "Очакван приход": "19760,00 €".replace("19760", `19${NBSP}760`),
      "Приход на декар": "197,60 €/дка",
    });
  });

  it("area: converts 100 дка", () => {
    expect(resultsOf("area")).toEqual({
      Хектари: "10,00 ха",
      "Квадратни метри": `100${NBSP}000 м²`,
      Акри: "24,71 акра",
    });
  });

  it("cost: revenue, expenses, profit and profitability", () => {
    expect(resultsOf("cost")).toEqual({
      Приход: `19${NBSP}760,00 €`,
      Разходи: `14${NBSP}500,00 €`,
      Печалба: "5260,00 €",
      Рентабилност: "36,3%",
    });
  });

  it("cost: shows a dash instead of dividing by zero expenses", () => {
    expect(resultsOf("cost", { cost: "0" })["Рентабилност"]).toBe("—");
  });

  it("every calculator survives all-empty fields", () => {
    for (const def of CALCULATORS) {
      const empty = Object.fromEntries(def.fields.map((f) => [f.key, ""]));
      for (const row of runCalculator(def, empty)) {
        expect(row.value).not.toMatch(/Infinity|NaN/);
      }
    }
  });
});

describe("phone", () => {
  it("splits a stored number into dial code and local part", () => {
    expect(splitPhone("+359 88 123 4567")).toEqual({ code: "+359", local: "88 123 4567" });
    expect(splitPhone("+40 722 000 000")).toEqual({ code: "+40", local: "722 000 000" });
  });

  it("falls back to the default code for an unknown or empty number", () => {
    expect(splitPhone(null)).toEqual({ code: "+359", local: "" });
    expect(splitPhone("0888 123 456")).toEqual({ code: "+359", local: "0888 123 456" });
  });

  it("builds a tel: link without spaces", () => {
    expect(telHref("+359 88 123 4567")).toBe("tel:+359881234567");
  });
});
