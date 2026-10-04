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
