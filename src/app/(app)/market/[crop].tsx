import { useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";

import { isApiError } from "@/api/client";
import { useCrop, useMe, useSetFavorite } from "@/api/queries";
import { colors, space } from "@/theme/tokens";
import { showDialog } from "@/ui/Dialog";
import { CropValueCalculator } from "@/ui/CropValueCalculator";
import { Icon } from "@/ui/Icon";
import { PriceRow } from "@/ui/PriceRow";
import { PortPriceQuotes } from "@/ui/PortPriceQuotes";
import { Card, RowList, SectionHeader, pressedStyle } from "@/ui/primitives";
import { ErrorState, QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

export default function CropScreen() {
  const { crop: slug } = useLocalSearchParams<{ crop: string }>();
  const crop = useCrop(slug);
  const me = useMe();
  const setFavorite = useSetFavorite();
  const favorite = me.data?.favoriteCrops?.includes(slug) ?? false;

  function toggleFavorite() {
    setFavorite.mutate({ cropSlug: slug, favorite: !favorite }, {
      onError: (error) => showDialog({
        title: "Не успяхме да запазим любимите",
        message: isApiError(error) ? error.message : "Опитай отново.",
        tone: "danger", icon: "alert-circle-outline",
      }),
    });
  }

  return (
    <Screen back="/market" title={crop.data?.crop.name ?? "Култура"} keyboard
      onRefresh={() => void crop.refetch()} refreshing={crop.isRefetching}>
      {isApiError(crop.error) && crop.error.code === "not_found" ? (
        <ErrorState icon="search-outline" title="Не е намерена" message="Няма публикувана пристанищна оферта за тази култура." />
      ) : (
        <QueryBoundary query={crop}>
          {(data) => (
            <>
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                  <AppText variant="title" style={{ flex: 1 }}>{data.crop.emoji} {data.crop.name}</AppText>
                  <Pressable accessibilityRole="button"
                    accessibilityLabel={favorite ? "Премахни от любими" : "Добави в любими"}
                    accessibilityState={{ selected: favorite, busy: setFavorite.isPending }}
                    disabled={setFavorite.isPending || !me.data} hitSlop={10} onPress={toggleFavorite}
                    style={({ pressed }) => [{ padding: 4 }, pressed && pressedStyle]}>
                    <Icon name={favorite ? "star" : "star-outline"} size={24} color={favorite ? colors.warn : colors.muted} />
                  </Pressable>
                </View>
                <View style={{ marginTop: space.lg }}><PortPriceQuotes price={data.crop} dates /></View>
              </Card>
              <CropValueCalculator key={data.crop.slug} price={data.crop} />
              {data.related.length ? (
                <View>
                  <SectionHeader title="Други в категорията" action="Целият пазар" href="/market" />
                  <RowList>
                    {data.related.map((row) => <PriceRow key={row.slug} price={row} showChange={false} fullUnit />)}
                  </RowList>
                </View>
              ) : null}
            </>
          )}
        </QueryBoundary>
      )}
    </Screen>
  );
}
