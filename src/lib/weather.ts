/**
 * Small pure helpers behind the weather screens, ported from the portal's
 * `app/(app)/weather` and `app/(app)/ai/weather` pages, where they live inside
 * the page files and so cannot be imported.
 */

/** Turns volumetric soil moisture (m³/m³) into a short agronomic label. */
export function describeSoilMoisture(value: number) {
  if (value < 0.15) return "Суха";
  if (value < 0.3) return "Оптимална";
  return "Преовлажнена";
}

export type RiskTone = "danger" | "warn" | "brand";

export function riskTone(probability: number): RiskTone {
  if (probability >= 60) return "danger";
  if (probability >= 30) return "warn";
  return "brand";
}

export function weatherSummary({
  label,
  temperature,
  windSpeed,
  humidity,
  precipitationProbability,
}: {
  label: string;
  temperature: number;
  windSpeed: number;
  humidity: number;
  precipitationProbability: number;
}) {
  const rain =
    precipitationProbability >= 60
      ? "има висок риск от валежи"
      : precipitationProbability >= 30
        ? "има умерен риск от превалявания"
        : "валежният риск е нисък";

  return `${label}, ${temperature}°C. Вятър ${windSpeed} km/h, влажност ${humidity}%, ${rain}.`;
}

/** Up to three of the next twelve hours with rain or wind worth planning around. */
export function riskyHours<
  T extends { precipitationProbability: number; windSpeed: number },
>(hourly: T[]) {
  return hourly
    .slice(0, 12)
    .filter((hour) => hour.precipitationProbability >= 30 || hour.windSpeed >= 18)
    .slice(0, 3);
}

export const LEVEL_TONE = { good: "brand", medium: "warn", bad: "danger" } as const;
