import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Switch, View } from "react-native";

import { isApiError } from "@/api/client";
import { type HistoryDays, useCrop, useCropInsight, useMe, useSetFavorite } from "@/api/queries";
import { canCompare, yearOverYear } from "@/lib/chart";
import { formatNumber } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { showDialog } from "@/ui/Dialog";
import { PriceAlerts } from "@/ui/PriceAlerts";
import { PriceChart } from "@/ui/PriceChart";
import { PriceRow } from "@/ui/PriceRow";
import {
  Card,
  ChangeBadge,
  Divider,
  IconTile,
  RowList,
  SectionHeader,
  pressedStyle,
} from "@/ui/primitives";
import { ErrorState, QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

const RANGES: { days: HistoryDays; label: string; caption: string }[] = [
  { days: 30, label: "30 дни", caption: "Последните 30 дни" },
  { days: 90, label: "90 дни", caption: "Последните 3 месеца" },
  { days: 365, label: "1 година", caption: "Последната година" },
];

export default function CropScreen() {
  const { crop: slug } = useLocalSearchParams<{ crop: string }>();
  const [days, setDays] = useState<HistoryDays>(30);
  const [compare, setCompare] = useState(false);
  const crop = useCrop(slug, days);
  const me = useMe();
  const setFavorite = useSetFavorite();
  const favorite = me.data?.favoriteCrops?.includes(slug) ?? false;
  const range = RANGES.find((item) => item.days === days) ?? RANGES[0];

  function toggleFavorite() {
    setFavorite.mutate(
      { cropSlug: slug, favorite: !favorite },
      {
        onError: (e) =>
          showDialog({
            title: "Не успяхме да запазим любимите",
            message: isApiError(e) ? e.message : "Опитай отново.",
            tone: "danger",
            icon: "alert-circle-outline",
          }),
      },
    );
  }

  return (
    <Screen
      back="/market"
      title={crop.data?.crop.name ?? "Култура"}
      onRefresh={() => void crop.refetch()}
      refreshing={crop.isRefetching}
    >
      {isApiError(crop.error) && crop.error.code === "not_found" ? (
        <ErrorState
          icon="search-outline"
          title="Не е намерена"
          message="Тази култура вече не се търгува или адресът е грешен."
        />
      ) : (
        <QueryBoundary query={crop}>
          {(data) => {
            const showChange = data.related.some((price) => price.changePct !== null);
            const yoy = data.previousYear ? yearOverYear(data.history, data.previousYear) : null;
            const comparable = canCompare(data.history, data.previousYear);
            const comparing = compare && comparable;
            return (
              <>
                <Card>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                    <AppText style={{ fontSize: 30 }}>{data.crop.emoji}</AppText>
                    <View style={{ flex: 1 }}>
                      <AppText variant="small" tone="muted">
                        Национална средна цена
                      </AppText>
                      <AppText variant="title" numeric>
                        {formatNumber(data.crop.price)} {data.crop.unit}
                      </AppText>
                    </View>
                    <ChangeBadge value={data.crop.changePct} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={favorite ? "Премахни от любими" : "Добави в любими"}
                      accessibilityState={{ selected: favorite, busy: setFavorite.isPending }}
                      disabled={setFavorite.isPending || !me.data}
                      hitSlop={10}
                      onPress={toggleFavorite}
                      style={({ pressed }) => [{ padding: 4 }, pressed && pressedStyle]}
                    >
                      <Icon
                        name={favorite ? "star" : "star-outline"}
                        size={24}
                        color={favorite ? colors.warn : colors.muted}
                      />
                    </Pressable>
                  </View>
                  {favorite ? (
                    <AppText variant="caption" tone="muted" style={{ marginTop: 8 }}>
                      Любима култура — показва се първа и алармите за промяна в цените следят само любимите.
                    </AppText>
                  ) : null}
                  {data.crop.overridden ? (
                    <AppText variant="caption" tone="muted" style={{ marginTop: 8 }}>
                      Цената е ръчно коригирана от администратор.
                    </AppText>
                  ) : null}
                </Card>

                <Card padded={false}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      padding: space.lg,
                      paddingBottom: space.md,
                    }}
                  >
                    <AppText variant="small" bold>
                      Движение на цената
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {range.caption}
                    </AppText>
                  </View>
                  <View
                    accessibilityRole="tablist"
                    style={{ flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md }}
                  >
                    {RANGES.map((item) => {
                      const selected = item.days === days;
                      return (
                        <Pressable
                          key={item.days}
                          accessibilityRole="tab"
                          accessibilityState={{ selected }}
                          onPress={() => setDays(item.days)}
                          style={({ pressed }) => [
                            {
                              flex: 1,
                              alignItems: "center",
                              paddingVertical: 8,
                              borderRadius: radius.md,
                              backgroundColor: selected ? colors.brand[600] : colors.soft,
                            },
                            pressed && pressedStyle,
                          ]}
                        >
                          <AppText variant="caption" bold style={{ color: selected ? colors.white : colors.muted }}>
                            {item.label}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Divider />
                  <View style={{ paddingTop: space.md, opacity: crop.isPlaceholderData ? 0.5 : 1 }}>
                    <PriceChart
                      points={data.history}
                      unit={data.crop.unit}
                      compare={comparing ? data.previousYear ?? [] : undefined}
                    />
                  </View>
                  <Divider />
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space.md,
                      paddingHorizontal: space.lg,
                      paddingVertical: space.md,
                    }}
                  >
                    <View style={{ flex: 1, opacity: comparable ? 1 : 0.6 }}>
                      <AppText variant="small" bold tone={comparable ? "ink" : "muted"}>
                        Сравни с миналата година
                      </AppText>
                      <AppText variant="caption" tone="muted">
                        {!comparable
                          ? "Недостъпно — няма цени от миналата година за този период."
                          : yoy === null
                            ? "Линията показва цените от същия период миналата година."
                            : `Спрямо същия ден миналата година: ${yoy > 0 ? "+" : ""}${formatNumber(yoy, 1)}%`}
                      </AppText>
                    </View>
                    {comparable ? null : <Icon name="lock-closed" size={16} color={colors.muted} />}
                    <Switch
                      accessibilityLabel="Сравни с миналата година"
                      accessibilityState={{ disabled: !comparable }}
                      disabled={!comparable}
                      value={comparing}
                      onValueChange={setCompare}
                      trackColor={{ true: colors.brand[500], false: colors.line }}
                      thumbColor={colors.white}
                    />
                  </View>
                </Card>

                {me.data?.subscription.active ? (
                  <PriceAlerts slug={slug} price={data.crop.price} unit={data.crop.unit} />
                ) : null}

                <Analysis slug={slug} headline={data.analysis.headline} />

                {data.related.length ? (
                  <View>
                    <SectionHeader title="Други в категорията" action="Целият пазар" href="/market" />
                    <RowList>
                      {data.related.map((price, index) => (
                        <View key={price.slug}>
                          {index > 0 ? <Divider /> : null}
                          <PriceRow price={price} showChange={showChange} compact fullUnit />
                        </View>
                      ))}
                    </RowList>
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/ai/market")}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space.md,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: colors.brand[100],
                      backgroundColor: colors.brand[50],
                      padding: space.lg,
                    },
                    pressed && pressedStyle,
                  ]}
                >
                  <Icon name="stats-chart" size={26} color={colors.brand[600]} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" bold>
                      AI пазарен анализ
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      Кратък пазарен обзор за всички култури.
                    </AppText>
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              </>
            );
          }}
        </QueryBoundary>
      )}
    </Screen>
  );
}

/**
 * The rule-based headline is instant; the model-written bullets arrive on
 * their own request so a slow or failing AI never holds the price screen back.
 */
function Analysis({ slug, headline }: { slug: string; headline: string }) {
  const insight = useCropInsight(slug);
  const bullets = (insight.data?.content ?? "")
    .split("\n")
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);

  return (
    <Card style={{ backgroundColor: colors.brand[50], borderColor: colors.brand[100], gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
        <IconTile tone="solid" size="md">
          <Icon name="sparkles" size={20} color={colors.white} />
        </IconTile>
        <View style={{ flex: 1 }}>
          <AppText variant="body" bold style={{ color: colors.brand[800] }}>
            AgroGrain AI анализ
          </AppText>
          <AppText variant="caption" style={{ color: colors.brand[700], marginTop: 2 }}>
            {headline}
          </AppText>
        </View>
      </View>

      {insight.isPending && insight.fetchStatus !== "paused" ? (
        <View style={{ paddingVertical: space.sm }}>
          <ActivityIndicator color={colors.brand[600]} />
        </View>
      ) : (
        bullets.map((bullet) => (
          <View
            key={bullet}
            style={{
              flexDirection: "row",
              gap: 10,
              backgroundColor: colors.white,
              borderRadius: radius.md,
              padding: 12,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                marginTop: 6,
                backgroundColor: colors.brand[500],
              }}
            />
            <AppText variant="caption" style={{ flex: 1, lineHeight: 18, fontSize: 12 }}>
              {bullet}
            </AppText>
          </View>
        ))
      )}

      {insight.data ? (
        <AppText variant="caption" style={{ color: colors.brand[700], opacity: 0.7, fontSize: 10 }}>
          {insight.data.source === "openai"
            ? "Генерирано от AI по записаните цени. Не е инвестиционен съвет."
            : "Изчислено от записаните цени. Не е инвестиционен съвет."}
        </AppText>
      ) : null}
    </Card>
  );
}
