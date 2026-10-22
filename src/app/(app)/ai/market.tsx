import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { useMarket } from "@/api/queries";
import { relativeTime } from "@/lib/format";
import { space } from "@/theme/tokens";
import { PriceRow } from "@/ui/PriceRow";
import { Card, pressedStyle } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

export default function MarketAnalysisScreen() {
  const query = useMarket();
  return (
    <Screen back="/market" title="Пазарен обзор" subtitle="Текущи пристанищни оферти и новини"
      onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <QueryBoundary query={query}>
        {({ prices, news }) => (
          <>
            <Card>
              <AppText variant="heading">Доставено до пристанище Варна/Бургас</AppText>
              <AppText variant="small" tone="muted" style={{ marginTop: space.sm }}>
                Офертите се въвеждат ръчно. Няма автоматични котировки или дневни промени.
                Сравнявай цени за една и съща култура и пристанище.
              </AppText>
            </Card>
            <View style={{ gap: space.md }}>
              <AppText variant="heading">Текущи оферти</AppText>
              {!prices.length ? <Card><AppText tone="muted">Все още няма публикувани пристанищни оферти.</AppText></Card> : null}
              {prices.map((price) => (
                <Card key={price.slug} padded={false}><PriceRow price={price} showChange={false} fullUnit /></Card>
              ))}
            </View>
            {news.length ? <View style={{ gap: space.md }}>
              <AppText variant="heading">Фактори на пазара</AppText>
              {news.slice(0, 2).map((article) => (
                <Pressable key={article.slug} accessibilityRole="button" onPress={() => router.push(`/news/${article.slug}`)}
                  style={({ pressed }) => pressed && pressedStyle}>
                  <Card>
                    <AppText variant="caption" tone="brand">{article.source} · {relativeTime(new Date(article.publishedAt))}</AppText>
                    <AppText variant="body" bold style={{ marginTop: 4 }}>{article.title}</AppText>
                    <AppText variant="small" tone="muted" style={{ marginTop: 4 }}>{article.summary}</AppText>
                  </Card>
                </Pressable>
              ))}
            </View> : null}
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}
