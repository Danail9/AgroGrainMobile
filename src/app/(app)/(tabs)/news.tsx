import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { useNews } from "@/api/queries";
import type { z } from "zod";

import type { newsListItemSchema } from "@/api/schemas";
import { relativeTime } from "@/lib/format";
import { space } from "@/theme/tokens";
import { EmptyState, Pill, pressedStyle, Card } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { Tabs } from "@/ui/Tabs";
import { AppText } from "@/ui/Text";

type Article = z.infer<typeof newsListItemSchema>;

const CATEGORY_STYLE: Record<Article["category"], { emoji: string; color: string; label: string }> = {
  TOP: { emoji: "⭐", color: "#22733e", label: "Важно" },
  BULGARIA: { emoji: "🌾", color: "#d97706", label: "България" },
  EU: { emoji: "🇪🇺", color: "#3b82f6", label: "ЕС" },
  MARKET: { emoji: "📈", color: "#10b981", label: "Пазар" },
};

function NewsList({ items }: { items: Article[] }) {
  if (!items.length) {
    return <EmptyState title="Няма новини" description="Няма новини в тази категория." />;
  }

  return (
    <View style={{ gap: space.md }}>
      {items.map((article) => {
        const style = CATEGORY_STYLE[article.category];
        return (
          <Pressable
            key={article.slug}
            accessibilityRole="button"
            onPress={() => router.push(`/news/${article.slug}`)}
            style={({ pressed }) => pressed && pressedStyle}
          >
            <Card style={{ flexDirection: "row", gap: space.md, padding: 12 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  backgroundColor: style.color,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AppText style={{ fontSize: 26 }}>{style.emoji}</AppText>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Pill tone="brand">{style.label}</Pill>
                  <AppText variant="caption" tone="muted">
                    {relativeTime(new Date(article.publishedAt))}
                  </AppText>
                </View>
                <AppText variant="small" bold>
                  {article.title}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={2}>
                  {article.summary}
                </AppText>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function NewsScreen() {
  const news = useNews(null);

  return (
    <Screen
      tabbed
      title="Агро новини"
      subtitle="Само най-важното, без излишен шум"
      onRefresh={() => void news.refetch()}
      refreshing={news.isRefetching}
    >
      <QueryBoundary query={news}>
        {({ items }) => {
          const filter = (category: Article["category"]) =>
            items.filter((article) => article.category === category);
          return (
            <Tabs
              items={[
                { key: "top", label: "Най-важното", content: <NewsList items={items} /> },
                { key: "bg", label: "България", content: <NewsList items={filter("BULGARIA")} /> },
                { key: "eu", label: "ЕС", content: <NewsList items={filter("EU")} /> },
                { key: "market", label: "Пазар", content: <NewsList items={filter("MARKET")} /> },
              ]}
            />
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}
