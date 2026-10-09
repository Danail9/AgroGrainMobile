import type { Me } from "@/api/schemas";

type Prefs = Me["notificationPrefs"];
type Role = Me["user"]["role"];

/** "Dobromir Dinev" → "DD"; one word → its first letter. */
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return `${first}${last}`.toLocaleUpperCase("bg");
}

export const ROLE_LABELS: Record<Role, string> = {
  FARMER: "Фермер",
  TRADER: "Търговец",
  ADMIN: "Администратор",
};

/** The alert switches this role sees in settings, read with their defaults. */
export function notificationSwitches(prefs: Prefs, role: Role) {
  const switches: boolean[] = [
    prefs.priceMove,
    prefs.priceTarget ?? true,
    prefs.heavyRain,
    prefs.frost,
    prefs.strongWind,
    prefs.goodFieldWork,
    prefs.subscriptionUpgrade,
    prefs.subscriptionReminder,
    prefs.weeklyDigest ?? true,
  ];
  if (role === "FARMER") switches.push(prefs.newOffer);
  if (role === "TRADER") switches.push(prefs.newListing, prefs.offerExpiring ?? true);
  if (role !== "ADMIN") switches.push(prefs.savedItems ?? true);
  return switches;
}

/** One line for the settings row: "Спрени" or "Включени · 8 от 11". */
export function notificationSummary(prefs: Prefs, role: Role) {
  if (!prefs.enabled) return "Спрени";
  const switches = notificationSwitches(prefs, role);
  const on = switches.filter(Boolean).length;
  return on === switches.length ? "Всички включени" : `Включени · ${on} от ${switches.length}`;
}
