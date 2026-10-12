import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { keys, useHome, useMarket, useMe, useNotifications, useTrade, useWeather } from "@/api/queries";
import type { Home, WeatherResponse } from "@/api/schemas";
import { formatLongDate, formatNumber, greeting, relativeTime, updatedAgo } from "@/lib/format";
import { expiringSoon, expiryOf, findMarketRow, formatPrice, marketDelta, topMovers } from "@/lib/trade";
import { colors, radius, shadowCard, space } from "@/theme/tokens";
import { BriefingSections } from "@/ui/BriefingSections";
import { HeaderActions } from "@/ui/HeaderActions";
import { Icon, type IconName } from "@/ui/Icon";
import { PriceRow } from "@/ui/PriceRow";
import { homePrices } from "@/lib/favorites";
import {
  Card,
  Divider,
  IconTile,
  RowList,
  SectionHeader,
  StatChip,
  pressedStyle,
} from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";
import { WeatherGlyph } from "@/ui/WeatherGlyph";

type FarmerHome = Extract<Home, { role: "FARMER" }>;
type TraderHome = Extract<Home, { role: "TRADER" }>;

const LEVEL = {
  good: { bg: colors.brand[50], fg: colors.brand[700] },
  medium: { bg: colors.amber50, fg: colors.amber700 },
  bad: { bg: colors.red50, fg: colors.red600 },
} as const;

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const me = useMe();
  const home = useHome();
  const notifications = useNotifications();
  const weather = useWeather(home.data?.role === "FARMER");
  const firstName = me.data?.user.name.split(" ")[0] ?? "";
  const unread = notifications.data?.unreadCount ??
    (home.data && "unreadCount" in home.data ? home.data.unreadCount : 0);
  const trader = me.data?.user.role === "TRADER";
  const [refreshing, setRefreshing] = useState(false);
  const refreshInProgress = useRef(false);

  async function refreshHome() {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    setRefreshing(true);
    try {
      await Promise.all([
        home.refetch(),
        me.refetch(),
        notifications.refetch(),
        ...(home.data?.role === "FARMER" ? [weather.refetch()] : []),
        ...(trader ? [queryClient.invalidateQueries({ queryKey: keys.trade })] : []),
      ]);
    } catch (error) {
      console.error("Manual Home refresh failed", error);
    } finally {
      refreshInProgress.current = false;
      setRefreshing(false);
    }
  }

  const salutation = `${greeting().replace("!", "")}${firstName ? `, ${firstName}` : ""}!`;

  return (
    <Screen
      tabbed
      title={salutation}
      wrapTitle
      subtitle={trader && home.dataUpdatedAt ? `${formatLongDate()} · ${updatedAgo(home.dataUpdatedAt).replace("обновено ", "обн. ").replace(/минути?/, "мин")}` : formatLongDate()}
      right={<HeaderActions unreadCount={unread} news={!trader} />}
      onRefresh={() => void refreshHome()}
      refreshing={refreshing}
    >
      <QueryBoundary query={home} stamp={!trader}>
        {(data) =>
          data.role === "FARMER" ? (
            <FarmerView
              data={data}
              canTrade={me.data?.subscription.canTrade ?? false}
              liveWeather={weather.data?.weather}
              weatherUnavailable={weather.isError && !weather.data}
              favorites={me.data?.favoriteCrops ?? []}
            />
          ) : data.role === "TRADER" ? (
            <TraderView data={data} favorites={me.data?.favoriteCrops ?? []} now={home.dataUpdatedAt} />
          ) : null
        }
      </QueryBoundary>
    </Screen>
  );
}

function FarmerView({
  data,
  canTrade,
  liveWeather,
  weatherUnavailable,
  favorites,
}: {
  data: FarmerHome;
  canTrade: boolean;
  liveWeather?: WeatherResponse["weather"];
  weatherUnavailable: boolean;
  favorites: string[];
}) {
  const homeWeather = data.weather;
  const current = liveWeather?.current ?? homeWeather.current;
  const today = liveWeather?.daily[0] ?? homeWeather.today;
  const work = homeWeather.fieldWork;
  const market = useMarket();
  const prices = homePrices(data.prices, market.data?.prices, favorites);
  const showChange = prices.some((price) => price.changePct !== null);
  const level = work ? LEVEL[work.level] : null;

  return (
    <>
      {liveWeather?.isFallback ?? homeWeather.isFallback ? (
        <Card style={{ backgroundColor: colors.amber50, borderColor: "#fde68a" }}>
          <AppText variant="small" tone="warn" bold>
            Показваме примерна прогноза — няма връзка с източника на данни за времето.
          </AppText>
        </Card>
      ) : null}
      {weatherUnavailable ? (
        <Card style={{ backgroundColor: colors.amber50, borderColor: "#fde68a" }}>
          <AppText variant="small" tone="warn" bold>
            Не успяхме да обновим времето — показваме последните налични данни.
          </AppText>
        </Card>
      ) : null}

      <Card>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Пълна прогноза за времето"
          onPress={() => router.push("/weather")}
          style={({ pressed }) => [{ gap: space.md }, pressed && pressedStyle]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Регион: ${data.regionName}. Смени региона`}
            onPress={() => router.push("/settings")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              alignSelf: "flex-start",
              backgroundColor: colors.soft,
              borderRadius: radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Icon name="location" size={14} color={colors.brand[600]} />
            <AppText variant="caption" bold>
              {data.regionName}
            </AppText>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <WeatherGlyph icon={current.condition.icon} size={44} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <AppText variant="hero" numeric>
                  {Math.round(current.temperature)}°C
                </AppText>
                {today ? (
                  <AppText variant="small" tone="muted" bold numeric>
                    ↑ {Math.round(today.max)}° ↓ {Math.round(today.min)}°
                  </AppText>
                ) : null}
              </View>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {current.condition.label} · усеща се{" "}
                {Math.round(current.apparentTemperature)}°
              </AppText>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <StatChip
              icon={<Icon name="water" size={15} color={colors.sky} />}
              value={`${today?.precipitationProbability ?? 0}%`}
              label="Валежи"
            />
            <StatChip
              icon={<Icon name="flag" size={15} color={colors.slate} />}
              value={`${Math.round(current.windSpeed)} км/ч`}
              label="Вятър"
            />
            <StatChip
              icon={<Icon name="speedometer" size={15} color={colors.brand[500]} />}
              value={`${Math.round(current.humidity)}%`}
              label="Влажност"
            />
          </View>
        </Pressable>

        {work && level ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/weather")}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                marginTop: space.md,
                borderRadius: radius.md,
                backgroundColor: level.bg,
                paddingHorizontal: 12,
                paddingVertical: 10,
              },
              pressed && pressedStyle,
            ]}
          >
            <IconTile tone="solid" size="sm">
              <Icon name="sparkles" size={15} color={colors.white} />
            </IconTile>
            <View style={{ flex: 1 }}>
              <AppText variant="small" bold style={{ color: level.fg }}>
                {work.label}
              </AppText>
              {work.reason ? (
                <AppText variant="caption" style={{ color: level.fg, opacity: 0.85 }}>
                  {work.reason}
                </AppText>
              ) : null}
            </View>
            <Icon name="chevron-forward" size={16} color={level.fg} />
          </Pressable>
        ) : null}
      </Card>

      <View>
        <SectionHeader title="Пазарни цени (€/т)" action="Виж всички" href="/market" />
        <RowList>
          {prices.map((price, index) => (
            <View key={price.slug}>
              {index > 0 ? <Divider /> : null}
              <PriceRow price={price} showChange={showChange} compact favorite={favorites.includes(price.slug)} />
            </View>
          ))}
        </RowList>
      </View>

      {canTrade && data.offers.length ? (
        <View>
          <SectionHeader
            title={`Оферти от търговци (${data.offers.length})`}
            action="Към борсата"
            href="/trade"
          />
          <RowList>
            {data.offers.map((offer, index) => (
              <View key={offer.id}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/trade/offers/${offer.id}`)}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space.sm,
                      padding: space.lg,
                    },
                    pressed && pressedStyle,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" style={{ fontWeight: "500" }}>
                      {offer.title}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {offer.trader.farmName || offer.trader.name}
                    </AppText>
                  </View>
                  <AppText variant="body" bold numeric style={{ fontSize: 17 }}>
                    {formatNumber(offer.price)}{" "}
                    <AppText variant="small" tone="muted" bold>
                      {offer.unit}
                    </AppText>
                  </AppText>
                </Pressable>
              </View>
            ))}
          </RowList>
        </View>
      ) : null}

      <Card padded={false} style={{ overflow: "hidden" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Виж целия дневен обзор"
          onPress={() => router.push("/ai/daily")}
          style={({ pressed }) => pressed && pressedStyle}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
              padding: space.lg,
              backgroundColor: colors.brand[50],
            }}
          >
            <IconTile tone="solid" size="md">
              <Icon name="sparkles" size={20} color={colors.white} />
            </IconTile>
            <View style={{ flex: 1 }}>
              <AppText variant="small" bold style={{ color: colors.brand[700] }}>
                AgroGrain AI
              </AppText>
              <AppText variant="small" bold>
                Какво е важно за теб днес?
              </AppText>
            </View>
          </View>
        </Pressable>
        <BriefingSections sections={data.summary.sections.slice(0, 4)} />
        <Divider />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/ai/daily")}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: space.md,
            },
            pressed && pressedStyle,
          ]}
        >
          <AppText variant="small" tone="brand" bold>
            Виж целия обзор
          </AppText>
          <Icon name="chevron-forward" size={16} color={colors.brand[600]} />
        </Pressable>
      </Card>
    </>
  );
}

function TraderView({ data, favorites, now }: { data: TraderHome; favorites: string[]; now: number }) {
  const market = useMarket();
  const trade = useTrade();
  const prices = homePrices(data.prices, market.data?.prices, favorites);
  const showChange = prices.some((price) => price.changePct !== null && price.changePct !== 0);
  const expiring = expiringSoon(trade.data?.myOffers ?? [], now);
  const movers = topMovers(market.data?.prices);

  return (
    <>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <StatCard
          icon="pricetag"
          value={formatNumber(data.stats.activeOffers)}
          label="Мои оферти"
          onPress={() => router.push("/trade?tab=mine")}
        />
        <StatCard
          icon="cube"
          value={formatNumber(data.stats.openListings)}
          label="Обяви от фермери"
          onPress={() => router.push("/trade?tab=listings")}
        />
        <StatCard
          icon="layers"
          value={formatNumber(data.stats.totalTonnage)}
          unit="т"
          label="Предлагани"
          onPress={() => router.push("/trade?tab=listings")}
        />
      </View>

      {expiring.length ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/trade?tab=mine")}
          style={({ pressed }) => [styles.alert, pressed && pressedStyle]}
        >
          <Icon name="time" size={22} color={colors.amber700} />
          <View style={{ flex: 1 }}>
            <AppText variant="small" bold style={{ color: colors.amber700 }}>
              {expiring.length === 1
                ? `„${expiring[0].title}“ ${expiryOf(expiring[0].validUntil, now)?.label}`
                : `${expiring.length} оферти изтичат до 3 дни`}
            </AppText>
            <AppText variant="caption" style={{ color: colors.amber700 }}>
              Удължи ги, за да ги виждат фермерите.
            </AppText>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.amber700} />
        </Pressable>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <QuickAction icon="add-circle" label="Нова оферта" onPress={() => router.push("/trade?tab=offers")} />
        <QuickAction icon="sparkles" label="AI анализ" onPress={() => router.push("/ai/market")} />
        <QuickAction icon="calculator" label="Калкулатор" onPress={() => router.push("/ai/calculator")} />
      </View>

      <View>
        <SectionHeader title="Нови обяви от фермери" action="Всички" href="/trade?tab=listings" />
        {data.latestListings.length ? (
          <RowList>
            {data.latestListings.map((listing, index) => {
              const row = findMarketRow(listing.title, market.data?.prices);
              const delta = listing.askPrice ? marketDelta(listing.askPrice, listing.unit, row) : null;
              return (
                <View key={listing.id}>
                  {index > 0 ? <Divider /> : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push(`/trade/listings/${listing.id}`)}
                    style={({ pressed }) => [styles.listing, pressed && pressedStyle]}
                  >
                    <View style={styles.emoji}>
                      <AppText style={{ fontSize: 20 }}>{row?.emoji ?? "🌾"}</AppText>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: "row", gap: space.sm }}>
                        <AppText variant="small" bold numberOfLines={1} style={{ flex: 1 }}>
                          {listing.title}
                        </AppText>
                        <AppText variant="small" bold numeric>
                          {formatNumber(listing.quantityT)} т
                        </AppText>
                      </View>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {listing.farmer?.farmName || listing.farmer?.name || "Фермер"} ·{" "}
                        {relativeTime(new Date(listing.createdAt), new Date(now))}
                      </AppText>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <AppText variant="caption" bold numeric>
                          {listing.askPrice ? formatPrice(listing.askPrice, listing.unit) : "Цена по договаряне"}
                        </AppText>
                        {delta !== null && Math.abs(delta) >= 0.5 ? (
                          <AppText variant="caption" bold style={{ color: delta > 0 ? colors.down : colors.up }}>
                            {delta > 0 ? "+" : "−"}
                            {formatNumber(Math.abs(delta), 0)}% {delta > 0 ? "над" : "под"} пазара
                          </AppText>
                        ) : null}
                      </View>
                      {specsLine(listing) ? (
                        <AppText variant="caption" tone="muted" numberOfLines={1}>
                          {specsLine(listing)}
                        </AppText>
                      ) : null}
                    </View>
                    <Icon name="chevron-forward" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              );
            })}
          </RowList>
        ) : (
          <Card style={{ alignItems: "center", gap: 6, paddingVertical: space.xl }}>
            <Icon name="cube-outline" size={28} color={colors.muted} />
            <AppText variant="small" tone="muted" align="center">
              Все още няма отворени обяви. Ще те известим, когато фермер публикува.
            </AppText>
          </Card>
        )}
      </View>

      {movers.length ? (
        <View>
          <SectionHeader title="Движение днес" action="AI анализ" href="/ai/market" />
          <RowList>
            {movers.map((row, index) => {
              const up = (row.changePct ?? 0) > 0;
              return (
                <View key={row.slug}>
                  {index > 0 ? <Divider /> : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push(`/market/${row.slug}`)}
                    style={({ pressed }) => [styles.mover, pressed && pressedStyle]}
                  >
                    <View style={[styles.trend, { backgroundColor: up ? colors.brand[50] : colors.red50 }]}>
                      <Icon name={up ? "trending-up" : "trending-down"} size={18} color={up ? colors.up : colors.down} />
                    </View>
                    <AppText variant="small" bold numberOfLines={1} style={{ flex: 1 }}>
                      {row.emoji ? `${row.emoji} ` : ""}
                      {row.name}
                    </AppText>
                    <View style={{ alignItems: "flex-end" }}>
                      <AppText variant="small" bold numeric>
                        {formatPrice(row.price, row.unit)}
                      </AppText>
                      <AppText variant="caption" bold numeric style={{ color: up ? colors.up : colors.down }}>
                        {up ? "+" : "−"}
                        {formatNumber(Math.abs(row.changePct ?? 0), 1)}%
                      </AppText>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </RowList>
        </View>
      ) : null}

      <View>
        <SectionHeader title="Пазарни цени" action="Виж всички" href="/market" />
        <RowList>
          {prices.map((price, index) => (
            <View key={price.slug}>
              {index > 0 ? <Divider /> : null}
              <PriceRow
                price={price}
                showChange={showChange}
                compact
                fullUnit
                favorite={favorites.includes(price.slug)}
              />
            </View>
          ))}
        </RowList>
      </View>
    </>
  );
}

function specsLine(listing: { hectolitre: number | null; protein: number | null; gluten: number | null }) {
  return [
    listing.hectolitre !== null ? `${formatNumber(listing.hectolitre)} кг/хл` : null,
    listing.protein !== null ? `протеин ${formatNumber(listing.protein)}%` : null,
    listing.gluten !== null ? `глутен ${formatNumber(listing.gluten)}%` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function StatCard({
  icon,
  value,
  unit,
  label,
  onPress,
}: {
  icon: IconName;
  value: string;
  unit?: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && pressedStyle]}
    >
      <View style={styles.statIcon}>
        <Icon name={icon} size={16} color={colors.brand[600]} />
      </View>
      <AppText variant="title" numeric style={{ fontSize: 22 }}>
        {value}
        {unit ? (
          <AppText variant="small" tone="muted" bold>
            {" "}
            {unit}
          </AppText>
        ) : null}
      </AppText>
      <AppText variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && pressedStyle]}
    >
      <Icon name={icon} size={18} color={colors.brand[700]} />
      <AppText variant="caption" bold numberOfLines={1} style={{ color: colors.brand[800] }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stat: {
    flex: 1,
    gap: 4,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    ...shadowCard,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.brand[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: colors.amber50,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand[200],
    backgroundColor: colors.brand[50],
  },
  listing: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  emoji: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  mover: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 12 },
  trend: { width: 32, height: 32, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
