import { router } from "expo-router";
import { Alert, Linking, Pressable, View } from "react-native";

import { isApiError } from "@/api/client";
import {
  useDeleteListing,
  useDeleteOffer,
  useMe,
  useSetListingStatus,
  useToggleOffer,
  useTrade,
} from "@/api/queries";
import type { z } from "zod";

import type { farmerListingSchema, traderOfferSchema } from "@/api/schemas";
import { formatNumber, formatShortDate } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { colors, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import {
  Card,
  Divider,
  EmptyState,
  Pill,
  RowList,
  SampleSpecs,
  pressedStyle,
} from "@/ui/primitives";
import { ErrorState, QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { Tabs } from "@/ui/Tabs";
import { AppText } from "@/ui/Text";
import { ListingForm, OfferForm } from "@/ui/TradeForms";

type Offer = z.infer<typeof traderOfferSchema>;
type Listing = z.infer<typeof farmerListingSchema>;

const CATEGORY_LABELS = { CROP: "Култури", FERTILIZER: "Торове", SEED: "Семена" } as const;
const LISTING_LABELS = { OPEN: "Активна", RESERVED: "Запазена", CLOSED: "Приключена" } as const;

export default function TradeScreen() {
  const trade = useTrade();
  const me = useMe();

  // The plan is active but does not include the exchange. Text only: this is a
  // reader app, so there is no price, plan comparison or way to buy here.
  const locked = isApiError(trade.error) && trade.error.code === "trade_access";

  return (
    <Screen
      tabbed
      title="Борса"
      subtitle={me.data ? me.data.user.regionName : undefined}
      onRefresh={() => void trade.refetch()}
      refreshing={trade.isRefetching}
    >
      {locked ? (
        <ErrorState
          icon="lock-closed-outline"
          title="Борсата не е включена"
          message="Този раздел не е включен в плана ти."
        />
      ) : (
        <QueryBoundary query={trade}>{(data) => <TradeTabs data={data} />}</QueryBoundary>
      )}
    </Screen>
  );
}

function TradeTabs({ data }: { data: NonNullable<ReturnType<typeof useTrade>["data"]> }) {
  const isTrader = data.canPublishOffers;

  return (
    <>
      <Card
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          backgroundColor: colors.brand[50],
          borderColor: colors.brand[100],
        }}
      >
        <Icon name="swap-horizontal" size={22} color={colors.brand[600]} />
        <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
          {isTrader
            ? "Твоите оферти се виждат от всички фермери, а техните обяви показват контакт за връзка."
            : "Обявите ти се виждат само от търговци — те получават твоето стопанство, име и телефон."}
        </AppText>
      </Card>

      <Tabs
        items={[
          {
            key: "offers",
            label: "Оферти",
            content: (
              <View style={{ gap: space.lg }}>
                {isTrader ? (
                  <Card style={{ gap: space.md }}>
                    <AppText variant="small" bold>
                      Нова оферта
                    </AppText>
                    <OfferForm crops={data.cropOptions} fertilizers={data.fertilizerOptions} />
                  </Card>
                ) : null}
                <OffersList offers={data.offers} />
              </View>
            ),
          },
          {
            key: "listings",
            label: "Обяви",
            content: isTrader ? (
              <ListingsForTraders listings={data.listings} />
            ) : (
              <Card style={{ gap: space.md }}>
                <AppText variant="small" bold>
                  Нова обява за продажба
                </AppText>
                <ListingForm crops={data.cropOptions} />
                <AppText variant="caption" tone="muted">
                  Обявата се вижда само от търговци, не и от други фермери.
                </AppText>
              </Card>
            ),
          },
          {
            key: "mine",
            label: "Мои",
            content: isTrader ? (
              <MyOffers offers={data.myOffers} />
            ) : (
              <MyListings listings={data.myListings} />
            ),
          },
        ]}
      />
    </>
  );
}

function OffersList({ offers }: { offers: Offer[] }) {
  return (
    <RowList>
      <AppText variant="small" bold style={{ padding: space.lg }}>
        Оферти от търговци
      </AppText>
      {offers.length ? (
        offers.map((offer) => (
          <View key={offer.id}>
            <Divider />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/trade/offers/${offer.id}`)}
              style={({ pressed }) => [{ padding: space.lg, gap: 6 }, pressed && pressedStyle]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
                <AppText variant="small" bold numberOfLines={1} style={{ flex: 1 }}>
                  {offer.title}
                </AppText>
                <AppText variant="small" bold numeric>
                  {formatNumber(offer.price, 2)} {offer.unit}
                </AppText>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Pill tone="brand">{CATEGORY_LABELS[offer.category]}</Pill>
                <AppText variant="caption" tone="muted">
                  {offer.trader.farmName || offer.trader.name}
                </AppText>
                {offer.validUntil ? (
                  <AppText variant="caption" tone="muted">
                    до {formatShortDate(new Date(offer.validUntil))}
                  </AppText>
                ) : null}
              </View>
              {offer.note ? (
                <AppText variant="caption" tone="muted">
                  {offer.note}
                </AppText>
              ) : null}
            </Pressable>
          </View>
        ))
      ) : (
        <>
          <Divider />
          <AppText variant="small" tone="muted" align="center" style={{ padding: space.xl }}>
            Все още няма публикувани оферти.
          </AppText>
        </>
      )}
    </RowList>
  );
}

function ListingsForTraders({ listings }: { listings: Listing[] }) {
  return (
    <RowList>
      <AppText variant="small" bold style={{ padding: space.lg }}>
        Обяви от фермери
      </AppText>
      {listings.length ? (
        listings.map((listing) => (
          <View key={listing.id}>
            <Divider />
            <View style={{ padding: space.lg, gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Отвори обявата ${listing.title}`}
                onPress={() => router.push(`/trade/listings/${listing.id}`)}
                style={({ pressed }) => [{ gap: 6 }, pressed && pressedStyle]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
                  <AppText variant="small" bold numberOfLines={1} style={{ flex: 1 }}>
                    {listing.title}
                  </AppText>
                  <AppText variant="small" bold numeric>
                    {formatNumber(listing.quantityT)} т
                  </AppText>
                </View>
                <AppText variant="caption" tone="muted">
                  {listing.askPrice
                    ? `желана цена ${formatNumber(listing.askPrice, 2)} ${listing.unit} · `
                    : ""}
                  {formatShortDate(new Date(listing.createdAt))}
                </AppText>
                <SampleSpecs
                  hectolitre={listing.hectolitre}
                  protein={listing.protein}
                  gluten={listing.gluten}
                />
                {listing.note ? (
                  <AppText variant="caption" tone="muted">
                    {listing.note}
                  </AppText>
                ) : null}
              </Pressable>

              {listing.farmer ? (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: colors.soft,
                    borderRadius: radius.md,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <AppText variant="caption" bold>
                    {listing.farmer.farmName || listing.farmer.name}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {listing.farmer.name}
                  </AppText>
                  {listing.farmer.phone ? (
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={`Обади се на ${listing.farmer.phone}`}
                      onPress={() => void Linking.openURL(telHref(listing.farmer!.phone!))}
                      hitSlop={8}
                    >
                      <AppText variant="caption" tone="brand" bold>
                        {listing.farmer.phone}
                      </AppText>
                    </Pressable>
                  ) : (
                    <AppText variant="caption" tone="muted">
                      Няма телефон
                    </AppText>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        ))
      ) : (
        <>
          <Divider />
          <AppText variant="small" tone="muted" align="center" style={{ padding: space.xl }}>
            Все още няма активни обяви.
          </AppText>
        </>
      )}
    </RowList>
  );
}

/** Asks first: deleting a published offer or listing cannot be undone. */
function confirmDelete(what: string, onConfirm: () => void) {
  Alert.alert(`Да изтрия ли ${what}?`, "Това действие не може да бъде отменено.", [
    { text: "Отказ", style: "cancel" },
    { text: "Изтрий", style: "destructive", onPress: onConfirm },
  ]);
}

function MyOffers({ offers }: { offers: Offer[] }) {
  const toggle = useToggleOffer();
  const remove = useDeleteOffer();

  if (!offers.length) {
    return <EmptyState title="Моите оферти" description="Нямаш публикувани оферти." />;
  }

  return (
    <RowList>
      <AppText variant="small" bold style={{ padding: space.lg }}>
        Моите оферти
      </AppText>
      {offers.map((offer) => (
        <View key={offer.id}>
          <Divider />
          <View style={{ padding: space.lg, gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
              <AppText variant="small" numberOfLines={1} style={{ flex: 1, fontWeight: "500" }}>
                {offer.title}
              </AppText>
              <AppText variant="small" bold numeric>
                {formatNumber(offer.price, 2)} {offer.unit}
              </AppText>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pill tone={offer.isActive ? "brand" : "neutral"}>
                {offer.isActive ? "Активна" : "Скрита"}
              </Pill>
              <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                {formatShortDate(new Date(offer.createdAt))}
              </AppText>
              <Button
                compact
                variant="secondary"
                title={offer.isActive ? "Деактивирай" : "Активирай"}
                loading={toggle.isPending && toggle.variables?.id === offer.id}
                onPress={() => toggle.mutate({ id: offer.id, isActive: !offer.isActive })}
              />
              <Button
                compact
                variant="danger"
                title="Изтрий"
                disabled={remove.isPending}
                onPress={() => confirmDelete("офертата", () => remove.mutate(offer.id))}
              />
            </View>
          </View>
        </View>
      ))}
    </RowList>
  );
}

function MyListings({ listings }: { listings: Listing[] }) {
  const setStatus = useSetListingStatus();
  const remove = useDeleteListing();

  if (!listings.length) {
    return <EmptyState title="Моите обяви" description="Нямаш публикувани обяви." />;
  }

  return (
    <RowList>
      <AppText variant="small" bold style={{ padding: space.lg }}>
        Моите обяви
      </AppText>
      {listings.map((listing) => (
        <View key={listing.id}>
          <Divider />
          <View style={{ padding: space.lg, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
              <AppText variant="small" numberOfLines={1} style={{ flex: 1, fontWeight: "500" }}>
                {listing.title}
              </AppText>
              <AppText variant="small" bold numeric>
                {formatNumber(listing.quantityT)} т
              </AppText>
            </View>
            <SampleSpecs
              hectolitre={listing.hectolitre}
              protein={listing.protein}
              gluten={listing.gluten}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pill tone={listing.status === "OPEN" ? "brand" : "neutral"}>
                {LISTING_LABELS[listing.status]}
              </Pill>
              <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                {formatShortDate(new Date(listing.createdAt))}
              </AppText>
              <Button
                compact
                variant="secondary"
                title={listing.status === "OPEN" ? "Приключи" : "Активирай"}
                loading={setStatus.isPending && setStatus.variables?.id === listing.id}
                onPress={() =>
                  setStatus.mutate({
                    id: listing.id,
                    status: listing.status === "OPEN" ? "CLOSED" : "OPEN",
                  })
                }
              />
              <Button
                compact
                variant="danger"
                title="Изтрий"
                disabled={remove.isPending}
                onPress={() => confirmDelete("обявата", () => remove.mutate(listing.id))}
              />
            </View>
          </View>
        </View>
      ))}
    </RowList>
  );
}
