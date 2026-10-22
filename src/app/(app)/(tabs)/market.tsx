import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useMarket, useMe } from "@/api/queries";
import type { PriceRow as PriceRowData } from "@/api/schemas";
import { formatShortDate, relativeTime } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";
import { FertilizerMarket } from "@/ui/FertilizerMarket";
import { Icon, type IconName } from "@/ui/Icon";
import { PriceRow } from "@/ui/PriceRow";
import { favoritesFirst } from "@/lib/favorites";
import { Card, Divider, EmptyState, RowList, pressedStyle } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { Tabs } from "@/ui/Tabs";
import { AppText } from "@/ui/Text";

type Market = NonNullable<ReturnType<typeof useMarket>["data"]>;
type Section = "grain" | "fertilizer" | "seeds";

const SECTIONS: { key: Section; label: string; icon: IconName; soon?: boolean }[] = [
  { key: "grain", label: "Зърно", icon: "nutrition" },
  { key: "fertilizer", label: "Торове", icon: "flask" },
  { key: "seeds", label: "Семена", icon: "leaf", soon: true },
];

const CATEGORIES: { key: PriceRowData["category"]; label: string }[] = [
  { key: "GRAIN", label: "Зърнени" },
  { key: "OILSEED", label: "Маслодайни" },
  { key: "OTHER", label: "Други" },
  { key: "PROCESSED", label: "Преработени" },
];

export default function MarketScreen() {
  const market = useMarket();
  const me = useMe();
  const [section, setSection] = useState<Section>("grain");

  return (
    <Screen
      tabbed
      back="/"
      title="Пазар"
      subtitle="Доставено до пристанище Варна/Бургас"
      onRefresh={() => void market.refetch()}
      refreshing={market.isRefetching}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        {SECTIONS.map((item) => {
          const selected = item.key === section;
          return (
            <Pressable
              key={item.key}
              disabled={item.soon}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: item.soon }}
              onPress={() => setSection(item.key)}
              style={({ pressed }) => [
                {
                  flex: 1,
                  alignItems: "center",
                  gap: 6,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderStyle: item.soon ? "dashed" : "solid",
                  borderColor: selected ? colors.brand[600] : colors.line,
                  backgroundColor: selected ? colors.brand[600] : item.soon ? colors.soft : colors.white,
                  paddingVertical: 12,
                },
                pressed && pressedStyle,
              ]}
            >
              <Icon
                name={item.icon}
                size={20}
                color={selected ? colors.white : item.soon ? colors.muted : colors.brand[700]}
              />
              <AppText
                variant="small"
                bold
                style={{ color: selected ? colors.white : item.soon ? colors.muted : colors.ink }}
              >
                {item.label}
              </AppText>
              <AppText
                variant="caption"
                style={{ color: selected ? "rgba(255,255,255,0.8)" : colors.muted }}
              >
                {item.soon
                  ? "Скоро"
                  : item.key === "grain"
                    ? `${market.data?.prices.length ?? 0} култури`
                    : "4 категории"}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <QueryBoundary query={market}>
        {(data) =>
          section === "fertilizer" ? (
            <FertilizerMarket offers={data.fertilizers} />
          ) : (
            <Grain data={data} favorites={me.data?.favoriteCrops ?? []} />
          )
        }
      </QueryBoundary>
    </Screen>
  );
}

function Grain({ data, favorites }: { data: Market; favorites: string[] }) {
  return (
    <Tabs
      items={CATEGORIES.map((category) => {
        const prices = favoritesFirst(
          data.prices.filter((price) => price.category === category.key),
          favorites,
        );
        return {
          key: category.key,
          label: category.label,
          content: (
            <View style={{ gap: space.lg }}>
              <PriceList prices={prices} favorites={favorites} />
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/ai/market")}
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.md,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.brand[100],
                    backgroundColor: colors.brand[50],
                    padding: space.lg,
                  },
                  pressed && pressedStyle,
                ]}
              >
                <Icon name="stats-chart" size={26} color={colors.brand[600]} />
                <View style={{ flex: 1 }}>
                  <AppText variant="body" bold>
                    Пазарен обзор
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    Текущи пристанищни оферти и пазарни новини.
                  </AppText>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
              <MarketPulse prices={prices} />
              <MarketNews news={data.news} />
            </View>
          ),
        };
      })}
    />
  );
}

function PriceList({ prices, favorites }: { prices: PriceRowData[]; favorites: string[] }) {
  if (!prices.length) {
    return <EmptyState title="Няма оферти" description="Все още няма публикувани пристанищни оферти в тази категория." />;
  }
  const showChange = prices.some((price) => price.changePct !== null);
  return (
    <RowList>
      {prices.map((price, index) => (
        <View key={price.slug}>
          {index > 0 ? <Divider /> : null}
          <PriceRow price={price} showChange={showChange} fullUnit favorite={favorites.includes(price.slug)} />
        </View>
      ))}
    </RowList>
  );
}

function MarketPulse({ prices }: { prices: PriceRowData[] }) {
  if (!prices.length) return null;

  const latest = new Date(Math.max(...prices.map((price) => new Date(price.date).getTime())));

  return (
    <View style={{ gap: space.md }}>
      <View>
        <AppText variant="heading">Публикувани оферти</AppText>
        <AppText variant="caption" tone="muted">
          Цените се въвеждат ръчно. Товаренето на кораб се договаря отделно.
        </AppText>
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Tile label="Пристанищни оферти" value={String(prices.reduce((sum, row) => sum + (row.portPrices?.length ?? 0), 0))} />
        <Tile label="Обновено" value={formatShortDate(latest)} />
      </View>
    </View>
  );
}

function Tile({
  label,
  value,
  note,
  onPress,
}: {
  label: string;
  value: string;
  note?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={({ pressed }) => [{ flex: 1 }, pressed && pressedStyle]}
    >
      <Card style={{ gap: 4 }}>
        <AppText variant="caption" tone="muted" bold>
          {label}
        </AppText>
        <AppText variant="body" bold numeric numberOfLines={1}>
          {value}
        </AppText>
        {note ? (
          <AppText variant="small" bold numeric style={{ color: colors.brand[700] }}>
            {note}
          </AppText>
        ) : null}
      </Card>
    </Pressable>
  );
}

function MarketNews({ news }: { news: Market["news"] }) {
  if (!news.length) return null;

  return (
    <View style={{ gap: space.md }}>
      <View>
        <AppText variant="heading">Пазарни новини</AppText>
        <AppText variant="caption" tone="muted">
          Последни фактори, които движат цените.
        </AppText>
      </View>
      {news.map((article) => (
        <Pressable
          key={article.slug}
          accessibilityRole="button"
          onPress={() => router.push(`/news/${article.slug}`)}
          style={({ pressed }) => pressed && pressedStyle}
        >
          <Card style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="caption" bold style={{ color: colors.brand[700] }}>
                {article.source}{" "}
                <AppText variant="caption" tone="muted">
                  {relativeTime(new Date(article.publishedAt))}
                </AppText>
              </AppText>
              <AppText variant="small" bold>
                {article.title}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={2}>
                {article.summary}
              </AppText>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
