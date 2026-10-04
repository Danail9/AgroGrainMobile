import {
  formatHour,
  formatLongDate,
  formatNumber,
  formatPercent,
  formatShortDate,
  formatWeekday,
  greeting,
  relativeTime,
  updatedAgo,
  weekdayPhrase,
} from "@/lib/format";

const NBSP = " ";

// Built from local components so the tests do not depend on the machine's timezone.
const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min);

describe("formatNumber", () => {
  it("uses a decimal comma", () => {
    expect(formatNumber(1234.5, 2)).toBe("1234,50");
    expect(formatNumber(0.25, 2)).toBe("0,25");
  });

  it("groups thousands only from five digits, as bg-BG does", () => {
    expect(formatNumber(1234)).toBe("1234");
    expect(formatNumber(9999)).toBe("9999");
    expect(formatNumber(12345)).toBe(`12${NBSP}345`);
    expect(formatNumber(1234567)).toBe(`1${NBSP}234${NBSP}567`);
  });

  it("keeps the sign, but never prints a negative zero", () => {
    expect(formatNumber(-5260, 2)).toBe("-5260,00");
    expect(formatNumber(-0.001, 2)).toBe("0,00");
  });

  it("rounds to the requested digits", () => {
    expect(formatNumber(2.345, 1)).toBe("2,3");
    expect(formatNumber(199.999, 0)).toBe("200");
  });

  it("shows a dash for NaN and Infinity instead of garbage", () => {
    expect(formatNumber(Number.NaN)).toBe("—");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("shows the magnitude with a decimal comma", () => {
    expect(formatPercent(1.25)).toBe("1,3%");
    expect(formatPercent(-3)).toBe("3,0%");
  });
});

describe("dates", () => {
  it("formats a long date", () => {
    // 4 October 2026 is a Sunday.
    expect(formatLongDate(at(2026, 10, 4))).toBe("неделя, 4 октомври");
    expect(formatLongDate(at(2026, 1, 1))).toBe("четвъртък, 1 януари");
  });

  it("formats short dates, weekdays and hours with zero padding", () => {
    expect(formatShortDate(at(2026, 3, 7))).toBe("07.03");
    expect(formatWeekday(at(2026, 10, 5))).toBe("пн");
    expect(formatHour(at(2026, 10, 4, 8, 5))).toBe("08:05");
  });

  it('says "във вторник" but "в понеделник"', () => {
    expect(weekdayPhrase(at(2026, 10, 6))).toBe("във вторник");
    expect(weekdayPhrase(at(2026, 10, 5))).toBe("в понеделник");
  });
});

describe("relativeTime", () => {
  const now = at(2026, 10, 4, 12, 0);
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  it("handles the sub-minute case", () => {
    expect(relativeTime(ago(0), now)).toBe("току-що");
  });

  it("uses correct singular and plural forms", () => {
    expect(relativeTime(ago(1), now)).toBe("преди 1 минута");
    expect(relativeTime(ago(5), now)).toBe("преди 5 минути");
    expect(relativeTime(ago(60), now)).toBe("преди 1 час");
    expect(relativeTime(ago(120), now)).toBe("преди 2 часа");
  });

  it("switches to days and knows yesterday", () => {
    expect(relativeTime(ago(60 * 24), now)).toBe("вчера");
    expect(relativeTime(ago(60 * 24 * 3), now)).toBe("преди 3 дни");
  });

  it("speaks about the future too", () => {
    expect(relativeTime(new Date(now.getTime() + 30 * 60_000), now)).toBe("след 30 минути");
    expect(relativeTime(new Date(now.getTime() + 24 * 3_600_000), now)).toBe("утре");
  });

  it("builds the staleness stamp shown on cached screens", () => {
    expect(updatedAgo(now.getTime() - 2 * 3_600_000, now.getTime())).toBe(
      "обновено преди 2 часа",
    );
  });
});

describe("greeting", () => {
  it("follows the time of day", () => {
    expect(greeting(at(2026, 10, 4, 7))).toBe("Добро утро!");
    expect(greeting(at(2026, 10, 4, 10, 59))).toBe("Добро утро!");
    expect(greeting(at(2026, 10, 4, 11))).toBe("Добър ден!");
    expect(greeting(at(2026, 10, 4, 17, 59))).toBe("Добър ден!");
    expect(greeting(at(2026, 10, 4, 18))).toBe("Добър вечер!");
  });
});
