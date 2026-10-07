/**
 * Alerts carry the web path they relate to ("/weather", "/trade/offers/ab12").
 * The app's routes mirror those paths, so most can be opened as they are, but
 * the value comes from the network, so only plain in-app paths are followed.
 */
export function internalPath(url: string | null): string | null {
  if (!url) return null;
  return /^\/[A-Za-z0-9_\-/]*$/.test(url) && !url.includes("//") ? url : null;
}

export const NOTIFICATION_ICONS = {
  SUBSCRIPTION_UPGRADED: "checkmark-circle",
  PRICE_MOVE: "trending-up",
  HEAVY_RAIN: "rainy",
  FROST: "snow",
  STRONG_WIND: "flag",
  GOOD_FIELD_WORK: "leaf",
  NEW_LISTING: "cube",
  NEW_OFFER: "swap-horizontal",
} as const;
