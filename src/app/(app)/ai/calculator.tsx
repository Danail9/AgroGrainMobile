import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { useMarket, useMe } from "@/api/queries";

import {
  CALCULATORS,
  initialValues,
  PROFIT_CALCULATOR_KEY,
  runCalculator,
  sanitizeDecimal,
  type CalculatorDef,
} from "@/lib/calculators";
import { favoritesFirst } from "@/lib/favorites";
import { formatNumber } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";
import { TextField } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { Card, Divider, RowList, pressedStyle } from "@/ui/primitives";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

export default function CalculatorScreen() {
  const [active, setActive] = useState<CalculatorDef | null>(null);
  // Raw text, so a field can be empty while typing instead of snapping back to 0.
  const [values, setValues] = useState<Record<string, string>>({});
  const [crop, setCrop] = useState<string | null>(null);

  function open(def: CalculatorDef) {
    setActive(def);
    setValues(initialValues(def));
    setCrop(null);
  }

  return (
    <Screen
      back="/ai"
      title="AI Калкулатор"
      subtitle="Бързи и полезни изчисления"
      keyboard
    >
      {!active ? (
        <RowList>
          {CALCULATORS.map((item, index) => (
            <View key={item.key}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => open(item)}
                style={({ pressed }) => [
                  { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
                  pressed && pressedStyle,
                ]}
              >
                <AppText style={{ fontSize: 22 }}>{item.emoji}</AppText>
                <View style={{ flex: 1 }}>
                  <AppText variant="small" bold>
                    {item.title}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {item.description}
                  </AppText>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </RowList>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => setActive(null)}
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Icon name="chevron-back" size={16} color={colors.brand[600]} />
            <AppText variant="small" tone="brand" bold>
              Всички калкулатори
            </AppText>
          </Pressable>

          <Card style={{ gap: space.md }}>
            <View>
              <AppText variant="small" bold>
                {active.emoji} {active.title}
              </AppText>
              <AppText variant="caption" tone="muted">
                {active.description}
              </AppText>
            </View>
            {active.fields.map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                suffix={field.suffix}
                value={values[field.key] ?? ""}
                keyboardType="decimal-pad"
                selectTextOnFocus
                onChangeText={(text) =>
                  setValues((prev) => ({ ...prev, [field.key]: sanitizeDecimal(text) }))
                }
              />
            ))}
          </Card>

          {active.key === PROFIT_CALCULATOR_KEY ? (
            <CropPricePicker
              selected={crop}
              onPick={(slug, price) => {
                setCrop(slug);
                setValues((prev) => ({ ...prev, price: String(Math.round(price * 100) / 100).replace(".", ",") }));
              }}
            />
          ) : null}

          <RowList>
            {runCalculator(active, values).map((result, index) => (
              <View key={result.label}>
                {index > 0 ? <Divider /> : null}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: space.md,
                    paddingHorizontal: space.lg,
                    paddingVertical: 12,
                  }}
                >
                  <AppText variant="small" tone="muted" style={{ flex: 1 }}>
                    {result.label}
                  </AppText>
                  <AppText variant="small" bold numeric>
                    {result.value}
                  </AppText>
                </View>
              </View>
            ))}
          </RowList>
        </>
      )}
    </Screen>
  );
}

/** Fills the sale price from today's market price of a crop, followed crops first. */
function CropPricePicker({
  selected,
  onPick,
}: {
  selected: string | null;
  onPick: (slug: string, price: number) => void;
}) {
  const market = useMarket();
  const me = useMe();
  const crops = favoritesFirst(
    (market.data?.prices ?? []).filter((row) => row.unit === "€/т"),
    me.data?.favoriteCrops,
  );
  if (!crops.length) return null;

  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="caption" tone="muted">
        Попълни цената по днешната борсова цена:
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {crops.map((row) => {
          const on = row.slug === selected;
          return (
            <Pressable
              key={row.slug}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onPick(row.slug, row.price)}
              style={({ pressed }) => [
                {
                  paddingHorizontal: space.md,
                  paddingVertical: 8,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: on ? colors.brand[600] : colors.line,
                  backgroundColor: on ? colors.brand[50] : colors.white,
                },
                pressed && pressedStyle,
              ]}
            >
              <AppText variant="caption" bold={on} tone={on ? "brand" : "ink"}>
                {row.emoji} {row.name} · {formatNumber(row.price)} €/т
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
