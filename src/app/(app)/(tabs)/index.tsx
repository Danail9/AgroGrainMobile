import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { useHome, useMe, useWeather } from "@/api/queries";
import type { Home, WeatherResponse } from "@/api/schemas";
import { formatLongDate, formatNumber, greeting } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";
import { BriefingSections } from "@/ui/BriefingSections";
import { HeaderActions } from "@/ui/HeaderActions";
import { Icon } from "@/ui/Icon";
import { PriceRow } from "@/ui/PriceRow";
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
  const me = useMe();
  const home = useHome();
  const weather = useWeather(home.data?.role === "FARMER");
  const firstName = me.data?.user.name.split(" ")[0] ?? "";
  const unread = home.data && "unreadCount" in home.data ? home.data.unreadCount : 0;
  const trader = me.data?.user.role === "TRADER";

  const salutation = `${greeting().replace("!", "")}${firstName ? `, ${firstName}` : ""}!`;

  return (
    <Screen
      tabbed
      title={salutation}
      wrapTitle
      subtitle={formatLongDate()}
      right={<HeaderActions unreadCount={unread} news={!trader} />}
      onRefresh={() => {
        void home.refetch();
        void me.refetch();
        if (home.data?.role === "FARMER") void weather.refetch();
      }}
      refreshing={home.isRefetching || weather.isRefetching}
    >
      <QueryBoundary query={home}>
        {(data) =>
          data.role === "FARMER" ? (
            <FarmerView
              data={data}
              canTrade={me.data?.subscription.canTrade ?? false}
              liveWeather={weather.data?.weather}
              weatherUnavailable={weather.isError && !weather.data}
            />
          ) : data.role === "TRADER" ? (
            <TraderView data={data} />
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
}: {
  data: FarmerHome;
  canTrade: boolean;
  liveWeather?: WeatherResponse["weather"];
  weatherUnavailable: boolean;
}) {
  const homeWeather = data.weather;
  const current = liveWeather?.current ?? homeWeather.current;
  const today = liveWeather?.daily[0] ?? homeWeather.today;
  const work = homeWeather.fieldWork;
  const showChange = data.prices.some((price) => price.changePct !== null);
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
          {data.prices.map((price, index) => (
            <View key={price.slug}>
              {index > 0 ? <Divider /> : null}
              <PriceRow price={price} showChange={showChange} compact />
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

function TraderView({ data }: { data: TraderHome }) {
  const showChange = data.prices.some((price) => price.changePct !== null);

  return (
    <>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <StatChip
          icon={<Icon name="pricetag" size={16} color={colors.brand[600]} />}
          value={formatNumber(data.stats.activeOffers)}
          label="Активни оферти"
        />
        <StatChip
          icon={<Icon name="cube" size={16} color={colors.brand[600]} />}
          value={formatNumber(data.stats.openListings)}
          label="Отворени обяви"
        />
        <StatChip
          icon={<Icon name="swap-horizontal" size={16} color={colors.brand[600]} />}
          value={`${formatNumber(data.stats.totalTonnage)} т`}
          label="Общо количество"
        />
      </View>

      <View>
        <SectionHeader title="Последни обяви от фермери" action="Към борсата" href="/trade" />
        {data.latestListings.length ? (
          <RowList>
            {data.latestListings.map((listing, index) => (
              <View key={listing.id}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/trade/listings/${listing.id}`)}
                  style={({ pressed }) => [{ padding: space.lg, gap: 2 }, pressed && pressedStyle]}
                >
                  <View style={{ flexDirection: "row", gap: space.sm }}>
                    <AppText variant="small" bold numberOfLines={1} style={{ flex: 1 }}>
                      {listing.title}
                    </AppText>
                    <AppText variant="small" bold numeric>
                      {formatNumber(listing.quantityT)} т
                    </AppText>
                  </View>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {listing.farmer?.farmName || listing.farmer?.name || "Фермер"}
                    {listing.askPrice ? ` · ${formatNumber(listing.askPrice, 2)} ${listing.unit}` : ""}
                  </AppText>
                </Pressable>
              </View>
            ))}
          </RowList>
        ) : (
          <Card>
            <AppText variant="small" tone="muted" align="center">
              Все още няма отворени обяви.
            </AppText>
          </Card>
        )}
      </View>

      <View>
        <SectionHeader title="Пазарни цени (€/т)" action="Виж всички" href="/market" />
        <RowList>
          {data.prices.map((price, index) => (
            <View key={price.slug}>
              {index > 0 ? <Divider /> : null}
              <PriceRow price={price} showChange={showChange} compact />
            </View>
          ))}
        </RowList>
      </View>

    </>
  );
}
