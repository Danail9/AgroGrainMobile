import { useState } from "react";
import { View } from "react-native";

import type { z } from "zod";

import type { fertilizerSchema } from "@/api/schemas";
import { formatNumber } from "@/lib/format";
import { colors, space } from "@/theme/tokens";
import { ChoiceGroup } from "@/ui/forms";
import { Icon, type IconName } from "@/ui/Icon";
import { ChangeBadge, Divider, IconTile, Pill, RowList, tileColor } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export type Fertilizer = z.infer<typeof fertilizerSchema>;
type Category = Fertilizer["category"];
type Tier = Fertilizer["tier"];

const CATEGORIES: { key: Category; label: string; icon: IconName }[] = [
  { key: "nitrogen", label: "Азотни", icon: "flask" },
  { key: "phosphorus", label: "Фосфорни", icon: "beaker" },
  { key: "potassium", label: "Калиеви", icon: "leaf" },
  { key: "npk", label: "NPK", icon: "cube" },
];

const TIERS: { key: Tier; label: string }[] = [
  { key: "cheap", label: "Евтини" },
  { key: "medium", label: "Средни" },
  { key: "expensive", label: "Скъпи" },
];

export function FertilizerMarket({ offers }: { offers: Fertilizer[] }) {
  const [category, setCategory] = useState<Category>("nitrogen");
  const [tier, setTier] = useState<Tier>("cheap");

  const inCategory = offers.filter((offer) => offer.category === category);
  const visible = inCategory.filter((offer) => offer.tier === tier);
  const average = inCategory.length
    ? Math.round(inCategory.reduce((sum, offer) => sum + offer.price, 0) / inCategory.length)
    : 0;
  const icon = CATEGORIES.find((item) => item.key === category)?.icon ?? "flask";

  return (
    <View style={{ gap: space.lg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: space.md,
          backgroundColor: colors.brand[50],
          borderColor: colors.brand[100],
          borderWidth: 1,
          borderRadius: 16,
          padding: space.lg,
        }}
      >
        <IconTile tone="solid" size="md">
          <Icon name="cash" size={20} color={colors.white} />
        </IconTile>
        <View style={{ flex: 1 }}>
          <AppText variant="body" bold style={{ color: colors.brand[800] }}>
            Цени на торове
          </AppText>
          <AppText variant="caption" style={{ color: colors.brand[700], marginTop: 2 }}>
            Подбери категория и ценови клас за бърза ориентация.
          </AppText>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <AppText variant="caption" bold numeric style={{ color: colors.brand[700] }}>
            {formatNumber(average)} €/т
          </AppText>
          <AppText variant="caption" style={{ color: colors.brand[700] }}>
            средно
          </AppText>
        </View>
      </View>

      <ChoiceGroup
        options={CATEGORIES.map((item) => ({ value: item.key, label: item.label }))}
        value={category}
        onChange={setCategory}
      />
      <ChoiceGroup
        options={TIERS.map((item) => ({ value: item.key, label: item.label }))}
        value={tier}
        onChange={setTier}
      />

      <RowList>
        {visible.length ? (
          visible.map((offer, index) => (
            <View key={offer.slug}>
              {index > 0 ? <Divider /> : null}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  padding: space.lg,
                }}
              >
                <IconTile tone="brand" size="sm">
                  <Icon name={icon} size={16} color={tileColor("brand")} />
                </IconTile>
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="body" numberOfLines={1} style={{ fontWeight: "600" }}>
                    {offer.name}
                  </AppText>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Pill tone="brand">{offer.nutrient}</Pill>
                    <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                      {offer.source}
                    </AppText>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <AppText variant="body" bold numeric>
                    {formatNumber(offer.price)} €/т
                  </AppText>
                  <ChangeBadge value={offer.changePct} variant="plain" />
                </View>
              </View>
            </View>
          ))
        ) : (
          <AppText variant="small" tone="muted" align="center" style={{ padding: space.xl }}>
            Няма торове в тази категория и ценови клас.
          </AppText>
        )}
      </RowList>
    </View>
  );
}
