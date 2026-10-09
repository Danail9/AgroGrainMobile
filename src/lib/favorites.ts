/** Moves followed crops to the top, keeping each group's original order. */
export function favoritesFirst<T extends { slug: string }>(items: T[], favorites: readonly string[] = []) {
  if (!favorites.length) return items;
  const followed = new Set(favorites);
  return [
    ...items.filter((item) => followed.has(item.slug)),
    ...items.filter((item) => !followed.has(item.slug)),
  ];
}

/**
 * The home price list: every favourite first (taken from the full market list
 * when the server's short list lacks it), then the server's picks, four rows
 * minimum. Works with portals that do not yet choose favourites themselves.
 */
export function homePrices<T extends { slug: string }>(
  home: T[],
  market: T[] | undefined,
  favorites: readonly string[] = [],
) {
  if (!favorites.length) return home;
  const bySlug = new Map([...(market ?? []), ...home].map((item) => [item.slug, item]));
  const followed = favorites.flatMap((slug) => {
    const item = bySlug.get(slug);
    return item ? [item] : [];
  });
  const rest = home.filter((item) => !favorites.includes(item.slug));
  return [...followed, ...rest.slice(0, Math.max(0, 4 - followed.length))];
}
