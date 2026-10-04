import { useState } from "react";
import { View } from "react-native";

import { isApiError } from "@/api/client";
import { useCreateListing, useCreateOffer } from "@/api/queries";
import { VALIDITY_CHOICES, normalizeDecimal, validUntil, type ValidityValue } from "@/lib/forms";
import { space } from "@/theme/tokens";
import { Button, ChoiceGroup, FormMessage, TextField } from "@/ui/forms";
import { AppText } from "@/ui/Text";

export type CatalogOption = { slug: string; name: string; emoji?: string };

const OTHER = "__other__";

/**
 * A name picked from the catalogue, or typed when it is not listed. With no
 * catalogue (seeds) it is plain text, as on the web.
 */
function CatalogField({
  label,
  options,
  choice,
  custom,
  onChoice,
  onCustom,
  placeholder,
  error,
}: {
  label: string;
  options: CatalogOption[];
  choice: string;
  custom: string;
  onChoice: (value: string) => void;
  onCustom: (value: string) => void;
  placeholder: string;
  error?: string;
}) {
  const freeText = !options.length || choice === OTHER;

  return (
    <View style={{ gap: space.md }}>
      {options.length ? (
        <ChoiceGroup
          label={label}
          options={[
            ...options.map((option) => ({
              value: option.name,
              label: `${option.emoji ? `${option.emoji} ` : ""}${option.name}`,
            })),
            { value: OTHER, label: "Друго…" },
          ]}
          value={choice}
          onChange={onChoice}
        />
      ) : null}
      {freeText ? (
        <TextField
          label={options.length ? "Друго наименование" : label}
          value={custom}
          onChangeText={onCustom}
          placeholder={placeholder}
          maxLength={120}
          error={error}
        />
      ) : error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
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

      <CatalogField
        label="Наименование"
        options={options}
        choice={choice}
        custom={custom}
        onChoice={setChoice}
        onCustom={setCustom}
        placeholder={category === "SEED" ? "Семена пшеница" : "Пшеница хлебна"}
        error={form.fields.title}
      />

      <TextField
        label="Цена"
        value={price}
        onChangeText={setPrice}
        placeholder="195"
        keyboardType="decimal-pad"
        error={form.fields.price}
      />
      <TextField label="Мярка" value={unit} onChangeText={setUnit} maxLength={12} error={form.fields.unit} />

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
    <View style={{ gap: space.md }}>
      <FormMessage error={form.error} success={success} />

      <CatalogField
        label="Какво продаваш"
        options={crops}
        choice={choice}
        custom={custom}
        onChoice={setChoice}
        onCustom={setCustom}
        placeholder="Люцерна"
        error={form.fields.title}
      />

      <TextField
        label="Количество (т)"
        value={quantity}
        onChangeText={setQuantity}
        placeholder="500"
        keyboardType="decimal-pad"
        error={form.fields.quantityT}
      />
      <TextField
        label="Желана цена (по избор)"
        value={askPrice}
        onChangeText={setAskPrice}
        placeholder="200"
        keyboardType="decimal-pad"
        error={form.fields.askPrice}
      />
      <TextField label="Мярка" value={unit} onChangeText={setUnit} maxLength={12} error={form.fields.unit} />

      <View style={{ gap: space.md }}>
        <AppText variant="caption" tone="muted" bold>
          Проба (по избор)
        </AppText>
        <TextField
          label="Хектолитър (кг/хл)"
          value={hectolitre}
          onChangeText={setHectolitre}
          placeholder="76"
          keyboardType="decimal-pad"
          error={form.fields.hectolitre}
        />
        <TextField
          label="Протеин (%)"
          value={protein}
          onChangeText={setProtein}
          placeholder="12.5"
          keyboardType="decimal-pad"
          error={form.fields.protein}
        />
        <TextField
          label="Глутен (%)"
          value={gluten}
          onChangeText={setGluten}
          placeholder="24"
          keyboardType="decimal-pad"
          error={form.fields.gluten}
        />
      </View>

      <TextField
        label="Бележка (по избор)"
        value={note}
        onChangeText={setNote}
        placeholder="Реколта 2026, налична от склад"
        maxLength={300}
        multiline
        error={form.fields.note}
      />

      <Button
        title="Публикувай обява"
        onPress={submit}
        loading={create.isPending}
        disabled={!titleOf(choice, custom).trim() || !quantity.trim()}
      />
    </View>
  );
}
