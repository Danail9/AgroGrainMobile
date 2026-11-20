import { router } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import type { z } from "zod";

import { useMarketInsights } from "@/api/queries";
import type { marketInsightSchema } from "@/api/schemas";
import { formatFullDate } from "@/lib/format";
import { hasInsightTranslation, isXSource } from "@/lib/market-insights";
import { colors, radius, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { InsightSourceStatus } from "@/ui/InsightSourceStatus";
import { Card, pressedStyle } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { AppText } from "@/ui/Text";

type FertilizerGroup = "nitrogen" | "phosphate";
export type FertilizerFilter = FertilizerGroup | "all";

const products: Record<string, string> = {
  UREA: "Карбамид", AN: "Амониев нитрат", CAN: "Калциево-амониев нитрат", UAN: "КАС (UAN)", DAP: "DAP", MAP: "MAP", NPK: "NPK",
};
const directions = { UP: "Възходяща", DOWN: "Низходяща", MIXED: "Смесени сигнали", UNCLEAR: "Недостатъчно данни" };
const groups: Record<FertilizerGroup, string[]> = {
  nitrogen: ["UREA", "AN", "CAN", "UAN"],
  phosphate: ["DAP", "MAP"],
};
const filters: { key: FertilizerFilter; label: string }[] = [
  { key: "all", label: "Всички" },
  { key: "nitrogen", label: "Азотни" },
  { key: "phosphate", label: "Фосфорни" },
];

export function useFertilizerIntelligence(group?: FertilizerGroup, pageSize = group ? 1 : 5) {
  return useMarketInsights(`page=1&platform=X&source=FertilizerWeek&pageSize=${pageSize}${group ? `&fertilizerGroup=${group}` : ""}`);
}

function FertilizerCard({ item, compact }: { item: z.infer<typeof marketInsightSchema>; compact: boolean }) {
  const tags = item.fertilizerTags?.flatMap((code) => products[code] ? [products[code]] : []) ?? [];

  return (
    <Card style={styles.card}>
      <View style={styles.meta}>
        <AppText variant="caption" tone="muted" bold>FertilizerWeek</AppText>
        <AppText variant="caption" tone="muted">Публикувано: {formatFullDate(new Date(item.source.publishedAt))}</AppText>
      </View>
      {tags.length ? <View style={styles.tags}>
        {tags.map((tag) => <View key={tag} style={styles.tag}>
          <AppText variant="caption" tone="brand" bold>{tag}</AppText>
        </View>)}
      </View> : null}
      <AppText variant="body" bold>{item.headline}</AppText>
      <AppText variant="small" numberOfLines={3}>{item.summary}</AppText>
      {item.analysis.trim() ? <View style={styles.impact}>
        <AppText variant="caption" tone="brand" bold>ВЪЗМОЖНО ЗНАЧЕНИЕ · AI</AppText>
        <AppText variant="small" numberOfLines={2}>{item.analysis}</AppText>
      </View> : null}
      <AppText variant="caption" tone="muted">Посока според AI: {directions[item.direction ?? "UNCLEAR"]}</AppText>
      <InsightSourceStatus source={item.source} />
      {!compact && item.chartUrl ? <Image source={{ uri: item.chartUrl, cache: "reload" }} accessibilityLabel="Изображение от FertilizerWeek"
        accessible resizeMode="contain" style={styles.chart} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Виж новината: ${item.headline}`}
        onPress={() => router.push({ pathname: "/ai/insights/[id]", params: { id: item.id } })}
        style={({ pressed }) => [styles.primaryAction, pressed && pressedStyle]}>
        <AppText variant="small" bold style={{ color: colors.white }}>Виж новината</AppText>
        <Icon name="arrow-forward" size={16} color={colors.white} />
      </Pressable>
    </Card>
  );
}

export function FertilizerIntelligence({ query, group, compact = false, filter, onFilterChange }: {
  query: ReturnType<typeof useFertilizerIntelligence>;
  group?: FertilizerGroup;
  compact?: boolean;
  filter?: FertilizerFilter;
  onFilterChange?: (filter: FertilizerFilter) => void;
}) {
  return <View style={{ gap: space.sm }}>
    <AppText variant={group ? "body" : "heading"} bold>{group === "nitrogen" ? "Азотни торове" : group === "phosphate" ? "Фосфорни торове" : compact ? "Международен пазар и България" : "Пазар на торове"}</AppText>
    {!compact ? <AppText variant="caption" tone="muted">AI анализ на международни пазари · не е ценова котировка за България</AppText> : null}
    {filter && onFilterChange ? <View accessibilityRole="tablist" style={styles.filters}>
      {filters.map((option) => <Pressable key={option.key} accessibilityRole="tab"
        accessibilityLabel={option.label} accessibilityState={{ selected: filter === option.key }}
        onPress={() => onFilterChange(option.key)}
        style={({ pressed }) => [styles.filter, filter === option.key && styles.filterSelected, pressed && pressedStyle]}>
        <AppText variant="small" bold style={{ color: filter === option.key ? colors.white : colors.brand[700] }}>{option.label}</AppText>
      </Pressable>)}
    </View> : null}
    <QueryBoundary query={query} stamp={false}>{({ items }) => {
      const activeGroup = group ?? (filter === "all" ? undefined : filter);
      const entries = items.filter((item) => item.source.name === "FertilizerWeek" && isXSource(item.source.url) && hasInsightTranslation(item) &&
        (!activeGroup || item.fertilizerTags?.some((tag) => groups[activeGroup].includes(tag)))).slice(0, compact ? 1 : 5);
      return !entries.length ? <Card><AppText variant="small" tone="muted">
        {activeGroup ? "Няма наличен анализ за тази група торове." : "Няма наличен анализ от FertilizerWeek."}
      </AppText></Card> : <>{entries.map((item) => <FertilizerCard key={item.id} item={item} compact={compact} />)}</>;
    }}</QueryBoundary>
  </View>;
}

export function FertilizerMarketOverview() {
  const main = useFertilizerIntelligence();
  const nitrogen = useFertilizerIntelligence("nitrogen");
  const phosphate = useFertilizerIntelligence("phosphate");
  return <View style={{ gap: space.md }}>
    <FertilizerIntelligence query={main} compact />
    <FertilizerIntelligence query={nitrogen} group="nitrogen" compact />
    <FertilizerIntelligence query={phosphate} group="phosphate" compact />
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  meta: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: space.xs },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  tag: { backgroundColor: colors.brand[50], borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.xs },
  impact: { backgroundColor: colors.soft, borderRadius: radius.md, padding: space.md, gap: space.xs },
  chart: { width: "100%", aspectRatio: 1.65 },
  primaryAction: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, backgroundColor: colors.brand[700], borderRadius: radius.md, paddingHorizontal: space.md },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  filter: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand[100], backgroundColor: colors.surface },
  filterSelected: { backgroundColor: colors.brand[700], borderColor: colors.brand[700] },
});
