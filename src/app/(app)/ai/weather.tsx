import { ScrollView, View } from "react-native";

import { useWeather } from "@/api/queries";
import {
  capitalize,
  formatHour,
  formatLongDate,
  formatShortDate,
  formatWeekday,
} from "@/lib/format";
import { LEVEL_TONE, riskTone, riskyHours, weatherSummary } from "@/lib/weather";
import { colors, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { Card, IconTile, Pill, tileColor } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";
import { WeatherGlyph } from "@/ui/WeatherGlyph";

function Metric({
  icon,
  iconColor,
  label,
  value,
  unit,
  note,
}: {
  icon: "rainy" | "flag" | "speedometer";
  iconColor: string;
  label: string;
  value: string;
  unit?: string;
  note: string;
}) {
  return (
    <Card style={{ flex: 1, gap: 4, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={icon} size={14} color={iconColor} />
        <AppText variant="caption" tone="muted" bold>
          {label}
        </AppText>
      </View>
      <AppText variant="title" numeric>
        {value}
        {unit ? (
          <AppText variant="caption" tone="muted">
            {" "}
            {unit}
          </AppText>
        ) : null}
      </AppText>
      <AppText variant="caption" tone="muted" numberOfLines={2}>
        {note}
      </AppText>
    </Card>
  );
}

export default function WeatherAnalysisScreen() {
  const query = useWeather();

  return (
    <Screen
      back="/weather"
      title="AI анализ на времето"
      subtitle={formatLongDate()}
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <QueryBoundary query={query}>
        {({ weather, fieldWork, sprayWindow }) => {
          const today = weather.daily[0];
          const window = fieldWork[0];
          const risky = riskyHours(weather.hourly);

          return (
            <>
              <Card
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: space.md,
                  backgroundColor: colors.brand[50],
                  borderColor: colors.brand[100],
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    backgroundColor: colors.white,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <WeatherGlyph icon={weather.current.condition.icon} size={28} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="body" bold>
                    Обзор за днес
                  </AppText>
                  <AppText variant="small" tone="muted" style={{ marginTop: 4, lineHeight: 20 }}>
                    {weatherSummary({
                      label: weather.current.condition.label,
                      temperature: weather.current.temperature,
                      windSpeed: weather.current.windSpeed,
                      humidity: weather.current.humidity,
                      precipitationProbability: today?.precipitationProbability ?? 0,
                    })}
                  </AppText>
                </View>
              </Card>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <Metric
                  icon="rainy"
                  iconColor={colors.sky}
                  label="Валежи"
                  value={`${today?.precipitationProbability ?? 0}%`}
                  note={`${(today?.precipitationSum ?? 0).toFixed(1)} mm очаквани`}
                />
                <Metric
                  icon="flag"
                  iconColor={colors.slate}
                  label="Вятър"
                  value={String(Math.round(weather.current.windSpeed))}
                  unit="km/h"
                  note={`Макс. ${Math.round(today?.windMax ?? 0)} km/h`}
                />
              </View>
              <Metric
                icon="speedometer"
                iconColor={colors.brand[600]}
                label="Влажност"
                value={`${Math.round(weather.current.humidity)}%`}
                note={`Точка на оросяване ${Math.round(weather.current.dewPoint)}°C`}
              />

              {window ? (
                <Card style={{ flexDirection: "row", gap: space.md }}>
                  <IconTile tone="brand" size="md">
                    <Icon name="sparkles" size={20} color={tileColor("brand")} />
                  </IconTile>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <AppText variant="small" bold>
                        Работа на полето
                      </AppText>
                      <Pill tone={LEVEL_TONE[window.level]}>{window.label}</Pill>
                    </View>
                    <AppText variant="small" tone="muted" style={{ lineHeight: 20 }}>
                      {window.reason}.{" "}
                      {sprayWindow
                        ? `Подходящ прозорец за пръскане: ${formatHour(new Date(sprayWindow.from))} - ${formatHour(new Date(sprayWindow.to))}.`
                        : "Няма надежден прозорец за пръскане днес."}
                    </AppText>
                  </View>
                </Card>
              ) : null}

              <Card style={{ gap: 12 }}>
                <AppText variant="small" bold>
                  Почва и изпарение
                </AppText>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: colors.soft, borderRadius: 14, padding: 12, gap: 4 }}>
                    <AppText variant="caption" tone="muted">
                      Влага в почвата
                    </AppText>
                    <AppText variant="heading" numeric>
                      {Math.round(weather.current.soilMoisture * 100)}%
                    </AppText>
                  </View>
                  <View style={{ flex: 1, backgroundColor: colors.soft, borderRadius: 14, padding: 12, gap: 4 }}>
                    <AppText variant="caption" tone="muted">
                      ET0
                    </AppText>
                    <AppText variant="heading" numeric>
                      {(today?.et0 ?? 0).toFixed(1)} mm
                    </AppText>
                  </View>
                </View>
              </Card>

              <View style={{ gap: space.md }}>
                <AppText variant="heading">Следващи 12 часа</AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {weather.hourly.slice(0, 12).map((hour) => (
                      <Card key={hour.time} style={{ width: 80, alignItems: "center", gap: 6, padding: 12 }}>
                        <AppText variant="caption" tone="muted">
                          {formatHour(new Date(hour.time))}
                        </AppText>
                        <WeatherGlyph icon={hour.condition.icon} size={24} />
                        <AppText variant="small" bold numeric>
                          {Math.round(hour.temperature)}°
                        </AppText>
                        <AppText variant="caption" numeric style={{ color: "#0284c7" }}>
                          {hour.precipitationProbability}%
                        </AppText>
                      </Card>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={{ gap: space.md }}>
                <AppText variant="heading">Рискови моменти</AppText>
                {risky.length ? (
                  risky.map((hour) => (
                    <Card
                      key={hour.time}
                      style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: 12 }}
                    >
                      <WeatherGlyph icon={hour.condition.icon} size={24} />
                      <View style={{ flex: 1 }}>
                        <AppText variant="small" bold>
                          {formatHour(new Date(hour.time))}
                        </AppText>
                        <AppText variant="caption" tone="muted">
                          Валежи {hour.precipitationProbability}%, вятър {Math.round(hour.windSpeed)} km/h
                        </AppText>
                      </View>
                      <Pill tone={riskTone(hour.precipitationProbability)}>Внимание</Pill>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <AppText variant="small" tone="muted">
                      Няма отчетени рискови часове в следващите 12 часа.
                    </AppText>
                  </Card>
                )}
              </View>
              <View style={{ gap: space.md }}>
                <AppText variant="heading">Следващи дни</AppText>
                {weather.daily.slice(1, 5).map((day) => {
                  const date = new Date(day.date);
                  return (
                    <Card
                      key={day.date}
                      style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: 12 }}
                    >
                      <AppText variant="small" bold style={{ width: 70 }}>
                        {capitalize(formatWeekday(date))} {formatShortDate(date)}
                      </AppText>
                      <WeatherGlyph icon={day.condition.icon} size={24} />
                      <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                        {day.condition.label}
                      </AppText>
                      <AppText variant="caption" numeric style={{ color: "#0284c7" }}>
                        {day.precipitationProbability}%
                      </AppText>
                      <AppText variant="small" bold numeric style={{ width: 62, textAlign: "right" }}>
                        {Math.round(day.max)}°/{Math.round(day.min)}°
                      </AppText>
                    </Card>
                  );
                })}
              </View>
            </>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}
