import { router } from "expo-router";
import { Pressable, View } from "react-native";

import type { z } from "zod";

import type { priceRowSchema } from "@/api/schemas";
import { formatNumber } from "@/lib/format";
import { space } from "@/theme/tokens";
import { pressedStyle, ChangeBadge } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export type PriceRowData = z.infer<typeof priceRowSchema>;

/** One crop line: name, price and day change. Opens the crop screen. */
export function PriceRow({
  price,
  showChange,
  compact = false,
  fullUnit = false,
}: {
  price: PriceRowData;
  /** Reserve the change column only when at least one row can fill it. */
  showChange: boolean;
  compact?: boolean;
  /** Show "€/т" instead of the short "€" used on the cramped home card. */
  fullUnit?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${price.name}, ${formatNumber(price.price)} евро на тон`}
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
      <AppText variant="body" style={{ flex: 1, fontWeight: "500" }}>
        {price.emoji} {price.name}
      </AppText>
      <AppText variant="body" numeric bold style={{ fontSize: 17 }}>
        {formatNumber(price.price)}{" "}
        <AppText variant="small" tone="muted" bold>
          {price.unit === "€/т" && !fullUnit ? "€" : price.unit}
        </AppText>
      </AppText>
      {showChange ? (
        <View style={{ width: 84, alignItems: "flex-end" }}>
          <ChangeBadge value={price.changePct} variant="plain" />
        </View>
      ) : null}
    </Pressable>
  );
}
