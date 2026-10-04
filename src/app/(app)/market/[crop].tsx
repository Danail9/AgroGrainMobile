import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";

import { isApiError } from "@/api/client";
import { useCrop, useCropInsight } from "@/api/queries";
import { formatNumber } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
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

export default function CropScreen() {
  const { crop: slug } = useLocalSearchParams<{ crop: string }>();
  const crop = useCrop(slug);

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
                  </View>
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
                      Последните 30 дни
                    </AppText>
                  </View>
                  <Divider />
                  <View style={{ paddingTop: space.md }}>
                    <PriceChart points={data.history} unit={data.crop.unit} />
                  </View>
                </Card>

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
