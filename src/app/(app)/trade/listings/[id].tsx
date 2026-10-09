import { useLocalSearchParams } from "expo-router";
import { Linking, View } from "react-native";

import { isApiError } from "@/api/client";
import { useListing, useRegions } from "@/api/queries";
import { formatNumber, formatShortDate } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { colors, space } from "@/theme/tokens";
import { DetailList, DetailRow } from "@/ui/DetailRow";
import { Button } from "@/ui/forms";
import { Card, Pill, SampleSpecs } from "@/ui/primitives";
import { ErrorState, QueryBoundary } from "@/ui/QueryBoundary";
import { SaveButton } from "@/ui/SaveButton";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

const STATUS_LABELS = { OPEN: "Активна", RESERVED: "Запазена", CLOSED: "Приключена" } as const;

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = useListing(id);
  const regions = useRegions();

  // A farmer cannot open another farmer's listing. The server answers 404 for
  // that, the same as an unknown id, so ids cannot be probed.
  const notFound = isApiError(listing.error) && listing.error.code === "not_found";
  const locked = isApiError(listing.error) && listing.error.code === "trade_access";

  return (
    <Screen
      back="/trade"
      title="Обява"
      onRefresh={() => void listing.refetch()}
      refreshing={listing.isRefetching}
    >
      {notFound ? (
        <ErrorState icon="search-outline" title="Не е намерена" message="Тази обява не е налична." />
      ) : locked ? (
        <ErrorState
          icon="lock-closed-outline"
          title="Борсата не е включена"
          message="Този раздел не е включен в плана ти."
        />
      ) : (
        <QueryBoundary query={listing}>
          {(data) => {
            const regionName =
              regions.data?.regions.find((region) => region.slug === data.regionSlug)?.name ??
              data.regionSlug;
            return (
              <>
                <Card style={{ gap: space.md }}>
                  <AppText variant="title" style={{ fontSize: 21 }} accessibilityRole="header">
                    {data.title}
                  </AppText>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pill tone={data.status === "OPEN" ? "brand" : "neutral"}>
                      {STATUS_LABELS[data.status]}
                    </Pill>
                  </View>
                  <AppText variant="hero" numeric style={{ color: colors.brand[700] }}>
                    {formatNumber(data.quantityT)}{" "}
                    <AppText variant="small" tone="muted" bold>
                      т
                    </AppText>
                  </AppText>
                  <SampleSpecs
                    hectolitre={data.hectolitre}
                    protein={data.protein}
                    gluten={data.gluten}
                  />
                  {data.note ? (
                    <AppText variant="small" tone="muted">
                      {data.note}
                    </AppText>
                  ) : null}
                </Card>

                <DetailList>
                  {data.askPrice ? (
                    <DetailRow
                      icon="pricetag"
                      label="Желана цена"
                      value={`${formatNumber(data.askPrice, 2)} ${data.unit}`}
                    />
                  ) : null}
                  <DetailRow icon="location" label="Регион" value={regionName} />
                  <DetailRow icon="time" label="Публикувана" value={formatShortDate(new Date(data.createdAt))} />
                  <DetailRow icon="person" label="Продавач" value={data.farmer.name} />
                  {data.farmer.farmName ? (
                    <DetailRow icon="business" label="Стопанство" value={data.farmer.farmName} />
                  ) : null}
                </DetailList>

                {!data.isOwner && data.isSaved !== undefined ? (
                  <SaveButton kind="LISTING" id={data.id} saved={data.isSaved} />
                ) : null}

                {data.farmer.phone ? (
                  <Button
                    title={`Обади се · ${data.farmer.phone}`}
                    icon="call"
                    onPress={() => void Linking.openURL(telHref(data.farmer.phone!))}
                  />
                ) : (
                  <AppText variant="small" tone="muted" align="center">
                    Продавачът не е посочил телефон.
                  </AppText>
                )}
              </>
            );
          }}
        </QueryBoundary>
      )}
    </Screen>
  );
}
