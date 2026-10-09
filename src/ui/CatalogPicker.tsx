import { useState } from "react";
import { Modal, Pressable, ScrollView, SectionList, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PriceRow } from "@/api/schemas";
import { catalogSections, findMarketRow, formatPrice, type CatalogItem } from "@/lib/trade";
import { colors, radius, space } from "@/theme/tokens";
import { TextField } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { pressedStyle } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export const OTHER = "__other__";

/**
 * Picks a name from the catalogue in a searchable sheet (favourites first,
 * grouped like the market, with today's price), or takes a typed name when it
 * is not listed. With no catalogue (seeds) it is a plain text field.
 */
export function CatalogPicker({
  label,
  noun,
  options,
  choice,
  custom,
  onChoice,
  onCustom,
  placeholder,
  error,
  prices,
  favorites,
}: {
  label: string;
  /** "култура", "тор" — used in "Избери култура". */
  noun: string;
  options: CatalogItem[];
  choice: string;
  custom: string;
  onChoice: (value: string) => void;
  onCustom: (value: string) => void;
  placeholder: string;
  error?: string;
  prices?: PriceRow[];
  favorites?: string[];
}) {
  const [open, setOpen] = useState(false);

  if (!options.length) {
    return (
      <TextField label={label} value={custom} onChangeText={onCustom} placeholder={placeholder} maxLength={120} error={error} />
    );
  }

  const selected = choice && choice !== OTHER ? options.find((option) => option.name === choice) : undefined;
  const market = selected ? findMarketRow(selected.name, prices) : null;
  const quick = catalogSections(options, prices, favorites).find((section) => section.key === "FAVORITES")?.data ?? [];

  function pick(value: string) {
    onChoice(value);
    setOpen(false);
  }

  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="caption" tone="muted" bold>
        {label}
      </AppText>

      {selected ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${selected.name}. Промени`}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.field, styles.fieldSelected, pressed && pressedStyle]}
        >
          <View style={styles.emoji}>
            <AppText style={{ fontSize: 22 }}>{selected.emoji ?? "🌾"}</AppText>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="small" bold>
              {selected.name}
            </AppText>
            <AppText variant="caption" tone="muted">
              {market ? `Пазарна цена днес: ${formatPrice(market.price, market.unit)}` : "Няма пазарна цена"}
            </AppText>
          </View>
          <AppText variant="caption" tone="brand" bold>
            Промени
          </AppText>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Избери ${noun}`}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.field, !!error && { borderColor: colors.down }, pressed && pressedStyle]}
        >
          <Icon name="search" size={18} color={colors.muted} />
          <AppText variant="small" tone="muted" style={{ flex: 1 }}>
            {choice === OTHER ? "Друго (напиши по-долу)" : `Избери ${noun}…`}
          </AppText>
          <Icon name="chevron-down" size={18} color={colors.muted} />
        </Pressable>
      )}

      {!choice && quick.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {quick.map(({ option }) => (
            <Pressable
              key={option.slug}
              accessibilityRole="button"
              accessibilityLabel={`Избери ${option.name}`}
              onPress={() => onChoice(option.name)}
              style={({ pressed }) => [styles.quick, pressed && pressedStyle]}
            >
              <Icon name="star" size={12} color={colors.warn} />
              <AppText variant="caption" bold>
                {option.emoji ? `${option.emoji} ` : ""}
                {option.name}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {choice === OTHER ? (
        <TextField
          label="Наименование"
          value={custom}
          onChangeText={onCustom}
          placeholder={placeholder}
          maxLength={120}
          error={error}
          autoFocus
        />
      ) : error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}

      <PickerSheet
        visible={open}
        title={`Избери ${noun}`}
        options={options}
        prices={prices}
        favorites={favorites}
        selected={choice}
        onPick={pick}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

function PickerSheet({
  visible,
  title,
  options,
  prices,
  favorites,
  selected,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: CatalogItem[];
  prices?: PriceRow[];
  favorites?: string[];
  selected: string;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const sections = catalogSections(options, prices, favorites, query);

  function close() {
    setQuery("");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: colors.soft, paddingBottom: insets.bottom }}>
        <View style={styles.sheetHeader}>
          <AppText variant="body" bold style={{ flex: 1 }}>
            {title}
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Затвори" hitSlop={10} onPress={close}>
            <Icon name="close" size={24} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            accessibilityLabel="Търси"
            value={query}
            onChangeText={setQuery}
            placeholder="Търси…"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Изчисти търсенето" hitSlop={8} onPress={() => setQuery("")}>
              <Icon name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.option.slug}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
          renderSectionHeader={({ section }) => (
            <AppText variant="caption" tone="muted" bold style={styles.sectionTitle}>
              {section.title}
            </AppText>
          )}
          renderItem={({ item, index, section }) => {
            const on = item.option.name === selected;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  setQuery("");
                  onPick(item.option.name);
                }}
                style={({ pressed }) => [
                  styles.row,
                  index === 0 && styles.rowFirst,
                  index === section.data.length - 1 && styles.rowLast,
                  pressed && pressedStyle,
                ]}
              >
                <AppText style={{ fontSize: 20, width: 28 }}>{item.option.emoji ?? "🌾"}</AppText>
                <AppText variant="small" bold={on} style={{ flex: 1 }}>
                  {item.option.name}
                </AppText>
                {item.market ? (
                  <AppText variant="caption" tone="muted" numeric>
                    {formatPrice(item.market.price, item.market.unit)}
                  </AppText>
                ) : null}
                {on ? <Icon name="checkmark" size={18} color={colors.brand[600]} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <AppText variant="small" tone="muted" align="center" style={{ padding: space.xl }}>
              Няма съвпадения за „{query}“.
            </AppText>
          }
          ListFooterComponent={
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setQuery("");
                onPick(OTHER);
              }}
              style={({ pressed }) => [styles.row, styles.rowFirst, styles.rowLast, { marginTop: space.lg }, pressed && pressedStyle]}
            >
              <Icon name="create-outline" size={20} color={colors.brand[600]} />
              <AppText variant="small" tone="brand" bold style={{ flex: 1 }}>
                Не е в списъка — напиши име
              </AppText>
            </Pressable>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  fieldSelected: { borderColor: colors.brand[200], backgroundColor: colors.brand[50] },
  emoji: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  quick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15, color: colors.ink },
  sectionTitle: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: space.lg,
    marginBottom: 6,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 13,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  rowFirst: { borderTopWidth: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  rowLast: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
});
