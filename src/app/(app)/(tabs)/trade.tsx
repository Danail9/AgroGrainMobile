import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";

import { isApiError } from "@/api/client";
import {
  useDeleteListing,
  useDeleteOffer,
  useMarket,
  useMe,
  useSavedItems,
  useSetListingStatus,
  useToggleOffer,
  useToggleSaved,
  useTrade,
} from "@/api/queries";
import type { z } from "zod";

import type { PriceRow, farmerListingSchema, traderOfferSchema } from "@/api/schemas";
import { formatNumber, formatShortDate, updatedAgo } from "@/lib/format";
import { telHref } from "@/lib/phone";
import {
  type Expiry,
  type OfferFilter,
  expiryOf,
  filterOffers,
  findMarketRow,
  formatPrice,
  groupByDay,
  marketDelta,
} from "@/lib/trade";
import { colors, radius, space } from "@/theme/tokens";
import { showDialog } from "@/ui/Dialog";
import { DismissibleHint } from "@/ui/DismissibleHint";
import { Button } from "@/ui/forms";
import { Icon, type IconName } from "@/ui/Icon";
import {
  Card,
  Divider,
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

  // The plan is active but does not include the exchange: offer the plans.
  const locked = isApiError(trade.error) && trade.error.code === "trade_access";
  const region = me.data?.user.regionName;
  const updated = trade.dataUpdatedAt ? updatedAgo(trade.dataUpdatedAt) : null;

  return (
    <Screen
      tabbed
      back="/"
      title="Борса"
      subtitle={[region, updated].filter(Boolean).join(" · ") || undefined}
      onRefresh={() => void trade.refetch()}
      refreshing={trade.isRefetching}
    >
      {locked ? (
        <ErrorState
          icon="lock-closed-outline"
          title="Борсата не е включена"
          message="Този раздел не е включен в плана ти."
          retryLabel="Планове"
          onRetry={() => router.push("/subscription")}
        />
      ) : (
        <QueryBoundary query={trade} stamp={false}>
          {(data) => <TradeTabs data={data} now={trade.dataUpdatedAt} />}
        </QueryBoundary>
      )}
    </Screen>
  );
}

type TradeData = NonNullable<ReturnType<typeof useTrade>["data"]>;

/** What the offer and listing rows need besides the item itself. */
type RowContext = {
  now: number;
  prices: PriceRow[] | undefined;
  emojiOf: (title: string, category?: Offer["category"]) => string;
  saved: Set<string>;
  toggleSaved: ReturnType<typeof useToggleSaved>;
};

function TradeTabs({ data, now }: { data: TradeData; now: number }) {
  const isTrader = data.canPublishOffers;
  // `/trade?tab=mine` opens a tab directly, e.g. from the home stats.
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const market = useMarket();
  const me = useMe();
  const saved = useSavedItems();
  const toggleSaved = useToggleSaved();

  const savedIds = new Set((saved.data?.items ?? []).map((item) => `${item.kind}:${item.id}`));
  // Show the requested state while the save is on its way.
  if (toggleSaved.isPending && toggleSaved.variables) {
    const key = `${toggleSaved.variables.kind}:${toggleSaved.variables.id}`;
    if (toggleSaved.variables.saved) savedIds.add(key);
    else savedIds.delete(key);
  }

  const emojis = new Map(
    [...data.cropOptions, ...data.fertilizerOptions, ...(market.data?.prices ?? [])].flatMap((option) =>
      option.emoji ? [[option.name.trim().toLocaleLowerCase("bg"), option.emoji] as const] : [],
    ),
  );
  const ctx: RowContext = {
    now,
    prices: market.data?.prices,
    emojiOf: (title, category) =>
      emojis.get(title.trim().toLocaleLowerCase("bg")) ?? (category ? CATEGORY_EMOJI[category] : "🌾"),
    saved: savedIds,
    toggleSaved,
  };

  const favoriteNames = (market.data?.prices ?? [])
    .filter((row) => me.data?.favoriteCrops?.includes(row.slug))
    .map((row) => row.name);
  const myOfferIds = new Set(data.myOffers.map((offer) => offer.id));

  return (
    <>
      <DismissibleHint id={isTrader ? "trade-trader" : "trade-farmer"} icon="swap-horizontal">
        {isTrader
          ? "Твоите оферти се виждат от всички фермери, а техните обяви показват контакт за връзка."
          : "Обявите ти се виждат само от търговци — те получават твоето стопанство, име и телефон."}
      </DismissibleHint>

      <Tabs
        key={tab}
        initial={tab}
        variant="segmented"
        items={[
          {
            key: "offers",
            label: "Оферти",
            count: data.offers.length,
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
                <OffersList
                  offers={data.offers}
                  ctx={ctx}
                  favoriteNames={favoriteNames}
                  ownIds={myOfferIds}
                />
              </View>
            ),
          },
          {
            key: "listings",
            label: "Обяви",
            count: isTrader ? data.listings.length : undefined,
            content: isTrader ? (
              <ListingsForTraders listings={data.listings} ctx={ctx} />
            ) : (
              <View style={{ gap: space.md }}>
                <View style={{ gap: 4 }}>
                  <AppText variant="heading">Нова обява за продажба</AppText>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Icon name="eye-outline" size={14} color={colors.muted} />
                    <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                      Вижда се само от търговци, не и от други фермери.
                    </AppText>
                  </View>
                </View>
                <ListingForm crops={data.cropOptions} />
              </View>
            ),
          },
          {
            key: "mine",
            label: "Мои",
            count: isTrader ? data.myOffers.length : data.myListings.length,
            content: isTrader ? (
              <MyOffers offers={data.myOffers} now={now} />
            ) : (
              <MyListings listings={data.myListings} />
            ),
          },
          {
            key: "saved",
            label: "Запазени",
            count: saved.data?.items.length,
            content: <SavedList isTrader={isTrader} ctx={ctx} />,
          },
        ]}
      />
    </>
  );
}

const CATEGORY_EMOJI = { CROP: "🌾", FERTILIZER: "🧪", SEED: "🌱" } as const;

/** Empty list with an icon, a short explanation and an optional way forward. */
function EmptyBlock({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Card style={{ alignItems: "center", gap: space.sm, paddingVertical: space.xl }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.brand[50],
          marginBottom: 4,
        }}
      >
        <Icon name={icon} size={26} color={colors.brand[600]} />
      </View>
      <AppText variant="small" bold align="center">
        {title}
      </AppText>
      <AppText variant="caption" tone="muted" align="center">
        {description}
      </AppText>
      {action ? (
        <View style={{ marginTop: space.sm, alignSelf: "stretch" }}>
          <Button title={action.label} variant="secondary" onPress={action.onPress} />
        </View>
      ) : null}
    </Card>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: selected ? colors.brand[600] : colors.line,
          backgroundColor: selected ? colors.brand[50] : colors.white,
        },
        pressed && pressedStyle,
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? colors.brand[700] : colors.muted} /> : null}
      <AppText variant="caption" bold style={{ color: selected ? colors.brand[700] : colors.muted }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Bookmark toggle on a list row; the detail screen has the full button. */
function BookmarkButton({ kind, id, title, ctx }: { kind: "OFFER" | "LISTING"; id: string; title: string; ctx: RowContext }) {
  const saved = ctx.saved.has(`${kind}:${id}`);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? `Премахни ${title} от запазени` : `Запази ${title}`}
      accessibilityState={{ selected: saved }}
      hitSlop={10}
      onPress={() =>
        ctx.toggleSaved.mutate(
          { kind, id, saved: !saved },
          {
            onError: () =>
              showDialog({
                title: "Не успяхме да запазим промяната",
                message: "Провери връзката и опитай отново.",
                icon: "alert-circle-outline",
                tone: "danger",
              }),
          },
        )
      }
      style={({ pressed }) => [{ padding: 4 }, pressed && pressedStyle]}
    >
      <Icon name={saved ? "bookmark" : "bookmark-outline"} size={20} color={saved ? colors.brand[600] : colors.muted} />
    </Pressable>
  );
}

/** "+12% над пазара" in green, "−5% под пазара" in red. */
function MarketDelta({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const flat = Math.abs(delta) < 0.5;
  const color = flat ? colors.muted : delta > 0 ? colors.up : colors.down;
  return (
    <AppText variant="caption" bold style={{ color }}>
      {flat
        ? "на пазарна цена"
        : `${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta), 0)}% ${delta > 0 ? "над" : "под"} пазара`}
    </AppText>
  );
}

const EXPIRY_STYLE = {
  muted: { bg: colors.soft, fg: colors.muted },
  warn: { bg: "#fff4e5", fg: colors.warn },
  danger: { bg: colors.red50, fg: colors.red600 },
} as const;

function ExpiryChip({ expiry }: { expiry: Expiry | null }) {
  if (!expiry) return null;
  const style = EXPIRY_STYLE[expiry.tone];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: style.bg,
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Icon name="time-outline" size={12} color={style.fg} />
      <AppText variant="caption" bold style={{ color: style.fg, fontSize: 11 }}>
        {expiry.label}
      </AppText>
    </View>
  );
}

function EmojiTile({ emoji }: { emoji: string }) {
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.md,
        backgroundColor: colors.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText style={{ fontSize: 20 }}>{emoji}</AppText>
    </View>
  );
}

function GroupHeader({ title }: { title: string }) {
  return (
    <View style={{ paddingHorizontal: space.lg, paddingVertical: 8, backgroundColor: colors.soft }}>
      <AppText variant="caption" tone="muted" bold style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </AppText>
    </View>
  );
}

/** Bookmarked offers and listings; changes arrive as alerts. */
function SavedList({ isTrader, ctx }: { isTrader: boolean; ctx: RowContext }) {
  const saved = useSavedItems();

  return (
    <QueryBoundary query={saved} stamp={false}>
      {({ items }) =>
        items.length ? (
          <RowList>
            {items.map((item, index) => (
              <View key={`${item.kind}:${item.id}`}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(item.kind === "OFFER" ? `/trade/offers/${item.id}` : `/trade/listings/${item.id}`)
                  }
                  style={({ pressed }) => [
                    { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
                    pressed && pressedStyle,
                  ]}
                >
                  <View style={{ opacity: item.isOpen ? 1 : 0.5 }}>
                    <EmojiTile emoji={ctx.emojiOf(item.title)} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText variant="small" bold tone={item.isOpen ? "ink" : "muted"}>
                      {item.title}
                    </AppText>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <AppText variant="caption" tone="muted">
                        {item.kind === "OFFER" ? "Оферта" : "Обява"}
                      </AppText>
                      {item.price !== null ? (
                        <AppText variant="caption" bold numeric>
                          {formatPrice(item.price, item.unit)}
                        </AppText>
                      ) : null}
                      {!item.isOpen ? <Pill tone="neutral">Неактивна</Pill> : null}
                    </View>
                  </View>
                  <BookmarkButton kind={item.kind} id={item.id} title={item.title} ctx={ctx} />
                </Pressable>
              </View>
            ))}
          </RowList>
        ) : (
          <EmptyBlock
            icon="bookmark-outline"
            title="Нищо запазено"
            description={
              isTrader
                ? "Натисни отметката до обява, за да я следиш тук и да получаваш известие при промяна."
                : "Натисни отметката до оферта, за да я следиш тук и да получаваш известие при промяна."
            }
          />
        )
      }
    </QueryBoundary>
  );
}

function OffersList({
  offers,
  ctx,
  favoriteNames,
  ownIds,
}: {
  offers: Offer[];
  ctx: RowContext;
  favoriteNames: string[];
  ownIds: Set<string>;
}) {
  const [filter, setFilter] = useState<OfferFilter<Offer["category"]>>({
    category: "ALL",
    sort: "new",
    favoritesOnly: false,
  });

  if (!offers.length) {
    return (
      <EmptyBlock
        icon="pricetags-outline"
        title="Все още няма оферти"
        description="Когато търговец публикува оферта, ще я видиш тук. Можеш да публикуваш обява, за да те намерят търговците."
      />
    );
  }

  const categories = (Object.keys(CATEGORY_LABELS) as Offer["category"][]).filter((category) =>
    offers.some((offer) => offer.category === category),
  );
  const showCategory = categories.length > 1 || categories[0] !== "CROP";
  const visible = filterOffers(offers, filter, favoriteNames);
  const groups = filter.sort === "new" ? groupByDay(visible, ctx.now) : [{ title: "", items: visible }];

  return (
    <View style={{ gap: space.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {categories.length > 1 ? (
          <>
            <FilterChip
              label="Всички"
              selected={filter.category === "ALL"}
              onPress={() => setFilter((f) => ({ ...f, category: "ALL" }))}
            />
            {categories.map((category) => (
              <FilterChip
                key={category}
                label={CATEGORY_LABELS[category]}
                selected={filter.category === category}
                onPress={() => setFilter((f) => ({ ...f, category }))}
              />
            ))}
          </>
        ) : null}
        <FilterChip
          label="Най-нови"
          icon="time-outline"
          selected={filter.sort === "new"}
          onPress={() => setFilter((f) => ({ ...f, sort: "new" }))}
        />
        <FilterChip
          label="Най-висока цена"
          icon="trending-up"
          selected={filter.sort === "price"}
          onPress={() => setFilter((f) => ({ ...f, sort: "price" }))}
        />
        {favoriteNames.length ? (
          <FilterChip
            label="Любими"
            icon={filter.favoritesOnly ? "star" : "star-outline"}
            selected={filter.favoritesOnly}
            onPress={() => setFilter((f) => ({ ...f, favoritesOnly: !f.favoritesOnly }))}
          />
        ) : null}
      </ScrollView>

      {visible.length ? (
        <RowList>
          {groups.map((group, groupIndex) => (
            <View key={group.title || "all"}>
              {group.title ? (
                <>
                  {groupIndex > 0 ? <Divider /> : null}
                  <GroupHeader title={group.title} />
                </>
              ) : null}
              {group.items.map((offer, index) => (
                <View key={offer.id}>
                  {index > 0 || group.title ? <Divider /> : null}
                  <OfferRow
                    offer={offer}
                    ctx={ctx}
                    showCategory={showCategory}
                    own={ownIds.has(offer.id)}
                  />
                </View>
              ))}
            </View>
          ))}
        </RowList>
      ) : (
        <EmptyBlock
          icon="funnel-outline"
          title="Няма оферти по този филтър"
          description="Промени филтъра, за да видиш всички оферти."
          action={{
            label: "Покажи всички",
            onPress: () => setFilter({ category: "ALL", sort: filter.sort, favoritesOnly: false }),
          }}
        />
      )}
    </View>
  );
}

function OfferRow({
  offer,
  ctx,
  showCategory,
  own,
}: {
  offer: Offer;
  ctx: RowContext;
  showCategory: boolean;
  own: boolean;
}) {
  const delta = marketDelta(offer.price, offer.unit, findMarketRow(offer.title, ctx.prices));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Отвори офертата ${offer.title}`}
      onPress={() => router.push(`/trade/offers/${offer.id}`)}
      style={({ pressed }) => [
        { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
        pressed && pressedStyle,
      ]}
    >
      <EmojiTile emoji={ctx.emojiOf(offer.title, offer.category)} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
          <AppText variant="small" bold style={{ flex: 1 }}>
            {offer.title}
          </AppText>
          <AppText variant="small" bold numeric>
            {formatPrice(offer.price, offer.unit)}
          </AppText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {own ? "твоя оферта" : `от ${offer.trader.farmName || offer.trader.name}`}
          </AppText>
          <MarketDelta delta={delta} />
        </View>
        {showCategory || offer.validUntil ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {showCategory ? <Pill tone="brand">{CATEGORY_LABELS[offer.category]}</Pill> : null}
            <ExpiryChip expiry={expiryOf(offer.validUntil, ctx.now)} />
          </View>
        ) : null}
        {offer.note ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {offer.note}
          </AppText>
        ) : null}
      </View>
      {own ? (
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      ) : (
        <View style={{ alignItems: "center", gap: 6 }}>
          <BookmarkButton kind="OFFER" id={offer.id} title={offer.title} ctx={ctx} />
          <Icon name="chevron-forward" size={16} color={colors.muted} />
        </View>
      )}
    </Pressable>
  );
}

function ListingsForTraders({ listings, ctx }: { listings: Listing[]; ctx: RowContext }) {
  if (!listings.length) {
    return (
      <EmptyBlock
        icon="leaf-outline"
        title="Все още няма активни обяви"
        description="Когато фермер публикува обява за продажба, ще я видиш тук заедно с контакт за връзка."
      />
    );
  }

  return (
    <RowList>
      {groupByDay(listings, ctx.now).map((group, groupIndex) => (
        <View key={group.title}>
          {groupIndex > 0 ? <Divider /> : null}
          <GroupHeader title={group.title} />
          {group.items.map((listing) => (
            <View key={listing.id}>
              <Divider />
              <ListingRow listing={listing} ctx={ctx} />
            </View>
          ))}
        </View>
      ))}
    </RowList>
  );
}

function ListingRow({ listing, ctx }: { listing: Listing; ctx: RowContext }) {
  const delta = marketDelta(listing.askPrice, listing.unit, findMarketRow(listing.title, ctx.prices));
  return (
    <View style={{ padding: space.lg, gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Отвори обявата ${listing.title}`}
        onPress={() => router.push(`/trade/listings/${listing.id}`)}
        style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: space.md }, pressed && pressedStyle]}
      >
        <EmojiTile emoji={ctx.emojiOf(listing.title)} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
            <AppText variant="small" bold style={{ flex: 1 }}>
              {listing.title}
            </AppText>
            <AppText variant="small" bold numeric>
              {formatNumber(listing.quantityT)} т
            </AppText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <AppText variant="caption" tone="muted">
              {listing.askPrice !== null ? `желана ${formatPrice(listing.askPrice, listing.unit)}` : "без посочена цена"}
            </AppText>
            <MarketDelta delta={delta} />
          </View>
          <SampleSpecs hectolitre={listing.hectolitre} protein={listing.protein} gluten={listing.gluten} />
          {listing.note ? (
            <AppText variant="caption" tone="muted" numberOfLines={2}>
              {listing.note}
            </AppText>
          ) : null}
        </View>
        <View style={{ alignItems: "center", gap: 6 }}>
          <BookmarkButton kind="LISTING" id={listing.id} title={listing.title} ctx={ctx} />
          <Icon name="chevron-forward" size={16} color={colors.muted} />
        </View>
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
          <Icon name="person-circle-outline" size={18} color={colors.muted} />
          <View style={{ flex: 1, minWidth: 120 }}>
            <AppText variant="caption" bold>
              {listing.farmer.farmName || listing.farmer.name}
            </AppText>
            {listing.farmer.farmName ? (
              <AppText variant="caption" tone="muted">
                {listing.farmer.name}
              </AppText>
            ) : null}
          </View>
          {listing.farmer.phone ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Обади се на ${listing.farmer.phone}`}
              onPress={() => void Linking.openURL(telHref(listing.farmer!.phone!))}
              hitSlop={8}
              style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 4 }, pressed && pressedStyle]}
            >
              <Icon name="call" size={14} color={colors.brand[600]} />
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
  );
}

/** Asks first: deleting a published offer or listing cannot be undone. */
function confirmDelete(what: string, onConfirm: () => void) {
  showDialog({
    title: `Да изтрия ли ${what}?`,
    message: "Това действие не може да бъде отменено.",
    icon: "trash-outline",
    tone: "danger",
    dismissable: true,
    actions: [
      { label: "Отказ", style: "cancel" },
      { label: "Изтрий", style: "destructive", onPress: onConfirm },
    ],
  });
}

function MyOffers({ offers, now }: { offers: Offer[]; now: number }) {
  const toggle = useToggleOffer();
  const remove = useDeleteOffer();

  if (!offers.length) {
    return (
      <EmptyBlock
        icon="pricetag-outline"
        title="Нямаш публикувани оферти"
        description="Публикувай първата си оферта от раздел „Оферти“ — фермерите ще я видят веднага."
      />
    );
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
                {formatPrice(offer.price, offer.unit)}
              </AppText>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pill tone={offer.isActive ? "brand" : "neutral"}>
                {offer.isActive ? "Активна" : "Скрита"}
              </Pill>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {offer.validUntil ? (
                  <ExpiryChip expiry={expiryOf(offer.validUntil, now)} />
                ) : (
                  <AppText variant="caption" tone="muted">
                    {formatShortDate(new Date(offer.createdAt))}
                  </AppText>
                )}
              </View>
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
    return (
      <EmptyBlock
        icon="leaf-outline"
        title="Нямаш публикувани обяви"
        description="Публикувай обява от раздел „Обяви“ — търговците ще могат да се свържат с теб."
      />
    );
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
