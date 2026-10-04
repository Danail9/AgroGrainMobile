import { WEATHER_ICONS, type WeatherIconKey } from "@/lib/icons";
import { Icon } from "@/ui/Icon";

export type { WeatherIconKey };

export function WeatherGlyph({ icon, size = 24 }: { icon: WeatherIconKey; size?: number }) {
  const glyph = WEATHER_ICONS[icon] ?? WEATHER_ICONS["cloud-sun"];
  return <Icon name={glyph.name} size={size} color={glyph.color} />;
}
