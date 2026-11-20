import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { isApiError } from "@/api/client";
import { useMarketInsight } from "@/api/queries";
import { formatShortDate } from "@/lib/format";
import { hasInsightTranslation, insightSourceName } from "@/lib/market-insights";
import { colors, radius, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { InsightSourceStatus } from "@/ui/InsightSourceStatus";
import { Card } from "@/ui/primitives";
import { ErrorState, QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

export default function TranslatedPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useMarketInsight(id);

  return (
    <Screen
      title="Цялата публикация"
      back={id ? { pathname: "/ai/insights/[id]", params: { id } } : "/ai/insights"}
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      {(query.data && !hasInsightTranslation(query.data)) || (isApiError(query.error) && query.error.code === "not_found") ? (
        <ErrorState title="Публикацията не е налична" message="Публикацията не е налична за четене." />
      ) : query.isError ? (
        <ErrorState message={isApiError(query.error) ? query.error.message : "Не успяхме да заредим публикацията."}
          onRetry={() => void query.refetch()} />
      ) : (
        <QueryBoundary query={query} stamp={false}>{(item) => (
          <Card style={styles.card}>
            <View style={styles.heading}>
              <View style={styles.icon}><Icon name="language-outline" size={20} color={colors.brand[700]} /></View>
              <View style={styles.headingText}>
                <AppText variant="heading">{insightSourceName(item.source.name)}</AppText>
                <AppText variant="caption" tone="muted">
                  {formatShortDate(new Date(item.source.publishedAt))} · Превод с AI
                </AppText>
              </View>
            </View>
            <InsightSourceStatus source={item.source} />
            <AppText variant="body" selectable style={styles.post}>{item.translation}</AppText>
            <AppText variant="caption" tone="muted">Автоматичният превод може да съдържа грешки.</AppText>
          </Card>
        )}</QueryBoundary>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.lg, borderColor: colors.brand[100] },
  heading: { flexDirection: "row", alignItems: "center", gap: space.md },
  headingText: { flex: 1, gap: space.xs },
  icon: {
    width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brand[100],
    alignItems: "center", justifyContent: "center",
  },
  post: { fontSize: 17, lineHeight: 29 },
});
