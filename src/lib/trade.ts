import type { PriceRow } from "@/api/schemas";
import { formatNumber } from "@/lib/format";

const DAY = 86_400_000;

/** "700 €/т" for whole prices, "12,50 €/т" when there are cents. */
export function formatPrice(value: number, unit?: string) {
  const text = formatNumber(value, Number.isInteger(value) ? 0 : 2);
  return unit ? `${text} ${unit}` : text;
}

const normalize = (text: string) => text.trim().toLocaleLowerCase("bg");

/** The market row an offer or listing is about, matched by the catalogue name it was published with. */
export function findMarketRow(title: string, prices: readonly PriceRow[] | undefined) {
  if (!prices?.length) return null;
  const name = normalize(title);
  return prices.find((row) => normalize(row.name) === name) ?? null;
}

/** How far a price is from today's market price, in %; null when it cannot be compared. */
export function marketDelta(price: number | null, unit: string, row: PriceRow | null) {
  if (price === null || !row || !row.price || row.unit !== unit) return null;
  return ((price - row.price) / row.price) * 100;
}

export type Expiry = { label: string; tone: "muted" | "warn" | "danger" };

/** Days left on an offer, worded for a chip; null when it never expires. */
export function expiryOf(validUntil: string | null, now: number): Expiry | null {
  if (!validUntil) return null;
  const left = new Date(validUntil).getTime() - now;
  if (left < 0) return { label: "изтекла", tone: "danger" };
  const days = Math.ceil(left / DAY);
  if (days <= 1) return { label: "изтича днес", tone: "warn" };
  if (days <= 3) return { label: `изтича след ${days} дни`, tone: "warn" };
  const date = new Date(validUntil);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return { label: `до ${day}.${month}`, tone: "muted" };
}

export type OfferSort = "new" | "price";

export type OfferFilter<C extends string> = {
  category: C | "ALL";
  sort: OfferSort;
  favoritesOnly: boolean;
};

/** Applies the Борса filter bar to a list of offers. */
export function filterOffers<T extends { category: string; title: string; price: number; createdAt: string }>(
  offers: readonly T[],
  filter: OfferFilter<string>,
  favoriteNames: readonly string[] = [],
) {
  const favorites = new Set(favoriteNames.map(normalize));
  const list = offers.filter(
    (offer) =>
      (filter.category === "ALL" || offer.category === filter.category) &&
      (!filter.favoritesOnly || favorites.has(normalize(offer.title))),
  );
  return [...list].sort((a, b) =>
    filter.sort === "price"
      ? b.price - a.price
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** Splits a list into "Днес" and "По-рано" by local calendar day, keeping order. */
export function groupByDay<T extends { createdAt: string }>(items: readonly T[], now: number) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const groups: { title: string; items: T[] }[] = [
    { title: "Днес", items: [] },
    { title: "По-рано", items: [] },
  ];
  for (const item of items) {
    groups[new Date(item.createdAt).getTime() >= today.getTime() ? 0 : 1].items.push(item);
  }
  return groups.filter((group) => group.items.length);
}

export type CatalogItem = { slug: string; name: string; emoji?: string };

const CROP_GROUPS: { key: PriceRow["category"]; title: string }[] = [
  { key: "GRAIN", title: "Зърнени" },
  { key: "OILSEED", title: "Маслодайни" },
  { key: "OTHER", title: "Други" },
  { key: "PROCESSED", title: "Преработени" },
];

/**
 * Sections for the crop picker: favourites first, then the market's
 * categories, each item with today's price when the market lists it.
 * A search keeps only names containing the query and drops empty sections.
 */
export function catalogSections<T extends CatalogItem>(
  options: readonly T[],
  prices: readonly PriceRow[] | undefined,
  favorites: readonly string[] = [],
  query = "",
) {
  const search = normalize(query);
  const rows = new Map((prices ?? []).map((row) => [normalize(row.name), row]));
  const items = options
    .filter((option) => !search || normalize(option.name).includes(search))
    .map((option) => ({ option, market: rows.get(normalize(option.name)) ?? null }));

  const followed = new Set(favorites);
  const isFavorite = (item: (typeof items)[number]) =>
    followed.has(item.option.slug) || (!!item.market && followed.has(item.market.slug));

  const sections = [{ key: "FAVORITES", title: "Любими", data: items.filter(isFavorite) }];
  const rest = items.filter((item) => !isFavorite(item));
  for (const group of CROP_GROUPS) {
    sections.push({ key: group.key, title: group.title, data: rest.filter((item) => item.market?.category === group.key) });
  }
  sections.push({ key: "UNLISTED", title: prices?.length ? "Без пазарна цена" : "Всички", data: rest.filter((item) => !item.market) });
  return sections.filter((section) => section.data.length);
}

/** Own active offers that run out within `days` (not yet expired), soonest first. */
export function expiringSoon<T extends { isActive: boolean; validUntil: string | null }>(
  offers: readonly T[],
  now: number,
  days = 3,
) {
  return offers
    .filter((offer) => {
      if (!offer.isActive || !offer.validUntil) return false;
      const left = new Date(offer.validUntil).getTime() - now;
      return left >= 0 && left <= days * DAY;
    })
    .sort((a, b) => new Date(a.validUntil!).getTime() - new Date(b.validUntil!).getTime());
}

/** Today's biggest price moves; flat or unknown changes are left out. */
export function topMovers<T extends { changePct: number | null }>(prices: readonly T[] | undefined, count = 3) {
  return (prices ?? [])
    .filter((row) => row.changePct !== null && Math.abs(row.changePct) >= 0.05)
    .sort((a, b) => Math.abs(b.changePct!) - Math.abs(a.changePct!))
    .slice(0, count);
}
