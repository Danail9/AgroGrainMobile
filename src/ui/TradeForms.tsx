import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { isApiError } from "@/api/client";
import { useCreateListing, useCreateOffer, useMarket, useMe } from "@/api/queries";
import { VALIDITY_CHOICES, normalizeDecimal, numericInput, validUntil, type ValidityValue } from "@/lib/forms";
import { findMarketRow, formatPrice, marketDelta } from "@/lib/trade";
import { colors, radius, space } from "@/theme/tokens";
import { CatalogPicker, OTHER } from "@/ui/CatalogPicker";
import { Button, ChoiceGroup, FormMessage, TextField } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { pressedStyle } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export type CatalogOption = { slug: string; name: string; emoji?: string };

/** Market rows and the user's favourite crops, for the picker and price hints. */
function useMarketContext() {
  const market = useMarket();
  const me = useMe();
  return { prices: market.data?.prices, favorites: me.data?.favoriteCrops ?? [] };
}

const titleOf = (choice: string, custom: string) => (choice && choice !== OTHER ? choice : custom);

const CATEGORY_CHOICES = [
  { value: "CROP", label: "Култури" },
  { value: "FERTILIZER", label: "Торове" },
  { value: "SEED", label: "Семена" },
] as const;

type Errors = Partial<Record<string, string>>;

function useFormErrors() {
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Errors>({});

  return {
    error,
    fields,
    clear() {
      setError(null);
      setFields({});
    },
    fail(e: unknown, known: string[]) {
      if (isApiError(e) && e.field && known.includes(e.field)) {
        setFields({ [e.field]: e.message });
      } else {
        setError(isApiError(e) ? e.message : "Записът е неуспешен. Опитай отново.");
      }
    },
  };
}

export function OfferForm({
  crops,
  fertilizers,
}: {
  crops: CatalogOption[];
  fertilizers: CatalogOption[];
}) {
  const create = useCreateOffer();
  const form = useFormErrors();
  const [success, setSuccess] = useState<string | null>(null);

  const [category, setCategory] = useState<(typeof CATEGORY_CHOICES)[number]["value"]>("CROP");
  const [choice, setChoice] = useState("");
  const [custom, setCustom] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("€/т");
  const [validity, setValidity] = useState<ValidityValue>("none");
  const [note, setNote] = useState("");

  const options = category === "CROP" ? crops : category === "FERTILIZER" ? fertilizers : [];
  const ctx = useMarketContext();

  function reset() {
    setCategory("CROP");
    setChoice("");
    setCustom("");
    setPrice("");
    setUnit("€/т");
    setValidity("none");
    setNote("");
  }

  function submit() {
    form.clear();
    setSuccess(null);
    create.mutate(
      {
        category,
        title: titleOf(choice, custom),
        price: normalizeDecimal(price),
        unit,
        note,
        validUntil: validUntil(validity),
      },
      {
        onSuccess: () => {
          setSuccess("Офертата е публикувана успешно.");
          reset();
        },
        onError: (e) => form.fail(e, ["title", "price", "unit", "note", "validUntil"]),
      },
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <FormMessage error={form.error} success={success} />

      <ChoiceGroup
        label="Категория"
        options={CATEGORY_CHOICES.map((item) => ({ value: item.value, label: item.label }))}
        value={category}
        onChange={(value) => {
          setCategory(value);
          setChoice("");
          setCustom("");
        }}
      />

      <CatalogPicker
        label="Наименование"
        noun={category === "FERTILIZER" ? "тор" : "култура"}
        options={options}
        prices={category === "CROP" ? ctx.prices : undefined}
        favorites={category === "CROP" ? ctx.favorites : undefined}
        choice={choice}
        custom={custom}
        onChoice={setChoice}
        onCustom={setCustom}
        placeholder={category === "SEED" ? "Семена пшеница" : "Пшеница хлебна"}
        error={form.fields.title}
      />

      <PriceRow
        label="Цена"
        price={price}
        onPrice={setPrice}
        unit={unit}
        onUnit={setUnit}
        placeholder="195"
        errors={{ price: form.fields.price, unit: form.fields.unit }}
      />
      {category === "CROP" ? (
        <MarketHint title={titleOf(choice, custom)} price={price} unit={unit} prices={ctx.prices} onUse={setPrice} />
      ) : null}

      <ChoiceGroup
        label="Валидна до"
        options={VALIDITY_CHOICES.map((item) => ({ value: item.value, label: item.label }))}
        value={validity}
        onChange={setValidity}
      />

      <TextField
        label="Бележка (по избор)"
        value={note}
        onChangeText={setNote}
        placeholder="Франко склад"
        maxLength={300}
        error={form.fields.note}
      />

      <Button
        title="Публикувай оферта"
        onPress={submit}
        loading={create.isPending}
        disabled={!titleOf(choice, custom).trim() || !price.trim()}
      />
    </View>
  );
}

export function ListingForm({ crops }: { crops: CatalogOption[] }) {
  const create = useCreateListing();
  const form = useFormErrors();
  const [success, setSuccess] = useState<string | null>(null);

  const [choice, setChoice] = useState("");
  const [custom, setCustom] = useState("");
  const [quantity, setQuantity] = useState("");
  const [askPrice, setAskPrice] = useState("");
  const [unit, setUnit] = useState("€/т");
  const [hectolitre, setHectolitre] = useState("");
  const [protein, setProtein] = useState("");
  const [gluten, setGluten] = useState("");
  const [note, setNote] = useState("");
  const [showSample, setShowSample] = useState(false);
  const ctx = useMarketContext();
  const title = titleOf(choice, custom);
  const sampleCount = [hectolitre, protein, gluten].filter((value) => value.trim()).length;

  function reset() {
    setChoice("");
    setCustom("");
    setQuantity("");
    setAskPrice("");
    setUnit("€/т");
    setHectolitre("");
    setProtein("");
    setGluten("");
    setNote("");
    setShowSample(false);
  }

  function submit() {
    form.clear();
    setSuccess(null);
    create.mutate(
      {
        title: titleOf(choice, custom),
        quantityT: normalizeDecimal(quantity),
        askPrice: normalizeDecimal(askPrice),
        unit,
        note,
        hectolitre: normalizeDecimal(hectolitre),
        protein: normalizeDecimal(protein),
        gluten: normalizeDecimal(gluten),
      },
      {
        onSuccess: () => {
          setSuccess("Обявата е публикувана успешно.");
          reset();
        },
        onError: (e) =>
          form.fail(e, [
            "title",
            "quantityT",
            "askPrice",
            "unit",
            "note",
            "hectolitre",
            "protein",
            "gluten",
          ]),
      },
    );
  }

  return (
    <View style={{ gap: space.lg }}>
      <FormMessage error={form.error} success={success} />

      <Section step={1} title="Какво продаваш">
        <CatalogPicker
          label="Култура"
          noun="култура"
          options={crops}
          choice={choice}
          custom={custom}
          onChoice={setChoice}
          onCustom={setCustom}
          placeholder="Люцерна"
          error={form.fields.title}
          prices={ctx.prices}
          favorites={ctx.favorites}
        />
      </Section>

      <Section step={2} title="Количество и цена">
        <TextField
          label="Количество"
          value={quantity}
          onChangeText={(text) => setQuantity(numericInput(text))}
          placeholder="500"
          keyboardType="decimal-pad"
          suffix="т"
          error={form.fields.quantityT}
        />
        <PriceRow
          label="Желана цена (по избор)"
          price={askPrice}
          onPrice={setAskPrice}
          unit={unit}
          onUnit={setUnit}
          placeholder="200"
          errors={{ price: form.fields.askPrice, unit: form.fields.unit }}
        />
        <MarketHint title={title} price={askPrice} unit={unit} prices={ctx.prices} onUse={setAskPrice} />
      </Section>

      <View style={styles.section}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showSample }}
          onPress={() => setShowSample((open) => !open)}
          style={({ pressed }) => [styles.sectionHeader, pressed && pressedStyle]}
        >
          <StepBadge step={3} />
          <View style={{ flex: 1 }}>
            <AppText variant="small" bold>
              Качество на пробата
            </AppText>
            <AppText variant="caption" tone="muted">
              {sampleCount ? `Попълнени ${sampleCount} от 3` : "По избор — помага да получиш по-добра цена"}
            </AppText>
          </View>
          <Icon name={showSample ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
        </Pressable>
        {showSample ? (
          <View style={styles.sampleRow}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Хектолитър"
                value={hectolitre}
                onChangeText={(text) => setHectolitre(numericInput(text))}
                placeholder="76"
                keyboardType="decimal-pad"
                suffix="кг/хл"
                error={form.fields.hectolitre}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Протеин"
                value={protein}
                onChangeText={(text) => setProtein(numericInput(text))}
                placeholder="12.5"
                keyboardType="decimal-pad"
                suffix="%"
                error={form.fields.protein}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Глутен"
                value={gluten}
                onChangeText={(text) => setGluten(numericInput(text))}
                placeholder="24"
                keyboardType="decimal-pad"
                suffix="%"
                error={form.fields.gluten}
              />
            </View>
          </View>
        ) : null}
      </View>

      <Section step={4} title="Бележка (по избор)">
        <TextField
          label="Бележка"
          value={note}
          onChangeText={setNote}
          placeholder="Реколта 2026, налична от склад"
          maxLength={300}
          multiline
          hint={`${note.length}/300`}
          error={form.fields.note}
        />
      </Section>

      <Button
        title="Публикувай обява"
        icon="send"
        onPress={submit}
        loading={create.isPending}
        disabled={!title.trim() || !quantity.trim()}
      />
      {!title.trim() || !quantity.trim() ? (
        <AppText variant="caption" tone="muted" align="center">
          Избери култура и въведи количество, за да публикуваш.
        </AppText>
      ) : null}
    </View>
  );
}

function StepBadge({ step }: { step: number }) {
  return (
    <View style={styles.step}>
      <AppText variant="caption" bold style={{ color: colors.brand[700] }}>
        {step}
      </AppText>
    </View>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <StepBadge step={step} />
        <AppText variant="small" bold style={{ flex: 1 }}>
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

/** Price and unit side by side, so the unit reads as part of the price. */
function PriceRow({
  label,
  price,
  onPrice,
  unit,
  onUnit,
  placeholder,
  errors,
}: {
  label: string;
  price: string;
  onPrice: (value: string) => void;
  unit: string;
  onUnit: (value: string) => void;
  placeholder: string;
  errors: { price?: string; unit?: string };
}) {
  return (
    <View style={{ flexDirection: "row", gap: space.sm }}>
      <View style={{ flex: 2 }}>
        <TextField
          label={label}
          value={price}
          onChangeText={(text) => onPrice(numericInput(text))}
          placeholder={placeholder}
          keyboardType="decimal-pad"
          error={errors.price}
        />
      </View>
      <View style={{ flex: 1 }}>
        <TextField label="Мярка" value={unit} onChangeText={onUnit} maxLength={12} error={errors.unit} />
      </View>
    </View>
  );
}

/** Today's market price for the chosen crop, how the typed price compares, and a one-tap fill. */
function MarketHint({
  title,
  price,
  unit,
  prices,
  onUse,
}: {
  title: string;
  price: string;
  unit: string;
  prices?: Parameters<typeof findMarketRow>[1];
  onUse: (value: string) => void;
}) {
  const row = title ? findMarketRow(title, prices) : null;
  if (!row) return null;

  const typed = Number(normalizeDecimal(price));
  const delta = price.trim() && Number.isFinite(typed) ? marketDelta(typed, unit, row) : null;
  const tone = delta == null || Math.abs(delta) < 0.5 ? "muted" : delta > 0 ? "up" : "down";

  return (
    <View style={styles.hint}>
      <Icon name="stats-chart" size={16} color={colors.brand[600]} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="caption">
          Пазарна цена днес: <AppText variant="caption" bold>{formatPrice(row.price, row.unit)}</AppText>
        </AppText>
        {delta != null ? (
          <AppText variant="caption" tone={tone} bold>
            {Math.abs(delta) < 0.5
              ? "Колкото пазара"
              : `${delta > 0 ? "+" : "−"}${Math.abs(Math.round(delta))}% ${delta > 0 ? "над" : "под"} пазара`}
          </AppText>
        ) : null}
      </View>
      {String(row.price) !== normalizeDecimal(price) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Използвай пазарната цена"
          hitSlop={8}
          onPress={() => onUse(String(row.price))}
          style={({ pressed }) => [styles.use, pressed && pressedStyle]}
        >
          <AppText variant="caption" tone="brand" bold>
            Използвай
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: space.sm },
  step: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand[50],
    alignItems: "center",
    justifyContent: "center",
  },
  sampleRow: { flexDirection: "row", gap: space.sm },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
  },
  use: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
});
