import { formatNumber } from "@/lib/format";

/**
 * The six AI-page calculators, ported from the portal's
 * `components/calculators.tsx`. Pure arithmetic with no UI, so it is
 * unit-tested directly and the numbers cannot drift from the web version.
 */

export type CalculatorField = {
  key: string;
  label: string;
  suffix: string;
  initial: number;
};

export type CalculatorResult = { label: string; value: string };

export type CalculatorDef = {
  key: string;
  emoji: string;
  title: string;
  description: string;
  fields: CalculatorField[];
  compute: (values: Record<string, number>) => CalculatorResult[];
};

/** Accepts the comma decimal separator used on Bulgarian keyboards. */
export function toNumber(raw: string | undefined) {
  const parsed = Number((raw ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export const CALCULATORS: CalculatorDef[] = [
  {
    key: "seeds",
    emoji: "🌱",
    title: "Семена",
    description: "Изчисли нужните количества семена.",
    fields: [
      { key: "area", label: "Площ", suffix: "дка", initial: 100 },
      { key: "rate", label: "Сеитбена норма", suffix: "кг/дка", initial: 22 },
      { key: "price", label: "Цена на семената", suffix: "€/кг", initial: 1.6 },
    ],
    compute: ({ area, rate, price }) => [
      { label: "Общо семена", value: `${formatNumber(area * rate)} кг` },
      {
        label: "Чували по 25 кг",
        value: formatNumber(Math.ceil((area * rate) / 25)),
      },
      {
        label: "Обща стойност",
        value: `${formatNumber(area * rate * price, 2)} €`,
      },
    ],
  },
  {
    key: "fertilizer",
    emoji: "🧪",
    title: "Торове",
    description: "Изчисли нужните количества торове.",
    fields: [
      { key: "area", label: "Площ", suffix: "дка", initial: 100 },
      { key: "dose", label: "Норма на торене", suffix: "кг/дка", initial: 18 },
      {
        key: "nitrogen",
        label: "Съдържание на азот",
        suffix: "%",
        initial: 34.4,
      },
      { key: "price", label: "Цена на тора", suffix: "€/т", initial: 950 },
    ],
    compute: ({ area, dose, nitrogen, price }) => [
      { label: "Общо тор", value: `${formatNumber(area * dose)} кг` },
      {
        label: "Чист азот",
        value: `${formatNumber((area * dose * nitrogen) / 100)} кг`,
      },
      {
        label: "Съдържание на активно вещество",
        value: `${formatNumber((nitrogen * dose) / 100, 1)} кг/дка`,
      },
      {
        label: "Обща стойност",
        value: `${formatNumber((area * dose * price) / 1000, 2)} €`,
      },
    ],
  },
  {
    key: "spray",
    emoji: "🧴",
    title: "Препарати",
    description: "Дозировка и количества за пръскане.",
    fields: [
      { key: "area", label: "Площ", suffix: "дка", initial: 100 },
      { key: "dose", label: "Доза", suffix: "мл/дка", initial: 120 },
      { key: "water", label: "Работен разтвор", suffix: "л/дка", initial: 20 },
      { key: "tank", label: "Обем на резервоара", suffix: "л", initial: 2000 },
    ],
    compute: ({ area, dose, water, tank }) => {
      const totalWater = area * water;
      // A zero field would otherwise show "Infinity"/"NaN" mid-typing.
      const tanks = tank > 0 ? Math.ceil(totalWater / tank) : 0;
      const perTank = water > 0 ? (dose * (tank / water)) / 1000 : 0;
      return [
        {
          label: "Общо препарат",
          value: `${formatNumber((area * dose) / 1000, 2)} л`,
        },
        { label: "Работен разтвор", value: `${formatNumber(totalWater)} л` },
        { label: "Брой пълнения", value: `${tanks}` },
        {
          label: "Препарат на резервоар",
          value: `${formatNumber(perTank, 2)} л`,
        },
      ];
    },
  },
  {
    key: "yield",
    emoji: "🌾",
    title: "Добив",
    description: "Ориентировъчен добив и приходи.",
    fields: [
      { key: "area", label: "Площ", suffix: "дка", initial: 100 },
      { key: "yield", label: "Среден добив", suffix: "кг/дка", initial: 520 },
      { key: "price", label: "Изкупна цена", suffix: "€/т", initial: 380 },
    ],
    compute: (values) => [
      {
        label: "Общ добив",
        value: `${formatNumber((values.area * values.yield) / 1000, 2)} т`,
      },
      {
        label: "Очакван приход",
        value: `${formatNumber(((values.area * values.yield) / 1000) * values.price, 2)} €`,
      },
      {
        label: "Приход на декар",
        value: `${formatNumber((values.yield / 1000) * values.price, 2)} €/дка`,
      },
    ],
  },
  {
    key: "area",
    emoji: "📐",
    title: "Площ",
    description: "Преобразуване на единици (дка, ха).",
    fields: [{ key: "area", label: "Площ", suffix: "дка", initial: 100 }],
    compute: ({ area }) => [
      { label: "Хектари", value: `${formatNumber(area / 10, 2)} ха` },
      { label: "Квадратни метри", value: `${formatNumber(area * 1000)} м²` },
      { label: "Акри", value: `${formatNumber(area * 0.247105, 2)} акра` },
    ],
  },
  {
    key: "cost",
    emoji: "💰",
    title: "Цена",
    description: "Изчисления на стойности и разходи.",
    fields: [
      { key: "quantity", label: "Количество", suffix: "т", initial: 52 },
      { key: "price", label: "Цена", suffix: "€/т", initial: 380 },
      { key: "cost", label: "Разходи", suffix: "€/дка", initial: 145 },
      { key: "area", label: "Площ", suffix: "дка", initial: 100 },
    ],
    compute: ({ quantity, price, cost, area }) => {
      const revenue = quantity * price;
      const expenses = cost * area;
      return [
        { label: "Приход", value: `${formatNumber(revenue, 2)} €` },
        { label: "Разходи", value: `${formatNumber(expenses, 2)} €` },
        { label: "Печалба", value: `${formatNumber(revenue - expenses, 2)} €` },
        {
          label: "Рентабилност",
          value: expenses
            ? `${formatNumber(((revenue - expenses) / expenses) * 100, 1)}%`
            : "—",
        },
      ];
    },
  },
];

/** Starting values as the raw text a field shows. */
export function initialValues(def: CalculatorDef) {
  return Object.fromEntries(
    def.fields.map((field) => [field.key, String(field.initial)]),
  );
}

/** Runs a calculator over the raw text of its fields. */
export function runCalculator(
  def: CalculatorDef,
  raw: Record<string, string>,
): CalculatorResult[] {
  return def.compute(
    Object.fromEntries(
      def.fields.map((field) => [field.key, toNumber(raw[field.key])]),
    ),
  );
}

/** Keeps only the characters a decimal field may contain. */
export function sanitizeDecimal(text: string) {
  return text.replace(/[^\d.,]/g, "");
}
