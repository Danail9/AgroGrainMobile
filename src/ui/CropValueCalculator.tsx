import { useState } from "react";
import { View } from "react-native";

import type { PriceRow } from "@/api/schemas";
import { formatNumber } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";
import { TextField } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { Card, Divider } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

function formatValue(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return formatNumber(rounded, Number.isInteger(rounded) ? 0 : 2);
}

export function CropValueCalculator({ price }: { price: Pick<PriceRow, "portPrices"> }) {
  const [quantityText, setQuantityText] = useState("100");
  const text = quantityText.trim();
  const quantity = /^\d+([.,]\d+)?$/.test(text) ? Number(text.replace(",", ".")) : NaN;
  const validQuantity = Number.isFinite(quantity) && quantity > 0;
  const quotes = (["VARNA", "BURGAS"] as const).map((destination) => {
    const quote = price.portPrices?.find((item) => item.destination === destination);
    return { destination, quote, total: validQuantity && quote ? quantity * quote.price : null };
  });
  const tooLarge = quotes.some(({ total }) => total !== null && (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER / 100));
  const error = text && !validQuantity
    ? "Въведи количество, по-голямо от нула, с точка или запетая."
    : tooLarge ? "Количеството е твърде голямо за изчисление." : null;
  const [varna, burgas] = quotes;
  const difference = !error && varna.total !== null && burgas.total !== null
    ? Math.round(Math.abs(varna.total - burgas.total) * 100) / 100 : null;
  const higherPort = varna.total !== null && burgas.total !== null && varna.total > burgas.total ? "Варна" : "Бургас";

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Icon name="calculator-outline" size={22} color={colors.brand[600]} />
        <AppText variant="heading" style={{ flex: 1 }}>Калкулатор на стойността</AppText>
      </View>
      <AppText variant="caption" tone="muted">Ориентировъчна стойност по публикуваните цени</AppText>
      <TextField
        label="Количество (т)"
        value={quantityText}
        onChangeText={setQuantityText}
        keyboardType="decimal-pad"
        maxLength={12}
        placeholder="Напр. 100"
        suffix="т"
        error={error}
        hint={!text ? "Въведи количество, за да изчислиш стойността." : undefined}
      />
      <View style={{ gap: space.sm }}>
        {quotes.map(({ destination, quote, total }) => (
          <View key={destination} style={{
            backgroundColor: colors.brand[50], borderRadius: radius.md, padding: space.md, gap: 4,
          }}>
            <AppText variant="caption" tone="brand" bold>
              {destination === "VARNA" ? "Варна" : "Бургас"}
            </AppText>
            <AppText variant="body" bold={!!quote && !error && total !== null}
              numeric={!!quote && !error && total !== null} tone={quote ? "ink" : "muted"}>
              {!quote ? "Няма публикувана оферта" : error || total === null ? "—" : `${formatValue(total)} €`}
            </AppText>
          </View>
        ))}
      </View>
      {difference !== null ? (
        <>
          <Divider />
          <AppText variant="small" bold>Разлика: {formatValue(difference)} €</AppText>
          <AppText variant="caption" tone="muted">
            {difference === 0 ? "Еднаква стойност за двете пристанища."
              : `По-висока стойност за ${higherPort}. Разликата не отчита разходите до пристанището.`}
          </AppText>
        </>
      ) : null}
    </Card>
  );
}
