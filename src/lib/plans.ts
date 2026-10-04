/**
 * Plan names, ported from the portal's `lib/plans.ts`. Deliberately labels
 * only: this is a reader app, so no price, plan comparison or purchase text
 * from the portal's `PRICING` and `*_FEATURES` is carried over.
 */

export const TIER_LABELS = { BASE: "Стопанин", TRADER: "Търговец" } as const;

type Interval = "MONTH" | "YEAR";
type Tier = keyof typeof TIER_LABELS;

/** "Търговец · месечен" */
export function planName(interval: Interval, tier: Tier) {
  return `${TIER_LABELS[tier]} · ${interval === "MONTH" ? "месечен" : "годишен"}`;
}

/** The line shown for the current plan on the profile screen. */
export function subscriptionLabel(subscription: {
  exempt: boolean;
  freeAccess: boolean;
  interval: Interval | null;
  tier: Tier | null;
}) {
  if (subscription.exempt) return "Администраторски достъп";
  if (subscription.freeAccess) return "Свободен достъп";
  if (subscription.interval && subscription.tier) {
    return planName(subscription.interval, subscription.tier);
  }
  return "Няма активен план";
}
