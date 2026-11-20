import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, Linking, StyleSheet, View } from "react-native";

import { isApiError } from "@/api/client";
import { useMarketInsight } from "@/api/queries";
import { formatShortDate } from "@/lib/format";
import { hasInsightTranslation, insightSourceName, insightTranslationPreview } from "@/lib/market-insights";
import { colors, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/forms";
import { Icon, type IconName } from "@/ui/Icon";
import { InsightSourceStatus } from "@/ui/InsightSourceStatus";
import { Card } from "@/ui/primitives";
import { ErrorState, QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

function SectionHeading({ icon, title, caption }: { icon: IconName; title: string; caption: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionIcon}><Icon name={icon} size={19} color={colors.brand[700]} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" bold>{title}</AppText>
        <AppText variant="caption" tone="muted">{caption}</AppText>
      </View>
    </View>
  );
}

function SourceChart({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <Card style={styles.section}>
      <SectionHeading icon="bar-chart-outline" title="Изображение" caption="Източник: FertilizerWeek" />
      {failed ? (
        <AppText variant="small" tone="muted" accessibilityRole="alert">
          Изображението не може да бъде заредено. Виж оригиналната публикация.
        </AppText>
      ) : (
        <Image source={{ uri: url, cache: "reload" }} accessible
          accessibilityLabel="Изображение от FertilizerWeek. За подробности виж оригиналната публикация."
          resizeMode="contain" style={styles.chart} onError={() => setFailed(true)} />
      )}
      <AppText variant="caption" tone="muted">
        Данните и евентуалните прогнози са на източника; не са текущи ценови котировки за България.
      </AppText>
    </Card>
  );
}

export default function MarketInsightDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useMarketInsight(id);
  const [linkError, setLinkError] = useState(false);
  const preview = insightTranslationPreview(query.data?.translation ?? "");

  async function openSource(url: string) {
    try {
      if (new URL(url).protocol !== "https:") throw new Error("Unsupported source URL");
      await Linking.openURL(url);
      setLinkError(false);
    } catch (error) {
      console.warn("[market-insights] Failed to open source", error);
      setLinkError(true);
    }
  }

  return (
    <Screen
      title="Пазарен анализ"
      back="/ai/insights"
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      {(query.data && !hasInsightTranslation(query.data)) || (isApiError(query.error) && query.error.code === "not_found") ? (
        <ErrorState title="Анализът не е наличен" message="Анализът е премахнат или вече не е публикуван." />
      ) : query.isError ? <ErrorState message={isApiError(query.error) ? query.error.message : "Не успяхме да заредим анализа."}
        onRetry={() => void query.refetch()} /> : <QueryBoundary query={query} stamp={false}>{(item) => (
        <View style={{ gap: space.lg }}>
          <Card style={styles.hero}>
            <View style={styles.sourceRow}>
              <View style={styles.sourceIcon}><Icon name="person-outline" size={18} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <AppText variant="small" bold>{insightSourceName(item.source.name)}</AppText>
                <AppText variant="caption" tone="muted">{formatShortDate(new Date(item.source.publishedAt))} · Оригинален източник</AppText>
              </View>
            </View>
            <AppText variant="heading">{item.headline}</AppText>
            <InsightSourceStatus source={item.source} />
            <View style={styles.heroBadge}>
              <Icon name="sparkles-outline" size={14} color={colors.brand[700]} />
              <AppText variant="caption" tone="brand" bold>ПАЗАРЕН ОБЗОР</AppText>
            </View>
            <Button title="Оригинална публикация" compact variant="secondary" icon="open-outline"
              onPress={() => void openSource(item.source.url)} />
            {linkError ? <AppText tone="danger" variant="caption">Връзката не може да бъде отворена.</AppText> : null}
          </Card>
          <Card style={styles.translation}>
            <SectionHeading icon="language-outline" title="Превод на публикацията"
              caption={preview.shortened ? "Откъс от публикацията · превод с AI" : "Текст от източника · преведен с AI"} />
            <View style={styles.translationBody}>
              {item.translation ? (
                <AppText variant="body" selectable style={styles.translationText}>{preview.text}</AppText>
              ) : (
                <AppText variant="small" tone="muted">Преводът не е наличен. Виж оригиналната публикация от източника.</AppText>
              )}
            </View>
            {item.translation && /(?:\.{3}|…)\s*$/u.test(item.translation) ? (
              <View style={styles.translationNotice}>
                <Icon name="information-circle-outline" size={18} color={colors.amber700} />
                <AppText variant="small" style={styles.noticeText}>
                  Преводът завършва с многоточие. Провери оригиналната публикация за пълния текст.
                </AppText>
              </View>
            ) : null}
            <AppText variant="caption" tone="muted">Автоматичният превод може да съдържа грешки.</AppText>
            {preview.shortened ? <Button
              title="Виж целия пост"
              compact
              variant="secondary"
              onPress={() => router.push({ pathname: "/ai/insights/post/[id]", params: { id: item.id } })}
            /> : null}
          </Card>
          <Card style={styles.summary}>
            <SectionHeading icon="document-text-outline" title="Накратко" caption="AI обобщение на публикацията" />
            <AppText variant="body" selectable style={styles.readingText}>{item.summary}</AppText>
          </Card>
          {item.chartUrl ? <SourceChart key={item.chartUrl} url={item.chartUrl} /> : null}
          <Card style={styles.section}>
            <SectionHeading icon="analytics-outline" title="Интерпретация на AgroGrain AI" caption="Възможно значение за пазара" />
            <AppText variant="body" selectable style={styles.readingText}>{item.analysis}</AppText>
            <View style={styles.disclaimer}>
              <Icon name="information-circle-outline" size={17} color={colors.brand[700]} />
              <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                {item.verification === "VERIFIED" ? "Анализът е маркиран като проверен." : "Анализът не е напълно проверен."}{" "}
                AI може да греши. Анализът не доказва причинна връзка с промяна на цените.
              </AppText>
            </View>
            {item.evidence.length ? <AppText variant="small" bold>Проверени факти и източници</AppText> : null}
            {item.evidence.map((entry, index) => (
              <View key={`${entry.url}-${index}`} style={{ gap: space.xs }}>
                <AppText variant="small">{entry.claim}</AppText>
                <Button title={entry.name} compact variant="ghost" onPress={() => void openSource(entry.url)} />
              </View>
            ))}
          </Card>
          {(item.crops.length || item.regions.length) ? <View style={styles.tags}>
            {[...item.crops, ...item.regions].map((tag, index) => (
              <View key={`${tag}-${index}`} style={styles.tag}><AppText variant="caption" tone="brand" bold>{tag}</AppText></View>
            ))}
          </View> : null}
        </View>
      )}</QueryBoundary>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.md, borderColor: colors.brand[100] },
  heroBadge: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: space.xs,
    backgroundColor: colors.brand[50], borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs,
  },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  sourceIcon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brand[800],
    alignItems: "center", justifyContent: "center",
  },
  section: { gap: space.md },
  chart: { width: "100%", aspectRatio: 1.65 },
  translation: { gap: space.md, borderColor: colors.brand[100] },
  translationBody: {
    backgroundColor: colors.soft, borderRadius: radius.md, padding: space.lg,
    borderLeftWidth: 3, borderLeftColor: colors.brand[300],
  },
  translationText: { lineHeight: 26 },
  translationNotice: {
    flexDirection: "row", alignItems: "flex-start", gap: space.sm,
    backgroundColor: colors.amber50, borderRadius: radius.md, padding: space.md,
  },
  noticeText: { flex: 1, color: colors.amber700, lineHeight: 20 },
  summary: { gap: space.md, backgroundColor: colors.brand[50], borderColor: colors.brand[100] },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: space.md },
  sectionIcon: {
    width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.brand[100],
    alignItems: "center", justifyContent: "center",
  },
  readingText: { lineHeight: 25 },
  disclaimer: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: space.md },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tag: { backgroundColor: colors.brand[50], borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
});
