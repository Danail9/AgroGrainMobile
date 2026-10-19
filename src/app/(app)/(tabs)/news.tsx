import { router } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import type { z } from "zod";

import { useNews, useWasdeSummary } from "@/api/queries";
import type { newsListItemSchema } from "@/api/schemas";
import { relativeTime } from "@/lib/format";
import { groupNewsByDay } from "@/lib/news";
import { colors, radius, shadowCard, space } from "@/theme/tokens";
import { EmptyState, pressedStyle } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { Tabs } from "@/ui/Tabs";
import { AppText } from "@/ui/Text";
import { WasdeSummaryCard } from "@/ui/WasdeSummaryCard";

type Article = z.infer<typeof newsListItemSchema>;

const CATEGORY_STYLE: Record<Article["category"], { emoji: string; color: string; soft: string; label: string }> = {
  TOP: { emoji: "⭐", color: "#22733e", soft: "#e8f5ec", label: "Важно" },
  BULGARIA: { emoji: "🌾", color: "#b45309", soft: "#fef3e2", label: "България" },
  EU: { emoji: "🇪🇺", color: "#2563eb", soft: "#e8f0fe", label: "ЕС" },
  MARKET: { emoji: "📈", color: "#047857", soft: "#e3f7ef", label: "Пазар" },
};

const open = (article: Article) => router.push(`/news/${article.slug}`);

function Meta({ article, now }: { article: Article; now: number }) {
  const style = CATEGORY_STYLE[article.category];
  return (
    <View style={styles.meta}>
      <AppText variant="caption" bold style={{ color: style.color }}>
        {style.label}
      </AppText>
      <AppText variant="caption" tone="muted">
        ·
      </AppText>
      <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {article.source ? `${article.source} · ` : ""}
        {relativeTime(new Date(article.publishedAt), new Date(now))}
      </AppText>
    </View>
  );
}

/** The newest story, larger, so the most important news is read first. */
function Featured({ article, now }: { article: Article; now: number }) {
  const style = CATEGORY_STYLE[article.category];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Водеща новина: ${article.title}`}
      onPress={() => open(article)}
      style={({ pressed }) => [styles.featured, pressed && pressedStyle]}
    >
      {article.imageUrl ? (
        <Image source={{ uri: article.imageUrl }} style={styles.featuredImage} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.featuredImage, styles.featuredPlaceholder, { backgroundColor: style.soft }]}>
          <AppText style={{ fontSize: 44 }}>{style.emoji}</AppText>
        </View>
      )}
      <View style={{ padding: space.lg, gap: 6 }}>
        <View style={[styles.badge, { backgroundColor: style.soft }]}>
          <AppText variant="caption" bold style={{ color: style.color }}>
            Водеща новина
          </AppText>
        </View>
        <AppText variant="heading" bold numberOfLines={3}>
          {article.title}
        </AppText>
        <AppText variant="small" tone="muted" numberOfLines={3}>
          {article.summary}
        </AppText>
        <Meta article={article} now={now} />
      </View>
    </Pressable>
  );
}

function Row({ article, now, first }: { article: Article; now: number; first: boolean }) {
  const style = CATEGORY_STYLE[article.category];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={article.title}
      onPress={() => open(article)}
      style={({ pressed }) => [styles.row, !first && styles.divider, pressed && pressedStyle]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Meta article={article} now={now} />
        <AppText variant="small" bold numberOfLines={3}>
          {article.title}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={2}>
          {article.summary}
        </AppText>
      </View>
      {article.imageUrl ? (
        <Image source={{ uri: article.imageUrl }} style={styles.thumb} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.thumb, styles.featuredPlaceholder, { backgroundColor: style.soft }]}>
          <AppText style={{ fontSize: 24 }}>{style.emoji}</AppText>
        </View>
      )}
    </Pressable>
  );
}

function NewsList({ items, now, featured }: { items: Article[]; now: number; featured: boolean }) {
  if (!items.length) {
    return <EmptyState title="Няма новини" description="Все още няма новини в тази категория. Дръпни надолу, за да провериш отново." />;
  }

  const [lead, ...rest] = featured ? items : [undefined, ...items];
  return (
    <View style={{ gap: space.lg }}>
      {lead ? <Featured article={lead} now={now} /> : null}
      {groupNewsByDay(rest as Article[], now).map((group) => (
        <View key={group.title} style={{ gap: 6 }}>
          <AppText variant="caption" tone="muted" bold style={styles.groupTitle}>
            {group.title}
          </AppText>
          <View style={styles.group}>
            {group.items.map((article, index) => (
              <Row key={article.slug} article={article} now={now} first={index === 0} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function NewsScreen() {
  const news = useNews(null);
  const wasde = useWasdeSummary();

  return (
    <Screen
      tabbed
      back="/"
      title="Агро новини"
      subtitle="Само най-важното, без излишен шум"
      onRefresh={() => void Promise.all([news.refetch(), wasde.refetch()])}
      refreshing={news.isRefetching || wasde.isRefetching}
    >
      <QueryBoundary query={news}>
        {({ items }) => {
          const now = news.dataUpdatedAt;
          const filter = (category: Article["category"]) =>
            items.filter((article) => article.category === category);
          const tab = (key: string, label: string, list: Article[], featured = false) => ({
            key,
            label,
            count: key === "top" ? undefined : list.length,
            content: <NewsList items={list} now={now} featured={featured} />,
          });
          return (
            <Tabs
              variant="segmented"
              items={[
                {
                  ...tab("top", "Всички", items, true),
                  content: (
                    <View style={{ gap: space.lg }}>
                      <WasdeSummaryCard
                        summary={wasde.data}
                        loading={wasde.isPending}
                        error={wasde.isError}
                      />
                      <NewsList items={items} now={now} featured />
                    </View>
                  ),
                },
                tab("bg", "България", filter("BULGARIA")),
                tab("eu", "ЕС", filter("EU")),
                tab("market", "Пазар", filter("MARKET")),
              ]}
            />
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  featured: {
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    overflow: "hidden",
    ...shadowCard,
  },
  featuredImage: { width: "100%", height: 160 },
  featuredPlaceholder: { alignItems: "center", justifyContent: "center" },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  groupTitle: { textTransform: "uppercase", letterSpacing: 0.5, marginLeft: 4 },
  group: { borderRadius: radius.lg, backgroundColor: colors.white, overflow: "hidden", ...shadowCard },
  row: { flexDirection: "row", gap: space.md, padding: space.lg, alignItems: "flex-start" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
});
