import { View } from "react-native";

import { CROP_QUALITY_FIELDS, QUALITY_LABELS, type CropQuality } from "@/api/schemas";
import { formatNumber } from "@/lib/format";
import { space } from "@/theme/tokens";
import { AppText } from "@/ui/Text";

export function CropQualitySpecs({ quality }: { quality?: CropQuality | null }) {
  if (!quality) return null;
  const fields = CROP_QUALITY_FIELDS[quality.cropSlug].flatMap((field) => {
    const value = quality[field];
    return value === undefined ? [] : [{ field, value }];
  });
  if (!fields.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {fields.map(({ field, value }) => (
        <AppText key={field} variant="caption" tone="muted">
          {QUALITY_LABELS[field]} {formatNumber(value, 2)}%
        </AppText>
      ))}
    </View>
  );
}
