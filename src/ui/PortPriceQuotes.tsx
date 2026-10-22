import { View } from "react-native";

import type { PriceRow } from "@/api/schemas";
import { formatNumber, formatShortDate } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";
import { AppText } from "@/ui/Text";

export function PortPriceQuotes({ price, dates = false }: { price: PriceRow; dates?: boolean }) {
  return (
    <View style={{ gap: space.sm }}>
      {(["VARNA", "BURGAS"] as const).map((destination) => {
        const quote = price.portPrices?.find((item) => item.destination === destination);
        return (
          <View key={destination} style={{
            borderRadius: radius.md, backgroundColor: colors.brand[50],
            borderWidth: 1, borderColor: colors.brand[100], padding: space.md, gap: 4,
          }}>
            <AppText variant="caption" bold style={{ color: colors.brand[700] }}>
              Доставено до пристанище {destination === "VARNA" ? "Варна" : "Бургас"}
            </AppText>
            <AppText variant={quote ? "body" : "caption"} numeric={!!quote} bold={!!quote} tone={quote ? "ink" : "muted"}>
              {quote ? `${formatNumber(quote.price, 2)} ${price.unit}` : "Няма публикувана оферта"}
            </AppText>
            {quote && dates ? <AppText variant="caption" tone="muted">Обновено: {formatShortDate(new Date(quote.date))}</AppText> : null}
          </View>
        );
      })}
    </View>
  );
}
