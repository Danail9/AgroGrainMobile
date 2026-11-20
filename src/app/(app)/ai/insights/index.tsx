import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { isApiError } from "@/api/client";
import { useMarketInsights } from "@/api/queries";
import { formatShortDate } from "@/lib/format";
import { hasInsightTranslation, insightSourceName, isXSource } from "@/lib/market-insights";
import { colors, space } from "@/theme/tokens";
import { Button, TextField } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { InsightSourceStatus } from "@/ui/InsightSourceStatus";
import { Card, pressedStyle } from "@/ui/primitives";
import { ErrorState, QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

const POSTS_PER_PAGE = 5;
const API_PAGE_SIZE = 20;
const PAGES_PER_BATCH = API_PAGE_SIZE / POSTS_PER_PAGE;

export default function MarketInsightsScreen() {
  const { platform } = useLocalSearchParams<{ platform?: string }>();
  const xOnly = platform === "X";
  const [crop, setCrop] = useState("");
  const [source, setSource] = useState("");
  const [filters, setFilters] = useState({ crop: "", source: "" });
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const apiPage = Math.ceil(page / PAGES_PER_BATCH);
  const offset = ((page - 1) % PAGES_PER_BATCH) * POSTS_PER_PAGE;
  const params = new URLSearchParams({ page: String(apiPage), pageSize: String(API_PAGE_SIZE), includeFilters: "true", ...filters });
  if (xOnly) {
    params.set("platform", "X");
    if (!filters.source) params.set("authorMix", "balanced");
  }
  const query = useMarketInsights(params.toString());
  const visibleItems = query.data?.items.filter((item) =>
    hasInsightTranslation(item) && (!xOnly || isXSource(item.source.url))) ?? [];
  const cropOptions = query.data?.filterOptions?.crops ?? visibleItems.flatMap((item) => item.crops);
  const sourceOptions = query.data?.filterOptions?.sources ?? visibleItems.map((item) => item.source.name);
  const pageItems = query.data?.items.slice(offset, offset + POSTS_PER_PAGE)
    .filter((item) => hasInsightTranslation(item) && (!xOnly || isXSource(item.source.url))) ?? [];
  const hasNextPage = !!query.data && (offset + POSTS_PER_PAGE < query.data.items.length ||
    (apiPage < 500 && query.data.hasMore));

  function applyFilters() {
    setPage(1);
    setFilters({ crop, source });
    setFiltersOpen(false);
  }

  function clearFilters() {
    setCrop("");
    setSource("");
    setFilters({ crop: "", source: "" });
    setPage(1);
  }

  const activeFilters = [filters.crop, insightSourceName(filters.source)].filter(Boolean);
  const pagination = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      <View style={{ flex: 1 }}>
        <Button title="Предишна" icon="chevron-back" variant="secondary" compact
          disabled={page === 1 || query.isFetching} onPress={() => setPage((value) => value - 1)} />
      </View>
      <AppText variant="caption" bold accessibilityLiveRegion="polite">Страница {page}</AppText>
      <View style={{ flex: 1 }}>
        <Button title="Следваща" icon="chevron-forward" variant="secondary" compact
          disabled={!hasNextPage || query.isFetching} onPress={() => setPage((value) => value + 1)} />
      </View>
    </View>
  );

  return (
    <Screen key={`${page}:${JSON.stringify(filters)}`} title={xOnly ? "Публикации от X" : "Пазарни анализи"} subtitle="Източници и AI интерпретация" back={xOnly ? "/news" : "/ai"}
      keyboard
      onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <AppText bold>Последни публикации</AppText>
            <AppText variant="caption" tone="muted">5 публикации на страница</AppText>
          </View>
          <Button title={activeFilters.length ? `Филтри (${activeFilters.length})` : "Филтри"}
            icon={filtersOpen ? "chevron-up" : "options-outline"} variant="secondary" compact
            onPress={() => setFiltersOpen((value) => !value)} />
        </View>
        {activeFilters.length > 0 ? (
          <View style={{ gap: space.xs }}>
            <AppText variant="caption" tone="brand">{activeFilters.join(" · ")}</AppText>
            <Button title="Изчисти филтрите" variant="ghost" compact onPress={clearFilters} />
          </View>
        ) : null}
      </View>
      <Button title="Известия за автори" icon="notifications-outline" variant="ghost" compact
        onPress={() => router.push({ pathname: "/settings", params: { section: "notifications" } })} />
      {filtersOpen ? <Card style={{ gap: space.lg }}>
        <AppText bold>Филтрирай публикациите</AppText>
        <InsightFilter label="Култура" allLabel="Всички култури" options={cropOptions} value={crop} onChange={setCrop} />
        <InsightFilter label="Автор" allLabel="Всички автори" options={sourceOptions} value={source} onChange={setSource}
          formatLabel={insightSourceName} />
        {!query.data?.filterOptions ? (
          <AppText variant="caption" tone="muted">Показани са изборите от текущата страница. Всички избори изискват обновен API.</AppText>
        ) : null}
        <Button title="Приложи филтрите" compact onPress={applyFilters} />
      </Card> : null}
      {query.isError ? <ErrorState message={isApiError(query.error) ? query.error.message : "Не успяхме да заредим анализите."}
        onRetry={() => void query.refetch()} /> : <QueryBoundary query={query} stamp={false}>{(data) => (
        <View style={{ gap: space.md }}>
          {pagination}
          {pageItems.length === 0 ? (
            <Card><AppText tone="muted">Няма публикувани анализи за избраните филтри.</AppText></Card>
          ) : pageItems.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Отвори анализ: ${item.headline}`}
              onPress={() => router.push({ pathname: "/ai/insights/[id]", params: { id: item.id } })}
              style={({ pressed }) => pressed && pressedStyle}>
              <Card style={{ gap: space.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand[50],
                    alignItems: "center", justifyContent: "center" }}>
                    <Icon name="trending-up-outline" size={18} color={colors.brand[700]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="caption" tone="brand" bold>{insightSourceName(item.source.name)}</AppText>
                    <AppText variant="caption" tone="muted">{formatShortDate(new Date(item.source.publishedAt))}</AppText>
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.muted} />
                </View>
                <AppText variant="body" bold>{item.headline}</AppText>
                <AppText variant="small" tone="muted" numberOfLines={3}>{item.summary}</AppText>
                <InsightSourceStatus source={item.source} />
                <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm,
                  flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <Icon name={item.verification === "VERIFIED" ? "checkmark-circle-outline" : "information-circle-outline"}
                    size={16} color={colors.brand[700]} />
                  <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                    {item.verification === "VERIFIED" ? "Проверен анализ" : "AI обобщение · непроверени твърдения"}
                  </AppText>
                </View>
              </Card>
            </Pressable>
          ))}
          {data.items.length > 0 ? pagination : null}
        </View>
      )}</QueryBoundary>}
    </Screen>
  );
}

function InsightFilter({ label, allLabel, options, value, onChange, formatLabel = (option) => option }: {
  label: string; allLabel: string; options: string[]; value: string; onChange: (value: string) => void;
  formatLabel?: (option: string) => string;
}) {
  const [search, setSearch] = useState("");
  const choices = [...new Set([...options, ...(value ? [value] : [])])]
    .sort((a, b) => formatLabel(a).localeCompare(formatLabel(b), "bg"));
  const matches = choices.filter((option) => [option, formatLabel(option)]
    .some((label) => label.toLocaleLowerCase("bg").includes(search.trim().toLocaleLowerCase("bg"))));
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="caption" bold tone="muted">{label}</AppText>
      {choices.length > 8 ? <TextField label={`Търси ${label.toLocaleLowerCase("bg")}`}
        placeholder="Търсене…" value={search} onChangeText={setSearch} maxLength={80} icon="search" /> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Button title={allLabel} compact selected={!value} variant={!value ? "primary" : "secondary"}
          onPress={() => onChange("")} />
        {matches.map((option) => (
          <Button key={option} title={formatLabel(option)} compact selected={value === option}
            variant={value === option ? "primary" : "secondary"} onPress={() => onChange(option)} />
        ))}
      </View>
      {search && matches.length === 0 ? <AppText variant="caption" tone="muted">Няма съвпадащи етикети.</AppText> : null}
    </View>
  );
}
