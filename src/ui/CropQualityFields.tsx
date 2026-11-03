import { useState } from "react";
import { View } from "react-native";

import {
  CROP_QUALITY_FIELDS, QUALITY_LABELS, cropQualitySchema, type QualityCrop, type QualityField,
} from "@/api/schemas";
import { normalizeDecimal } from "@/lib/forms";
import { space } from "@/theme/tokens";
import { TextField } from "@/ui/forms";
import { AppText } from "@/ui/Text";

export function useCropQuality() {
  const [values, setValues] = useState<Partial<Record<QualityField, string>>>({});
  return {
    values,
    clear: () => setValues({}),
    change: (field: QualityField, value: string) => setValues((current) => ({ ...current, [field]: value })),
    input(crop: QualityCrop | null) {
      return cropQualitySchema.optional().safeParse(crop ? {
        cropSlug: crop,
        ...Object.fromEntries(CROP_QUALITY_FIELDS[crop].flatMap((field) => {
          const value = normalizeDecimal(values[field] ?? "");
          return value ? [[field, Number(value)]] : [];
        })),
      } : undefined);
    },
  };
}

export function CropQualityFields({
  crop, values, onChange, errors,
}: {
  crop: QualityCrop;
  values: Partial<Record<QualityField, string>>;
  onChange: (field: QualityField, value: string) => void;
  errors: Partial<Record<string, string>>;
}) {
  if (!CROP_QUALITY_FIELDS[crop].length) {
    return (
      <AppText variant="caption" tone="muted">
        Показателите за качество на пивоварния ечемик очакват потвърждение от ръководството.
      </AppText>
    );
  }
  return (
    <View style={{ gap: space.md }}>
      <AppText variant="small" bold>Качество (по избор)</AppText>
      {CROP_QUALITY_FIELDS[crop].map((field) => (
        <TextField key={field} label={QUALITY_LABELS[field]} suffix="%" keyboardType="decimal-pad"
          value={values[field] ?? ""} onChangeText={(value) => onChange(field, value)}
          hint="От 0 до 100%" error={errors[`quality.${field}`]} />
      ))}
    </View>
  );
}
