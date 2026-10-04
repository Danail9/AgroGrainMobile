/**
 * Rule-based reading of today's prices, ported from the portal's
 * `app/(app)/ai/market/page.tsx`, where it is inline. Every sentence is
 * traceable to a stored number; nothing is invented.
 */

export type PriceLike = {
  name: string;
  price: number;
  unit: string;
  changePct: number | null;
  date: string;
};

export const CATEGORY_LABELS = {
  GRAIN: "Зърнени",
  OILSEED: "Маслодайни",
  OTHER: "Други",
  PROCESSED: "Преработени",
} as const;

function startOfDay(iso: string) {
  const day = new Date(iso);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** The prices recorded on the most recent day that has any. */
export function latestDay<T extends PriceLike>(prices: T[]) {
  if (!prices.length) return { prices: [] as T[], latest: null as Date | null };
  const latestMs = Math.max(...prices.map((price) => new Date(price.date).getTime()));
  const latest = new Date(latestMs);
  return {
    latest,
    prices: prices.filter((price) => startOfDay(price.date) === startOfDay(latest.toISOString())),
  };
}

export function changeSentence(prices: PriceLike[]) {
  const comparable = prices.filter((price) => price.changePct !== null);
  const up = comparable.filter((price) => (price.changePct ?? 0) > 0);
  const down = comparable.filter((price) => (price.changePct ?? 0) < 0);
  const flat = comparable.length - up.length - down.length;

  if (!comparable.length) {
    return "Днес има публикувани цени, но без надеждна база за дневно сравнение.";
  }

  return `${countLabel(up.length, "култура поскъпва", "култури поскъпват")}, ${countLabel(
    down.length,
    "поевтинява",
    "поевтиняват",
  )}, ${countLabel(flat, "е", "са")} без промяна.`;
}

/** The crop that moved most today, in either direction. */
export function strongestSignal<T extends PriceLike>(prices: T[]) {
  return [...prices]
    .filter((price) => price.changePct !== null)
    .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))[0];
}

export function averagePrice(prices: PriceLike[]) {
  if (!prices.length) return 0;
  return Math.round(prices.reduce((total, price) => total + price.price, 0) / prices.length);
}
