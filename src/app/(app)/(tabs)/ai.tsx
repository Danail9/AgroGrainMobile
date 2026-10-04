import { router, type Href } from "expo-router";
import { Pressable, View } from "react-native";

import { useMarket, useMe, useWeather } from "@/api/queries";
import { SUGGESTIONS } from "@/lib/ai";
import { formatHour, formatNumber, monthName } from "@/lib/format";
import { strongestSignal } from "@/lib/market";
import { colors, radius, space } from "@/theme/tokens";
import { Icon, type IconName } from "@/ui/Icon";
import { Card, IconTile, LinkRow, pressedStyle, tileColor } from "@/ui/primitives";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

const SHORTCUTS: { href: Href; label: string; icon: IconName }[] = [
  { href: "/ai/daily", label: "Важно днес", icon: "sparkles" },
  { href: "/ai/weather", label: "Време", icon: "partly-sunny" },
  { href: "/ai/market", label: "Пазар", icon: "stats-chart" },
  { href: "/ai/weekly", label: "Съвети", icon: "calendar" },
];

export default function AiScreen() {
  const me = useMe();
  const weather = useWeather();
  const market = useMarket();

  const today = weather.data?.fieldWork[0];
  const spray = weather.data?.sprayWindow;
  const nextGood = weather.data?.fieldWork.slice(1).find((day) => day.level === "good");
  const signal = market.data ? strongestSignal(market.data.prices) : undefined;
  const firstPrice = market.data?.prices[0];
  const regionName = me.data?.user.regionName;

  return (
    <Screen tabbed title="AgroGrain AI" subtitle="Твоят земеделски асистент">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Попитай AgroGrain AI"
        onPress={() => router.push("/ai/chat")}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: space.md,
            backgroundColor: colors.white,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.brand[200],
            paddingHorizontal: space.lg,
            paddingVertical: 14,
          },
          pressed && pressedStyle,
        ]}
      >
        <Icon name="chatbubble-ellipses" size={20} color={colors.brand[600]} />
        <AppText variant="small" tone="muted" style={{ flex: 1 }}>
          Напиши своя въпрос…
        </AppText>
        <Icon name="send" size={16} color={colors.brand[600]} />
      </Pressable>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {SHORTCUTS.map((shortcut) => (
          <Pressable
            key={shortcut.label}
            accessibilityRole="button"
            onPress={() => router.push(shortcut.href)}
            style={({ pressed }) => [{ flex: 1 }, pressed && pressedStyle]}
          >
            <Card style={{ alignItems: "center", gap: 8, paddingHorizontal: 4, paddingVertical: 12 }}>
              <IconTile tone="brand" size="sm">
                <Icon name={shortcut.icon} size={17} color={tileColor("brand")} />
              </IconTile>
              <AppText variant="caption" bold align="center">
                {shortcut.label}
              </AppText>
            </Card>
          </Pressable>
        ))}
      </View>

      <LinkRow
        href="/ai/calculator"
        title="AI калкулатор"
        subtitle="Бързи изчисления за семена, торове и добив"
        icon={
          <IconTile tone="brand" size="md">
            <Icon name="calculator" size={18} color={tileColor("brand")} />
          </IconTile>
        }
      />

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/ai/weather")}
          style={({ pressed }) => [{ flex: 1 }, pressed && pressedStyle]}
        >
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
            <IconTile tone="sky" size="sm">
              <Icon name="partly-sunny" size={17} color={tileColor("sky")} />
            </IconTile>
            <View style={{ flex: 1 }}>
              <AppText variant="small" bold numberOfLines={1}>
                {weather.data
                  ? `${Math.round(weather.data.weather.current.temperature)}° · ${today?.label ?? ""}`
                  : "Времето"}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={2}>
                {today?.reason ?? "Виж анализа на времето"}
              </AppText>
            </View>
          </Card>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/ai/market")}
          style={({ pressed }) => [{ flex: 1 }, pressed && pressedStyle]}
        >
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
            <IconTile tone="brand" size="sm">
              <Icon name="stats-chart" size={17} color={tileColor("brand")} />
            </IconTile>
            <View style={{ flex: 1 }}>
              <AppText variant="small" bold numberOfLines={1}>
                {signal?.name ?? firstPrice?.name ?? "Пазар"}{" "}
                {signal && signal.changePct !== null
                  ? `${signal.changePct >= 0 ? "+" : ""}${signal.changePct.toFixed(1)}%`
                  : ""}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={2}>
                {signal ? `${formatNumber(signal.price)} ${signal.unit}` : "Виж пазарния анализ"}
              </AppText>
            </View>
          </Card>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/ai/daily")}
        style={({ pressed }) => [
          {
            gap: space.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.brand[100],
            backgroundColor: colors.brand[50],
            padding: 14,
          },
          pressed && pressedStyle,
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <IconTile tone="solid" size="sm">
            <Icon name="sparkles" size={16} color={colors.white} />
          </IconTile>
          <View style={{ flex: 1 }}>
            <AppText variant="small" bold style={{ color: colors.brand[800] }}>
              Съвет за днес
            </AppText>
            <AppText variant="caption" style={{ color: colors.brand[700] }}>
              AI препоръка{regionName ? ` за ${regionName}` : ""}
            </AppText>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.brand[600]} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: 12, padding: 10 }}>
            <AppText variant="caption" tone="muted">
              Пръскане
            </AppText>
            <AppText variant="small" bold numeric>
              {spray
                ? `${formatHour(new Date(spray.from))} – ${formatHour(new Date(spray.to))}`
                : weather.data
                  ? "Неподходящо днес"
                  : "—"}
            </AppText>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: 12, padding: 10 }}>
            <AppText variant="caption" tone="muted">
              Следващ добър ден
            </AppText>
            <AppText variant="small" bold numberOfLines={1}>
              {nextGood
                ? `${new Date(nextGood.date).getDate()} ${monthName(new Date(nextGood.date).getMonth())}`
                : weather.data
                  ? "Няма в прогнозата"
                  : "—"}
            </AppText>
          </View>
        </View>
      </Pressable>

      <View style={{ gap: space.sm }}>
        <AppText variant="heading">Популярни въпроси</AppText>
        {SUGGESTIONS.map((question) => (
          <Pressable
            key={question}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/ai/chat", params: { q: question } })}
            style={({ pressed }) => pressed && pressedStyle}
          >
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}>
              <Icon name="sparkles" size={16} color={colors.brand[600]} />
              <AppText variant="small" style={{ flex: 1 }}>
                {question}
              </AppText>
              <Icon name="chevron-forward" size={16} color={colors.muted} />
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
