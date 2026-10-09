export const PHONE_CODES = [
  "+359",
  "+40",
  "+30",
  "+90",
  "+381",
  "+389",
  "+49",
  "+44",
];

/** Country shown next to each dial code in the picker. */
export const PHONE_COUNTRIES: Record<string, { flag: string; name: string }> = {
  "+359": { flag: "🇧🇬", name: "България" },
  "+40": { flag: "🇷🇴", name: "Румъния" },
  "+30": { flag: "🇬🇷", name: "Гърция" },
  "+90": { flag: "🇹🇷", name: "Турция" },
  "+381": { flag: "🇷🇸", name: "Сърбия" },
  "+389": { flag: "🇲🇰", name: "Северна Македония" },
  "+49": { flag: "🇩🇪", name: "Германия" },
  "+44": { flag: "🇬🇧", name: "Великобритания" },
};

/** Keeps what a local phone number may contain: digits and single spaces. */
export function phoneInput(text: string) {
  return text.replace(/[^\d ]/g, "").replace(/ {2,}/g, " ").replace(/^ /, "");
}

export const DEFAULT_PHONE_CODE = "+359";

/** Splits a stored number back into the dial code and local part for editing. */
export function splitPhone(phone: string | null | undefined) {
  const value = phone?.trim() ?? "";
  if (!value) return { code: DEFAULT_PHONE_CODE, local: "" };

  // Longest match first so "+359" wins over a hypothetical "+35".
  const dial = [...PHONE_CODES]
    .sort((a, b) => b.length - a.length)
    .find((code) => value.startsWith(code));

  if (!dial) return { code: DEFAULT_PHONE_CODE, local: value };
  return { code: dial, local: value.slice(dial.length).trim() };
}

/** `tel:` link for a stored number, without spaces. */
export function telHref(phone: string) {
  return `tel:${phone.replace(/\s/g, "")}`;
}
