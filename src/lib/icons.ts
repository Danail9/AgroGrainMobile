import type { IconName } from "@/ui/Icon";

/** Icon tables kept as plain data, so they are testable without a renderer. */

export type WeatherIconKey =
  | "sun"
  | "cloud-sun"
  | "cloud"
  | "rain"
  | "storm"
  | "snow"
  | "fog";

export const WEATHER_ICONS: Record<WeatherIconKey, { name: IconName; color: string }> = {
  sun: { name: "sunny", color: "#f59e0b" },
  "cloud-sun": { name: "partly-sunny", color: "#fbbf24" },
  cloud: { name: "cloud", color: "#94a3b8" },
  rain: { name: "rainy", color: "#0ea5e9" },
  storm: { name: "thunderstorm", color: "#6366f1" },
  snow: { name: "snow", color: "#7dd3fc" },
  fog: { name: "cloudy", color: "#94a3b8" },
};

export type SectionIconKey = "weather" | "market" | "news" | "field" | "risk" | "tip";

export const SECTION_STYLE: Record<
  SectionIconKey,
  { icon: IconName; tone: "warn" | "brand" | "sky" }
> = {
  weather: { icon: "partly-sunny", tone: "warn" },
  market: { icon: "stats-chart", tone: "brand" },
  news: { icon: "newspaper", tone: "sky" },
  field: { icon: "leaf", tone: "brand" },
  risk: { icon: "warning", tone: "warn" },
  tip: { icon: "bulb", tone: "brand" },
};
