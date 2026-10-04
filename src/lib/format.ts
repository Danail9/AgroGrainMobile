/**
 * Bulgarian formatting, ported from the portal's `lib/format.ts`.
 *
 * The portal leans on `Intl` with the `bg-BG` locale. Hermes' `Intl` coverage
 * differs between iOS and Android, so this version is hand-written: the output
 * is identical on every device and testable without a locale database. Dates
 * are shown in the device's local time, which is Sofia time for the app's
 * audience.
 */

const MONTHS = [
  "януари",
  "февруари",
  "март",
  "април",
  "май",
  "юни",
  "юли",
  "август",
  "септември",
  "октомври",
  "ноември",
  "декември",
];

const WEEKDAYS_LONG = [
  "неделя",
  "понеделник",
  "вторник",
  "сряда",
  "четвъртък",
  "петък",
  "събота",
];

const WEEKDAYS_SHORT = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "неделя, 4 октомври" */
export function formatLongDate(date: Date = new Date()) {
  return `${WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "04.10" */
export function formatShortDate(date: Date) {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
}

/** "пн" */
export function formatWeekday(date: Date) {
  return WEEKDAYS_SHORT[date.getDay()];
}

/** "в понеделник" / "във вторник" — "вторник" takes "във" to avoid a в-в clash. */
export function weekdayPhrase(date: Date) {
  const weekday = WEEKDAYS_LONG[date.getDay()];
  return weekday === "вторник" ? `във ${weekday}` : `в ${weekday}`;
}

/** "08:30" */
export function formatHour(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Month name in the nominative, for history tables. */
export function monthName(index: number) {
  return MONTHS[index] ?? "";
}

/**
 * Bulgarian number format: decimal comma, and a non-breaking space between
 * thousands groups only from five digits up (CLDR's minimum grouping of 2),
 * so 1234 stays "1234" while 12345 becomes "12 345".
 */
export function formatNumber(value: number, fractionDigits = 0) {
  if (!Number.isFinite(value)) return "—";

  const negative = value < 0 && Number(Math.abs(value).toFixed(fractionDigits)) !== 0;
  const [whole, fraction] = Math.abs(value).toFixed(fractionDigits).split(".");

  const grouped =
    whole.length >= 5 ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : whole;

  return `${negative ? "-" : ""}${grouped}${fraction ? `,${fraction}` : ""}`;
}

export function formatPercent(value: number) {
  return `${Math.abs(value).toFixed(1).replace(".", ",")}%`;
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/** "преди 5 минути", "след 2 часа", "вчера". */
export function relativeTime(date: Date, now: Date = new Date()) {
  const diffMinutes = Math.round((date.getTime() - now.getTime()) / 60000);
  const abs = Math.abs(diffMinutes);
  const past = diffMinutes < 0;
  const say = (n: number, one: string, many: string) =>
    `${past ? "преди" : "след"} ${n} ${plural(n, one, many)}`;

  if (abs < 1) return "току-що";
  if (abs < 60) return say(abs, "минута", "минути");

  const hours = Math.round(abs / 60);
  if (hours < 24) return say(hours, "час", "часа");

  const days = Math.round(hours / 24);
  if (days === 1) return past ? "вчера" : "утре";
  return say(days, "ден", "дни");
}

/** "обновено преди 2 часа" — the staleness stamp on cached screens. */
export function updatedAgo(timestamp: number, now: number = Date.now()) {
  return `обновено ${relativeTime(new Date(timestamp), new Date(now))}`;
}

export function greeting(date: Date = new Date()) {
  const hour = date.getHours();
  if (hour < 11) return "Добро утро!";
  if (hour < 18) return "Добър ден!";
  return "Добър вечер!";
}

/** First letter upper-case, like the portal's CSS `capitalize` on weekdays. */
export function capitalize(text: string) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
