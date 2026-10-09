import type { z } from "zod";

import type { notificationTypeSchema } from "@/api/schemas";
import type { IconName } from "@/ui/Icon";

/**
 * Alerts carry the web path they relate to ("/weather", "/trade/offers/ab12").
 * The app's routes mirror those paths, so most can be opened as they are, but
 * the value comes from the network, so only plain in-app paths are followed.
 */
export function internalPath(url: string | null): string | null {
  if (!url) return null;
  if (url === "/billing") return "/subscription";
  return /^\/[A-Za-z0-9_\-/]*$/.test(url) && !url.includes("//") ? url : null;
}

export const NOTIFICATION_ICONS = {
  SUBSCRIPTION_UPGRADED: "checkmark-circle",
  SUBSCRIPTION_REMINDER: "calendar",
  SUBSCRIPTION_EXPIRED: "alert-circle",
  PRICE_MOVE: "trending-up",
  HEAVY_RAIN: "rainy",
  FROST: "snow",
  STRONG_WIND: "flag",
  GOOD_FIELD_WORK: "leaf",
  NEW_LISTING: "cube",
  NEW_OFFER: "swap-horizontal",
  PRICE_TARGET: "flag",
  OFFER_EXPIRING: "timer",
  SAVED_ITEM_UPDATE: "bookmark",
} as const satisfies Record<z.infer<typeof notificationTypeSchema>, IconName>;
