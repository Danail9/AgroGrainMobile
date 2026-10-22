import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { z } from "zod";

import type { weatherHistorySchema } from "@/api/schemas";
import { formatNumber, formatShortDate, monthName } from "@/lib/format";
import { colors, radius } from "@/theme/tokens";
import { Divider, Card, pressedStyle } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

type History = z.infer<typeof weatherHistorySchema>;

const PREVIOUS_BAR = "#b6c3b0";

function Cell({ children, bold }: { children: string; bold?: boolean }) {
  return (
    <AppText
      variant="small"
      numeric
      bold={bold}
      tone={bold ? "ink" : "muted"}
      align="right"
      style={{ width: 84 }}
    >
      {children}
    </AppText>
  );
}

/** Year-over-year comparison and monthly rainfall, from the `/weather` history. */
export function WeatherStats({
  history,
  regionName,
}: {
  history: History;
  regionName: string;
}) {
  const { periods, months } = history;
  const [key, setKey] = useState(periods[0]?.key);
  const active = periods.find((period) => period.key === key) ?? periods[0];

  if (!active || (!active.current.days && !active.previous.days)) {
    return (
      <Card>
        <AppText variant="small" tone="muted" align="center" style={{ paddingVertical: 24 }}>
          Все още няма натрупани исторически данни за {regionName}.
        </AppText>
      </Card>
    );
  }

  const rows = [
    {
      label: "Средна температура",
      unit: "°C",
      digits: 1,
      current: active.current.avgTemp,
      previous: active.previous.avgTemp,
    },
    {
      label: "Най-висока",
      unit: "°C",
      digits: 1,
      current: active.current.maxTemp,
      previous: active.previous.maxTemp,
    },
    {
      label: "Най-ниска",
      unit: "°C",
      digits: 1,
      current: active.current.minTemp,
      previous: active.previous.minTemp,
    },
    {
      label: "Валежи",
      unit: " mm",
      digits: 0,
      current: active.current.precipitation,
      previous: active.previous.precipitation,
    },
    {
      label: "Дни с дъжд",
      unit: "",
      digits: 0,
      current: active.current.rainDays,
      previous: active.previous.rainDays,
    },
  ];

  const maxMonthly = Math.max(
    ...months.flatMap((month) => [month.current.precipitation, month.previous.precipitation]),
    1,
  );
  const currentRain = months.reduce((sum, month) => sum + month.current.precipitation, 0);
  const previousRain = months.reduce((sum, month) => sum + month.previous.precipitation, 0);
  const rainfallChange = currentRain - previousRain;
  const rainfallChangePct = previousRain > 0 ? (rainfallChange / previousRain) * 100 : null;
  const monthRange = months.length
    ? `януари – ${monthName(months[months.length - 1].month - 1)}`
    : "";

  const show = (value: number | null, digits: number, unit: string) =>
    value === null ? "–" : `${formatNumber(value, digits)}${unit}`;

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 12 }}>
        <AppText variant="small" bold>
          Годишно сравнение
        </AppText>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {periods.map((period) => {
            const selected = period.key === active.key;
            return (
              <Pressable
                key={period.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setKey(period.key)}
                style={({ pressed }) => [
                  {
                    borderRadius: radius.sm,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    backgroundColor: selected ? colors.brand[600] : colors.soft,
                  },
                  pressed && pressedStyle,
                ]}
              >
                <AppText
                  variant="caption"
                  bold
                  style={{ color: selected ? colors.white : colors.muted }}
                >
                  {period.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <AppText variant="caption" tone="muted">
          {formatShortDate(new Date(active.from))} – {formatShortDate(new Date(active.to))}, спрямо
          същия период година по-рано.
        </AppText>

        <View>
          <View style={{ flexDirection: "row", paddingBottom: 8 }}>
            <View style={{ flex: 1 }} />
            <Cell bold>{String(active.current.year)}</Cell>
            <Cell>{String(active.previous.year)}</Cell>
          </View>
          {rows.map((row) => (
            <View key={row.label}>
              <Divider />
              <View style={{ flexDirection: "row", alignItems: "baseline", paddingVertical: 10 }}>
                <AppText variant="small" tone="muted" style={{ flex: 1 }}>
                  {row.label}
                </AppText>
                <Cell bold>{show(row.current, row.digits, row.unit)}</Cell>
                <Cell>{show(row.previous, row.digits, row.unit)}</Cell>
              </View>
            </View>
          ))}
        </View>

        <AppText variant="caption" tone="muted">
          {active.current.days} дни с данни тази година срещу {active.previous.days} за същия период
          миналата.
        </AppText>
      </Card>

      {months.length ? (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="small" bold>Валежи по месеци</AppText>
              <AppText variant="caption" tone="muted">Сравнение за {monthRange}</AppText>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Legend color={colors.brand[600]} label={String(active.current.year)} />
              <Legend color={PREVIOUS_BAR} label={String(active.previous.year)} />
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderRadius: radius.md,
              backgroundColor: colors.soft,
            }}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <AppText variant="caption" tone="muted">{active.current.year} · натрупани валежи</AppText>
              <AppText variant="body" bold numeric>
                {formatNumber(currentRain)} mm
              </AppText>
            </View>
            <View style={{ alignItems: "flex-end", gap: 3 }}>
              <AppText variant="caption" tone="muted">{active.previous.year}</AppText>
              <AppText variant="small" bold numeric>
                {formatNumber(previousRain)} mm
              </AppText>
            </View>
            <View style={{ alignItems: "flex-end", gap: 3, minWidth: 72 }}>
              <AppText variant="caption" tone="muted">Разлика</AppText>
              <AppText
                variant="small"
                bold
                numeric
                style={{
                  color: rainfallChange > 0
                    ? colors.up
                    : rainfallChange < 0
                      ? colors.down
                      : colors.muted,
                }}
              >
                {`${rainfallChange > 0 ? "+" : rainfallChange < 0 ? "−" : ""}${formatNumber(Math.abs(rainfallChange))} mm`}
              </AppText>
              {rainfallChangePct !== null ? (
                <AppText
                  variant="caption"
                  numeric
                  style={{
                    color: rainfallChange > 0
                      ? colors.up
                      : rainfallChange < 0
                        ? colors.down
                        : colors.muted,
                  }}
                >
                  {`${rainfallChangePct > 0 ? "+" : ""}${formatNumber(rainfallChangePct, 0)}%`}
                </AppText>
              ) : null}
            </View>
          </View>

          {months.map((month) => (
            <View
              key={month.month}
              style={{
                gap: 5,
                paddingVertical: 8,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.line,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <AppText variant="caption" tone="muted" bold>
                  {monthName(month.month - 1)}
                </AppText>
                <MonthChange current={month.current.precipitation} previous={month.previous.precipitation} />
              </View>
              <Bar value={month.current.precipitation} max={maxMonthly} color={colors.brand[600]} />
              <Bar value={month.previous.precipitation} max={maxMonthly} color={PREVIOUS_BAR} />
            </View>
          ))}
          <AppText variant="caption" tone="muted">
            {`Общо за периода: ${formatNumber(currentRain)} mm през ${active.current.year} срещу ${formatNumber(previousRain)} mm през ${active.previous.year}.`}
          </AppText>
        </Card>
      ) : null}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <AppText variant="caption" tone="muted" numeric>
        {label}
      </AppText>
    </View>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.soft }}>
        <View
          style={{
            width: `${Math.round((value / max) * 100)}%`,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
          }}
        />
      </View>
      <AppText variant="caption" tone="muted" numeric style={{ width: 52, textAlign: "right" }}>
        {formatNumber(value)} mm
      </AppText>
    </View>
  );
}

function MonthChange({ current, previous }: { current: number; previous: number }) {
  const difference = current - previous;
  const color = difference > 0 ? colors.up : difference < 0 ? colors.down : colors.muted;
  const text = difference > 0
    ? `↑ ${formatNumber(difference)} mm`
    : difference < 0
      ? `↓ ${formatNumber(Math.abs(difference))} mm`
      : "без промяна";

  return (
    <AppText variant="caption" numeric bold style={{ color }}>
      {text}
    </AppText>
  );
}
