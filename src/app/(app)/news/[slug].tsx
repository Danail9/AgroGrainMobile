import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { isApiError } from "@/api/client";
import { useArticle } from "@/api/queries";
import { relativeTime } from "@/lib/format";
import { Card, Pill } from "@/ui/primitives";
import { ErrorState, QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

export default function ArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const article = useArticle(slug);

  return (
    <Screen back="/news" title="Новина">
      {isApiError(article.error) && article.error.code === "not_found" ? (
        <ErrorState
          icon="newspaper-outline"
          title="Не е намерена"
          message="Тази новина вече не е налична."
        />
      ) : (
        <QueryBoundary query={article} stamp={false}>
          {(data) => (
            <Card style={{ gap: 12, padding: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pill tone="brand">{data.source}</Pill>
                <AppText variant="caption" tone="muted">
                  {relativeTime(new Date(data.publishedAt))}
                </AppText>
              </View>
              <AppText variant="title" style={{ fontSize: 21, lineHeight: 27 }} accessibilityRole="header">
                {data.title}
              </AppText>
              <AppText variant="small" tone="muted" bold style={{ lineHeight: 20 }}>
                {data.summary}
              </AppText>
              <AppText variant="small" style={{ lineHeight: 22 }} selectable>
                {data.body}
              </AppText>
            </Card>
          )}
        </QueryBoundary>
      )}
    </Screen>
  );
}
