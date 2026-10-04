/**
 * Helpers for turning what a user types on a phone keyboard into what the
 * portal's API expects.
 */

/**
 * "1,5" → "1.5". Bulgarian keyboards produce a decimal comma, but the server
 * parses numbers with `Number()`, which reads "1,5" as NaN.
 */
export function normalizeDecimal(text: string) {
  return text.trim().replace(",", ".");
}

/** Offer validity choices, in days from today; `null` means no expiry. */
export const VALIDITY_CHOICES = [
  { value: "none", label: "Без срок", days: null },
  { value: "7", label: "7 дни", days: 7 },
  { value: "30", label: "30 дни", days: 30 },
  { value: "90", label: "90 дни", days: 90 },
] as const;

export type ValidityValue = (typeof VALIDITY_CHOICES)[number]["value"];

/**
 * The calendar date `days` from now as "YYYY-MM-DD" in the device's local
 * time, or "" for no expiry. Local rather than UTC, so an offer made late in
 * the evening in Sofia does not expire a day early.
 */
export function validUntil(choice: ValidityValue, now: Date = new Date()) {
  const days = VALIDITY_CHOICES.find((item) => item.value === choice)?.days;
  if (days === null || days === undefined) return "";

  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
