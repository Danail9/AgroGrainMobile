import { router } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

import { useMe, useWeather } from "@/api/queries";
import type { WeatherResponse } from "@/api/schemas";
import { capitalize, formatHour, formatShortDate, formatWeekday } from "@/lib/format";
import { LEVEL_TONE, describeSoilMoisture } from "@/lib/weather";
import { colors, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { Card, Divider, Pill, RowList, StatChip, pressedStyle } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { Tabs } from "@/ui/Tabs";
import { AppText } from "@/ui/Text";
import { WeatherGlyph } from "@/ui/WeatherGlyph";
import { WeatherStats } from "@/ui/WeatherStats";

const dayLabel = (iso: string) => capitalize(formatWeekday(new Date(iso)));

export default function WeatherScreen() {
  const weather = useWeather();
  const me = useMe();
  const regionName = me.data?.user.regionName;

  return (
    <Screen
      tabbed
      title="Време"
      subtitle={regionName ? `Прогноза за ${regionName}` : undefined}
      onRefresh={() => void weather.refetch()}
      refreshing={weather.isRefetching}
    >
      <QueryBoundary query={weather}>
        {(data) => <WeatherTabs data={data} regionName={regionName ?? data.weather.regionName} />}
      </QueryBoundary>
    </Screen>
  );
}

function WeatherTabs({ data, regionName }: { data: WeatherResponse; regionName: string }) {
  const { weather, fieldWork, sprayWindow, history } = data;
  const today = weather.daily[0];

  return (
    <>
      {weather.isFallback ? (
        <Card style={{ backgroundColor: colors.amber50, borderColor: "#fde68a" }}>
          <AppText variant="small" tone="warn" bold>
            Демо данни – няма връзка с източника на данни за времето.
          </AppText>
        </Card>
      ) : null}

      <Tabs
        items={[
          {
            key: "today",
            label: "Днес",
            content: (
              <View style={{ gap: space.lg }}>
                <Card>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
                    <WeatherGlyph icon={weather.current.condition.icon} size={56} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="hero" numeric style={{ fontSize: 38 }}>
                        {Math.round(weather.current.temperature)}°C
                      </AppText>
                      <AppText variant="small" bold>
                        {weather.current.condition.label}
                      </AppText>
                      <AppText variant="caption" tone="muted">
                        Усеща се като {Math.round(weather.current.apparentTemperature)}°C
                      </AppText>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, marginTop: space.lg }}>
                    <StatChip
                      icon={<Icon name="water" size={16} color={colors.sky} />}
                      value={`${today?.precipitationProbability ?? 0}%`}
                      label="Валежи"
                    />
                    <StatChip
                      icon={<Icon name="flag" size={16} color={colors.slate} />}
                      value={`${Math.round(weather.current.windSpeed)} km/h`}
                      label="Вятър"
                    />
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <StatChip
                      icon={<Icon name="speedometer" size={16} color={colors.brand[500]} />}
                      value={`${Math.round(weather.current.humidity)}%`}
                      label="Влажност"
                    />
                    <StatChip
                      icon={<Icon name="sunny" size={16} color="#f59e0b" />}
                      value={String(weather.current.uvIndex)}
                      label="UV индекс"
                    />
                  </View>
                </Card>

                <Card style={{ backgroundColor: colors.brand[50], borderColor: colors.brand[200] }}>
                  <AppText variant="small" bold style={{ color: colors.brand[800] }}>
                    Прозорец за работа
                  </AppText>
                  <AppText variant="caption" style={{ color: colors.brand[700], marginTop: 4 }}>
                    {sprayWindow
                      ? `Подходящо време за пръскане между ${formatHour(new Date(sprayWindow.from))} и ${formatHour(new Date(sprayWindow.to))}.`
                      : "Днес условията не са подходящи за пръскане."}{" "}
                    {fieldWork[0]?.reason}.
                  </AppText>
                </Card>

                <Card>
                  <AppText variant="small" bold style={{ marginBottom: 12 }}>
                    Почасова прогноза
                  </AppText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {weather.hourly.slice(0, 12).map((hour) => (
                        <View
                          key={hour.time}
                          style={{
                            width: 56,
                            alignItems: "center",
                            gap: 6,
                            paddingVertical: 8,
                            backgroundColor: colors.soft,
                            borderRadius: 14,
                          }}
                        >
                          <AppText variant="caption" tone="muted">
                            {formatHour(new Date(hour.time))}
                          </AppText>
                          <WeatherGlyph icon={hour.condition.icon} size={22} />
                          <AppText variant="small" bold numeric>
                            {Math.round(hour.temperature)}°
                          </AppText>
                          <AppText variant="caption" numeric style={{ color: "#0284c7", fontSize: 10 }}>
                            {hour.precipitationProbability}%
                          </AppText>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </Card>

                <Card style={{ gap: 12 }}>
                  <AppText variant="small" bold>
                    Почва и изпарение
                  </AppText>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Metric
                      label="Темп. на почвата"
                      value={`${Math.round(weather.current.soilTemperature)}°C`}
                      note="6 cm"
                    />
                    <Metric
                      label="Влага в почвата"
                      value={`${Math.round(weather.current.soilMoisture * 100)}%`}
                      note={describeSoilMoisture(weather.current.soilMoisture)}
                    />
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Metric
                      label="Валежи днес"
                      value={`${(today?.precipitationSum ?? 0).toFixed(1)} mm`}
                    />
                    <Metric label="Изпарение (ET₀)" value={`${(today?.et0 ?? 0).toFixed(1)} mm`} />
                  </View>
                  <Divider />
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <AppText variant="small">
                      <AppText variant="small" tone="muted">
                        Изгрев{" "}
                      </AppText>
                      <AppText variant="small" bold numeric>
                        {today ? formatHour(new Date(today.sunrise)) : "—"}
                      </AppText>
                    </AppText>
                    <AppText variant="small">
                      <AppText variant="small" tone="muted">
                        Залез{" "}
                      </AppText>
                      <AppText variant="small" bold numeric>
                        {today ? formatHour(new Date(today.sunset)) : "—"}
                      </AppText>
                    </AppText>
                  </View>
                </Card>

                <RowList>
                  <AppText variant="small" bold style={{ padding: space.lg, paddingBottom: 4 }}>
                    Следващи дни
                  </AppText>
                  {weather.daily.slice(1, 4).map((day) => (
                    <View key={day.date}>
                      <Divider />
                      <DayRow day={day} />
                    </View>
                  ))}
                  <Divider />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push("/ai/weather")}
                    style={({ pressed }) => [{ padding: space.md, alignItems: "center" }, pressed && pressedStyle]}
                  >
                    <AppText variant="small" tone="brand" bold>
                      Виж AI обзор за днес
                    </AppText>
                  </Pressable>
                </RowList>
              </View>
            ),
          },
          {
            key: "week",
            label: "7 дни",
            content: (
              <RowList>
                {weather.daily.map((day, index) => (
                  <View key={day.date}>
                    {index > 0 ? <Divider /> : null}
                    <DayRow day={day} withDate />
                  </View>
                ))}
              </RowList>
            ),
          },
          {
            key: "work",
            label: "Подходящо",
            content: (
              <View style={{ gap: 12 }}>
                {fieldWork.map((day) => (
                  <Card key={day.date} style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <AppText variant="small" bold>
                        {dayLabel(day.date)} {formatShortDate(new Date(day.date))}
                      </AppText>
                      <Pill tone={LEVEL_TONE[day.level]}>{day.label}</Pill>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.soft }}>
                      <View
                        style={{
                          width: `${Math.max(0, Math.min(100, day.score))}%`,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor:
                            day.level === "good"
                              ? colors.brand[500]
                              : day.level === "medium"
                                ? "#f59e0b"
                                : "#ef4444",
                        }}
                      />
                    </View>
                    <AppText variant="caption" tone="muted">
                      Причини: {day.reason}.
                    </AppText>
                  </Card>
                ))}
              </View>
            ),
          },
          {
            key: "stats",
            label: "Статистика",
            content: <WeatherStats history={history} regionName={regionName} />,
          },
        ]}
      />
    </>
  );
}

function DayRow({
  day,
  withDate = false,
}: {
  day: WeatherResponse["weather"]["daily"][number];
  withDate?: boolean;
}) {
  const date = new Date(day.date);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: 12,
      }}
    >
      <AppText variant="small" style={{ width: withDate ? 76 : 36, fontWeight: "500" }}>
        {capitalize(formatWeekday(date))}
        {withDate ? ` ${formatShortDate(date)}` : ""}
      </AppText>
      <WeatherGlyph icon={day.condition.icon} size={22} />
      <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
        {day.condition.label}
      </AppText>
      <AppText variant="caption" numeric style={{ color: "#0284c7" }}>
        {day.precipitationProbability}%
      </AppText>
      <AppText variant="small" bold numeric style={{ width: 70, textAlign: "right" }}>
        {Math.round(day.max)}° / {Math.round(day.min)}°
      </AppText>
    </View>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.soft, borderRadius: 14, padding: 12, gap: 4 }}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="small" bold numeric>
        {value}
        {note ? (
          <AppText variant="caption" tone="muted">
            {"  "}
            {note}
          </AppText>
        ) : null}
      </AppText>
    </View>
  );
}
