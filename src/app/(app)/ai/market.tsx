import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useCropInsight, useMarket, useMe } from "@/api/queries";
import type { PriceRow } from "@/api/schemas";
import { favoritesFirst } from "@/lib/favorites";
import { compareCropPorts, cropNewsTerms } from "@/lib/market-analysis";
import { formatNumber, formatShortDate, relativeTime } from "@/lib/format";
import { colors, space } from "@/theme/tokens";
import { Button } from "@/ui/forms";
import { Card, pressedStyle } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

export default function MarketAnalysisScreen() {
  const query = useMarket();
  const me = useMe();
  const [selected, setSelected] = useState<string>();
  const prices = favoritesFirst(query.data?.prices ?? [], me.data?.favoriteCrops ?? []);
  const crop = prices.find((price) => price.slug === selected) ?? prices[0];
  return <Screen back="/ai" title="Пазарен анализ" subtitle="Сравнение по култура и пристанище"
    onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
    <QueryBoundary query={query}>{({ news }) => <>
      {!crop ? <Card><AppText tone="muted">Все още няма публикувани цени за анализ.</AppText></Card> : <>
        <AppText variant="small" bold>Избери култура</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {prices.map((price) => <Button key={price.slug} title={price.name} compact
            selected={price.slug === crop.slug} variant={price.slug === crop.slug ? "primary" : "secondary"}
            onPress={() => setSelected(price.slug)} />)}
        </ScrollView>
        <CropAnalysis key={crop.slug} crop={crop} />
        {(() => {
          const terms = cropNewsTerms(crop.name);
          const relevant = news.filter((article) => terms.some((term) =>
            `${article.title} ${article.summary}`.toLocaleLowerCase("bg").includes(term))).slice(0, 2);
          return <View style={{ gap: space.sm }}>
            <AppText variant="heading">Новини за {crop.name}</AppText>
            {relevant.length ? relevant.map((article) => <Pressable key={article.slug} accessibilityRole="button"
              accessibilityLabel={article.title} onPress={() => router.push(`/news/${article.slug}`)}
              style={({ pressed }) => pressed && pressedStyle}>
              <Card style={{ gap: space.sm }}>
                <AppText variant="caption" tone="brand">{article.source} · {relativeTime(new Date(article.publishedAt))}</AppText>
                <AppText bold>{article.title}</AppText>
                <AppText variant="small" tone="muted" numberOfLines={3}>{article.summary}</AppText>
              </Card>
            </Pressable>) : <AppText variant="small" tone="muted">Няма налични новини, споменаващи тази култура.</AppText>}
            <AppText variant="caption" tone="muted">Новините са контекст, не доказателство за причината за промяна в цената.</AppText>
          </View>;
        })()}
      </>}
    </>}</QueryBoundary>
  </Screen>;
}

function CropAnalysis({ crop }: { crop: PriceRow }) {
  const [showInsight, setShowInsight] = useState(false);
  const insight = useCropInsight(crop.slug, crop.delivery, showInsight);
  const comparison = compareCropPorts(crop);
  const { varna, burgas, difference } = comparison;
  return <>
    <Card style={{ gap: space.sm, backgroundColor: colors.brand[50] }}>
      <AppText variant="heading">Какво показват данните?</AppText>
      <AppText bold>{crop.name}</AppText>
      <AppText variant="body">{difference === null ? "Няма сравними цени за двете пристанища на една и съща дата." :
        difference === 0 ? "Варна и Бургас са на еднаква цена." :
          `${difference > 0 ? "Бургас" : "Варна"} е с ${formatNumber(Math.abs(difference))} ${crop.unit} над ${difference > 0 ? "Варна" : "Бургас"}.`}</AppText>
      <AppText variant="caption" tone="muted">Разликата е преди транспортни разходи и не гарантира по-добра нетна продажна цена.</AppText>
    </Card>
    <View style={{ flexDirection: "row", gap: space.sm }}>
      {([["Варна", varna], ["Бургас", burgas]] as const).map(([label, price]) => <Card key={label} style={{ flex: 1, gap: space.sm }}>
        <AppText bold>{label}</AppText>
        <AppText variant="heading">{price ? `${formatNumber(price.price)} ${crop.unit}` : "Няма цена"}</AppText>
        {price && <AppText variant="caption" tone="muted">{formatShortDate(new Date(price.date))}</AppText>}
      </Card>)}
    </View>
    {difference !== null && <Card style={{ gap: space.xs }}>
      <AppText bold>Разлика Бургас спрямо Варна</AppText>
      <AppText>{difference > 0 ? "+" : ""}{formatNumber(difference)} {crop.unit} · {comparison.percent?.toFixed(2)}%</AppText>
    </Card>}
    <AppText variant="caption" tone="muted">Ръчно въведени оферти, не автоматични котировки. Дата на цената: {formatShortDate(new Date(crop.date))}{crop.source ? ` · ${crop.source}` : ""}.</AppText>
    <Card style={{ gap: space.sm }}>
      <AppText bold>Тенденция</AppText>
      <AppText variant="small" tone="muted">Няма достатъчно исторически данни за тенденция на тези пристанищни оферти. Текущата разлика между пристанищата не е дневна промяна.</AppText>
    </Card>
    <Card style={{ gap: space.sm }}>
      <AppText variant="heading">Коментар за културата</AppText>
      {!showInsight ? <Button title="Зареди коментар" variant="secondary" onPress={() => setShowInsight(true)} /> :
        <QueryBoundary query={insight}>{(data) => <>
          <AppText variant="caption" tone="muted">{data.source === "openai" ? "AI интерпретация" : "Обзор по наличните данни"} · не е ценова прогноза</AppText>
          <AppText variant="small">{data.content}</AppText>
        </>}</QueryBoundary>}
      <AppText variant="caption" tone="muted">Коментарът използва наличната референтна цена, не пълна история или доказана причинно-следствена връзка.</AppText>
    </Card>
    <Button title="Попитай AI за тази култура" icon="chatbubble-outline" onPress={() => router.push({
      pathname: "/ai/chat", params: { q: `Как да тълкувам текущите оферти за ${crop.name}? Разграничи фактите от предположенията и отчети липсата на история.` },
    })} />
    <Button title="Подробни цени и ценови известия" variant="secondary" onPress={() => router.push(`/market/${crop.slug}`)} />
  </>;
}
