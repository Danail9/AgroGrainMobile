import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useRegions } from "@/api/queries";
import { colors, radius } from "@/theme/tokens";
import { TextField } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { AppText } from "@/ui/Text";

export type RegionValue = { regionSlug: string; settlement: string };

/** Case-insensitive match that also copes with a leading "Област ". */
export function matchPlaces(
  query: string,
  data: {
    regions: { slug: string; name: string }[];
    settlements: { label: string; regionSlug: string }[];
  },
  limit = 8,
) {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const oblasts = data.regions
    .filter((region) => region.name.toLowerCase().includes(term))
    .map((region) => ({
      key: `region:${region.slug}`,
      label: `Област ${region.name}`,
      value: { regionSlug: region.slug, settlement: "" },
    }));

  const places = data.settlements
    .filter((item) => item.label.toLowerCase().includes(term))
    .map((item) => ({
      key: `place:${item.label}`,
      label: item.label,
      value: { regionSlug: item.regionSlug, settlement: item.label },
    }));

  return [...places, ...oblasts].slice(0, limit);
}

/**
 * Search over the oblasts and settlements. Picking a suggestion stores its
 * oblast slug, which drives the forecast and prices; typing without picking
 * leaves the previous choice untouched, as the web combobox does.
 */
export function RegionPicker({
  value,
  regionName,
  onChange,
}: {
  value: RegionValue;
  regionName: string;
  onChange: (value: RegionValue) => void;
}) {
  const regions = useRegions();
  const [query, setQuery] = useState("");

  const matches = useMemo(
    () => (regions.data ? matchPlaces(query, regions.data) : []),
    [query, regions.data],
  );

  return (
    <View style={{ gap: 8 }}>
      <TextField
        label="Регион"
        value={query}
        onChangeText={setQuery}
        placeholder="Напиши населено място…"
        autoCorrect={false}
        autoCapitalize="none"
        hint={
          regions.isError && !regions.data
            ? "Не успяхме да заредим списъка. Ще ползваме избрания регион."
            : undefined
        }
      />

      {matches.length > 0 ? (
        <View style={styles.list}>
          {matches.map((match, index) => (
            <Pressable
              key={match.key}
              accessibilityRole="button"
              onPress={() => {
                onChange(match.value);
                setQuery("");
              }}
              style={({ pressed }) => [
                styles.item,
                index > 0 && styles.itemBorder,
                pressed && { backgroundColor: colors.soft },
              ]}
            >
              <AppText variant="small" numberOfLines={1}>
                {match.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.current}>
        <Icon name="location" size={15} color={colors.brand[600]} />
        <AppText variant="small" bold style={{ flex: 1 }} numberOfLines={1}>
          {value.settlement || `Област ${regionName}`}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  item: { paddingHorizontal: 14, paddingVertical: 12 },
  itemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  current: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brand[50],
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
