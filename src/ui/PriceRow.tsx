import { router } from "expo-router";
import { Pressable, View } from "react-native";

import type { z } from "zod";

import type { priceRowSchema } from "@/api/schemas";
import { formatNumber } from "@/lib/format";
import { colors, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { pressedStyle, ChangeBadge } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export type PriceRowData = z.infer<typeof priceRowSchema>;

/** Opens crop details; port quotes remain separate from legacy single prices. */
export function PriceRow({
  price,
  showChange,
  compact = false,
  fullUnit = false,
  favorite = false,
}: {
  price: PriceRowData;
  /** Reserve the change column only when at least one row can fill it. */
  showChange: boolean;
  compact?: boolean;
  /** Show "€/т" instead of the short "€" used on the cramped home card. */
  fullUnit?: boolean;
  favorite?: boolean;
}) {
  const description = price.portPrices
    ? (["VARNA", "BURGAS"] as const).map((destination) => {
      const quote = price.portPrices?.find((item) => item.destination === destination);
      return `Доставено до пристанище ${destination === "VARNA" ? "Варна" : "Бургас"}: ${quote ? `${formatNumber(quote.price, 2)} евро на тон` : "Няма публикувана оферта"}`;
    }).join("; ")
    : `${formatNumber(price.price)} евро на тон${price.deliveryLabel ? `, ${price.deliveryLabel}` : ""}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${price.name}${favorite ? " (любима)" : ""}, ${description}`}
      onPress={() => router.push(`/market/${price.slug}`)}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          paddingHorizontal: space.lg,
          paddingVertical: compact ? 14 : space.lg,
        },
        pressed && pressedStyle,
      ]}
    >
      <AppText style={{ fontSize: 20, width: 26 }}>{price.emoji || "🌱"}</AppText>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <AppText variant="body" style={{ flexShrink: 1, fontWeight: "500" }}>
            {price.name}
          </AppText>
          {favorite ? (
            <Icon name="star" size={14} color={colors.warn} />
          ) : null}
        </View>
        {!price.portPrices && price.deliveryLabel && price.delivery !== "NATIONAL" ? (
          <AppText variant="caption" tone="muted">{price.deliveryLabel}</AppText>
        ) : null}
      </View>
      {price.portPrices ? (
        <View style={{ flexDirection: "row", width: 152, gap: space.sm }}>
          {(["VARNA", "BURGAS"] as const).map((destination) => {
            const quote = price.portPrices?.find((item) => item.destination === destination);
            return (
              <View key={destination} style={{ flex: 1, gap: 2 }}>
                <AppText variant="caption" tone="muted" align="right" style={{ fontSize: 10 }}>
                  {destination === "VARNA" ? "Варна" : "Бургас"}
                </AppText>
                <AppText variant="small" numeric bold align="right" tone={quote ? "ink" : "muted"} style={{ fontSize: 13 }}>
                  {quote ? <>{formatNumber(quote.price, Number.isInteger(quote.price) ? 0 : 2)}{" "}
                    <AppText variant="caption" tone="muted" style={{ fontSize: 10 }}>{price.unit}</AppText>
                  </> : "—"}
                </AppText>
              </View>
            );
          })}
        </View>
      ) : <AppText variant="body" numeric bold style={{ fontSize: 17 }}>
        {formatNumber(price.price, price.delivery && price.delivery !== "NATIONAL" ? 2 : 0)}{" "}
        <AppText variant="small" tone="muted" bold>
          {price.unit === "€/т" && !fullUnit ? "€" : price.unit}
        </AppText>
      </AppText>}
      {showChange && !price.portPrices ? (
        <View style={{ width: 84, alignItems: "flex-end" }}>
          <ChangeBadge value={price.changePct} variant="plain" />
        </View>
      ) : null}
    </Pressable>
  );
}
