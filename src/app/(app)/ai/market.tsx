import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { useMarket } from "@/api/queries";
import {
  CATEGORY_LABELS,
  averagePrice,
  changeSentence,
  latestDay,
  strongestSignal,
} from "@/lib/market";
import { formatLongDate, formatNumber, formatShortDate, relativeTime } from "@/lib/format";
import { colors, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { Card, ChangeBadge, pressedStyle } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

export default function MarketAnalysisScreen() {
  const query = useMarket();

  return (
    <Screen
      back="/market"
      title="AI пазарен анализ"
      subtitle={formatLongDate()}
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <QueryBoundary query={query}>
        {({ prices, news }) => {
          const { prices: today, latest } = latestDay(prices);
          if (!today.length || !latest) {
            return (
              <Card>
                <AppText variant="small" tone="muted">
                  Все още няма публикувани цени за анализ.
                </AppText>
              </Card>
            );
          }

          const top = [...today].sort((a, b) => b.price - a.price).slice(0, 3);
          const signal = strongestSignal(today);
          const up = (signal?.changePct ?? 0) >= 0;

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
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    backgroundColor: colors.brand[600],
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="bar-chart" size={22} color={colors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="body" bold>
                    Анализ за днешните цени
                  </AppText>
                  <AppText variant="small" tone="muted" style={{ marginTop: 4, lineHeight: 20 }}>
                    {changeSentence(today)} Водещите котировки са{" "}
                    {top.map((price) => `${price.name} ${formatNumber(price.price)} ${price.unit}`).join(", ")}.
                  </AppText>
                </View>
              </Card>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <Card style={{ flex: 1, gap: 4 }}>
                  <AppText variant="caption" tone="muted" bold>
                    Средна цена
                  </AppText>
                  <AppText variant="title" numeric>
                    {formatNumber(averagePrice(today))}{" "}
                    <AppText variant="small" tone="muted">
                      €/т
                    </AppText>
                  </AppText>
                </Card>
                <Card style={{ flex: 1, gap: 4 }}>
                  <AppText variant="caption" tone="muted" bold>
                    Обновено
                  </AppText>
                  <AppText variant="title" numeric>
                    {formatShortDate(latest)}
                  </AppText>
                </Card>
              </View>

              {signal ? (
                <Card style={{ flexDirection: "row", gap: space.md }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: up ? "#ecfdf5" : colors.red50,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={up ? "arrow-up" : "arrow-down"}
                      size={20}
                      color={up ? colors.up : colors.down}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText variant="small" bold>
                      Най-силен сигнал
                    </AppText>
                    <AppText variant="small" tone="muted" style={{ lineHeight: 20 }}>
                      {signal.name} има най-голямо движение днес: {formatNumber(signal.price)}{" "}
                      {signal.unit}. Това е първият ред за наблюдение при краткосрочни оферти.
                    </AppText>
                    <ChangeBadge value={signal.changePct} variant="plain" />
                  </View>
                </Card>
              ) : null}

              <View style={{ gap: space.md }}>
                <AppText variant="heading">Цени за днес</AppText>
                {today.map((price) => (
                  <Pressable
                    key={price.slug}
                    accessibilityRole="button"
                    onPress={() => router.push(`/market/${price.slug}`)}
                    style={({ pressed }) => pressed && pressedStyle}
                  >
                    <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: 14 }}>
                      <AppText style={{ fontSize: 22, width: 28 }}>{price.emoji}</AppText>
                      <View style={{ flex: 1 }}>
                        <AppText variant="small" bold numberOfLines={1}>
                          {price.name}
                        </AppText>
                        <AppText variant="caption" tone="muted">
                          {CATEGORY_LABELS[price.category]} · {formatShortDate(new Date(price.date))}
                        </AppText>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <AppText variant="small" bold numeric>
                          {formatNumber(price.price)} {price.unit}
                        </AppText>
                        <ChangeBadge value={price.changePct} variant="plain" />
                      </View>
                      <Icon name="chevron-forward" size={17} color={colors.muted} />
                    </Card>
                  </Pressable>
                ))}
              </View>

              {news.length ? (
                <View style={{ gap: space.md }}>
                  <AppText variant="heading">Фактори на пазара</AppText>
                  {news.slice(0, 2).map((article) => (
                    <Pressable
                      key={article.slug}
                      accessibilityRole="button"
                      onPress={() => router.push(`/news/${article.slug}`)}
                      style={({ pressed }) => pressed && pressedStyle}
                    >
                      <Card style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <AppText variant="caption" bold style={{ color: colors.brand[700] }}>
                            {article.source} · {relativeTime(new Date(article.publishedAt))}
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
              ) : null}
            </>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}
