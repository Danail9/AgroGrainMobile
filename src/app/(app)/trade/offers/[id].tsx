import { useLocalSearchParams } from "expo-router";
import { Linking, View } from "react-native";

import { isApiError } from "@/api/client";
import { useOffer, useRegions } from "@/api/queries";
import { formatNumber, formatShortDate } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { colors, space } from "@/theme/tokens";
import { DetailList, DetailRow } from "@/ui/DetailRow";
import { Button } from "@/ui/forms";
import { Card, Pill } from "@/ui/primitives";
import { ErrorState, QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

const CATEGORY_LABELS = { CROP: "Култури", FERTILIZER: "Торове", SEED: "Семена" } as const;

export default function OfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const offer = useOffer(id);
  const regions = useRegions();

  const notFound = isApiError(offer.error) && offer.error.code === "not_found";
  const locked = isApiError(offer.error) && offer.error.code === "trade_access";

  return (
    <Screen back="/trade" title="Оферта" onRefresh={() => void offer.refetch()} refreshing={offer.isRefetching}>
      {notFound ? (
        <ErrorState icon="search-outline" title="Не е намерена" message="Тази оферта вече не е налична." />
      ) : locked ? (
        <ErrorState
          icon="lock-closed-outline"
          title="Борсата не е включена"
          message="Този раздел не е включен в плана ти."
        />
      ) : (
        <QueryBoundary query={offer}>
          {(data) => (
            <>
              <Card style={{ gap: space.md }}>
                <AppText variant="title" style={{ fontSize: 21 }} accessibilityRole="header">
                  {data.title}
                </AppText>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Pill tone="brand">{CATEGORY_LABELS[data.category]}</Pill>
                  {!data.isActive ? <Pill tone="danger">Неактивна</Pill> : null}
                </View>
                <AppText variant="hero" numeric style={{ color: colors.brand[700] }}>
                  {formatNumber(data.price, 2)}{" "}
                  <AppText variant="small" tone="muted" bold>
                    {data.unit}
                  </AppText>
                </AppText>
                {data.note ? (
                  <AppText variant="small" tone="muted">
                    {data.note}
                  </AppText>
                ) : null}
              </Card>

              <DetailList>
                <DetailRow icon="person" label="Търговец" value={data.trader.name} />
                {data.trader.farmName ? (
                  <DetailRow icon="business" label="Фирма" value={data.trader.farmName} />
                ) : null}
                {data.regionSlug ? (
                  <DetailRow
                    icon="location"
                    label="Регион"
                    value={
                      regions.data?.regions.find((region) => region.slug === data.regionSlug)?.name ??
                      data.regionSlug
                    }
                  />
                ) : null}
                {data.validUntil ? (
                  <DetailRow
                    icon="calendar"
                    label="Валидна до"
                    value={formatShortDate(new Date(data.validUntil))}
                  />
                ) : null}
                <DetailRow icon="time" label="Публикувана" value={formatShortDate(new Date(data.createdAt))} />
              </DetailList>

              {data.trader.phone ? (
                <Button
                  title={`Обади се · ${data.trader.phone}`}
                  icon="call"
                  onPress={() => void Linking.openURL(telHref(data.trader.phone!))}
                />
              ) : (
                <AppText variant="small" tone="muted" align="center">
                  Търговецът не е посочил телефон.
                </AppText>
              )}
            </>
          )}
        </QueryBoundary>
      )}
    </Screen>
  );
}
