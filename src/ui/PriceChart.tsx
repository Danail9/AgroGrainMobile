import { useState } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { CHART_HEIGHT, buildChart } from "@/lib/chart";
import { formatNumber, formatShortDate } from "@/lib/format";
import { colors, space } from "@/theme/tokens";
import { AppText } from "@/ui/Text";

type Point = { date: string; price: number };

/** Sparkline of recorded daily prices, drawn in real pixels at the measured width. */
export function PriceChart({ points, unit }: { points: Point[]; unit: string }) {
  const [width, setWidth] = useState(0);

  if (points.length < 2) {
    return (
      <AppText variant="caption" tone="muted" align="center" style={{ padding: space.lg }}>
        Историята се записва всеки ден — графиката ще се появи след няколко дни наблюдения.
      </AppText>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const chart = buildChart(
    points.map((point) => point.price),
    width,
  );
  const stroke = chart?.rising === false ? colors.down : colors.up;

  return (
    <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <AppText variant="caption" tone="muted">
          Мин. {formatNumber(Math.min(...points.map((p) => p.price)))} {unit}
        </AppText>
        <AppText variant="caption" tone="muted">
          Макс. {formatNumber(Math.max(...points.map((p) => p.price)))} {unit}
        </AppText>
      </View>

      <View
        style={{ height: CHART_HEIGHT, marginTop: 8 }}
        onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Движение на цената: от ${formatNumber(first.price)} до ${formatNumber(last.price)} ${unit}`}
      >
        {chart ? (
          <>
            <Svg width={width} height={CHART_HEIGHT}>
              <Defs>
                <LinearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={stroke} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={chart.area} fill="url(#priceFill)" />
              <Path
                d={chart.line}
                fill="none"
                stroke={stroke}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <View
              style={{
                position: "absolute",
                left: chart.end.x - 5,
                top: chart.end.y - 5,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: stroke,
                borderWidth: 2,
                borderColor: colors.white,
              }}
            />
          </>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <AppText variant="caption" tone="muted">
          {formatShortDate(new Date(first.date))}
        </AppText>
        <AppText variant="caption" tone="muted">
          {points.length} {points.length === 1 ? "запис" : "записа"}
        </AppText>
        <AppText variant="caption" tone="muted">
          {formatShortDate(new Date(last.date))}
        </AppText>
      </View>
    </View>
  );
}
