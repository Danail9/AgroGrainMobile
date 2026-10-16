/** Subscription product names, distinct from account roles. */

export const TIER_LABELS = { BASE: "Стопанин", TRADER: "Търговец" } as const;

export function planTierLabel(tier: Tier, role?: string) {
  return role === "FARMER" ? "Стопанин" : TIER_LABELS[tier];
}

type Interval = "MONTH" | "YEAR";
type Tier = keyof typeof TIER_LABELS;

/** "Стопанин + Борса · месечен" */
export function planName(interval: Interval, tier: Tier, role?: string) {
  return `${planTierLabel(tier, role)} · ${interval === "MONTH" ? "месечен" : "годишен"}`;
}

/** The line shown for the current plan on the profile screen. */
export function subscriptionLabel(subscription: {
  exempt: boolean;
  freeAccess: boolean;
  interval: Interval | null;
  tier: Tier | null;
  trialActive?: boolean;
}, role?: string) {
  if (subscription.exempt) return "Администраторски достъп";
  if (subscription.trialActive) return "Безплатен пробен месец";
  if (subscription.freeAccess) return "Свободен достъп";
  if (subscription.interval && subscription.tier) {
    return planName(subscription.interval, subscription.tier, role);
  }
  return "Няма активен план";
}
