import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import type { UseQueryResult } from "@tanstack/react-query";
import type { z } from "zod";

import type { marketInsightsSchema } from "@/api/schemas";
import { relativeTime } from "@/lib/format";
import { hasInsightTranslation, insightSourceName, isXSource } from "@/lib/market-insights";
import { colors, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { InsightSourceStatus } from "@/ui/InsightSourceStatus";
import { Card, pressedStyle } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

type MarketInsights = z.infer<typeof marketInsightsSchema>;

function authorPosts(data: MarketInsights | undefined, username: string) {
  return data?.items.filter((item) => hasInsightTranslation(item) && isXSource(item.source.url) &&
    new URL(item.source.url).pathname.split("/")[1]?.toLowerCase() === username) ?? [];
}

export function MarketInsightsNews({ sizovQuery, linvilleQuery }: {
  sizovQuery: UseQueryResult<MarketInsights, Error>;
  linvilleQuery: UseQueryResult<MarketInsights, Error>;
}) {
  const queries = [sizovQuery, linvilleQuery];
  const unavailable = queries.some((query) => query.isError || query.fetchStatus === "paused");
  const sizov = authorPosts(sizovQuery.data, "sizov_andre").slice(0, 2);
  const linville = authorPosts(linvilleQuery.data, "jlinvillefert").slice(0, 1);
  const items = [...sizov, ...linville];

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.sectionHeader}>
        <View style={styles.sourceIcon}>
          <AppText bold style={styles.sourceIconText}>X</AppText>
        </View>
        <View style={{ flex: 1, gap: space.xs }}>
          <AppText variant="heading">Пазарен поглед</AppText>
          <AppText variant="small" tone="muted">Andrey Sizov · Josh Linville</AppText>
        </View>
      </View>
      {unavailable ? (
        <Card style={{ gap: space.sm }}>
          <AppText variant="small" tone="muted">Пазарните анализи не могат да бъдат заредени.</AppText>
          <Button title="Опитай отново" variant="secondary" compact
            onPress={() => void Promise.all(queries.map((query) => query.refetch()))} />
        </Card>
      ) : queries.some((query) => query.isPending) ? (
        <Card><AppText variant="small" tone="muted">Зареждаме пазарните анализи…</AppText></Card>
      ) : items.length === 0 ? (
        <Card><AppText variant="small" tone="muted">Няма достъпни публикации от X в момента.</AppText></Card>
      ) : (
        <>{items.map((item) => (
          <Pressable key={item.id} accessibilityRole="button"
            accessibilityLabel={`Пазарен анализ: ${item.headline}`}
            onPress={() => router.push({ pathname: "/ai/insights/[id]", params: { id: item.id } })}
            style={({ pressed }) => pressed && pressedStyle}>
            <Card style={styles.insight}>
              <View style={styles.meta}>
                <View style={styles.avatar}>
                  <Icon name="trending-up-outline" size={17} color={colors.brand[700]} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" bold>{insightSourceName(item.source.name)}</AppText>
                  <AppText variant="caption" tone="muted">X · {relativeTime(new Date(item.source.publishedAt))}</AppText>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </View>
              <AppText variant="body" bold>{item.headline}</AppText>
              <AppText variant="small" tone="muted" numberOfLines={3}>{item.summary}</AppText>
              <InsightSourceStatus source={item.source} />
              <View style={styles.divider} />
              <View style={styles.status}>
                <Icon name={item.verification === "VERIFIED" ? "checkmark-circle-outline" : "information-circle-outline"}
                  size={16} color={colors.brand[700]} />
                <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                  {item.verification === "VERIFIED" ? "Проверен анализ" : "AI обобщение · твърденията не са напълно проверени"}
                </AppText>
              </View>
            </Card>
          </Pressable>
        ))}
          {sizov.length === 0 ? <AppText variant="caption" tone="muted">Няма достъпни публикации от Andrey Sizov в момента.</AppText> : null}
          {linville.length === 0 ? <AppText variant="caption" tone="muted">Няма достъпни публикации от Josh Linville в момента.</AppText> : null}
        </>
      )}
      <Button title="Виж още пазарни новини" variant="secondary" compact
        onPress={() => router.push({ pathname: "/ai/insights", params: { platform: "X" } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.xs },
  sourceIcon: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brand[900],
    alignItems: "center", justifyContent: "center",
  },
  sourceIconText: { color: colors.white, fontSize: 20 },
  insight: { gap: space.md, borderColor: colors.line },
  meta: { flexDirection: "row", alignItems: "center", gap: space.sm },
  avatar: {
    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.brand[50],
    alignItems: "center", justifyContent: "center",
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  status: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
