import { Modal, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRegions } from "@/api/queries";
import {
  LOGISTICS_CAPABILITIES, LOGISTICS_STATUSES, LOGISTICS_MAP_CATEGORIES, type LogisticsFilters as Filters,
} from "@/lib/logistics";
import { colors, space } from "@/theme/tokens";
import { Button, ChoiceGroup, TextField } from "@/ui/forms";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { AppText } from "@/ui/Text";

export function LogisticsFilters({
  open, value, hasCenter, error, onChange, onApply, onClose, onReset,
}: {
  open: boolean; value: Filters; hasCenter: boolean; error: string | null;
  onChange: (value: Filters) => void; onApply: () => void; onClose: () => void; onReset: () => void;
}) {
  const insets = useSafeAreaInsets();
  const regions = useRegions();
  function change(field: keyof Filters, next: string) { onChange({ ...value, [field]: next }); }
  return <Modal visible={open} animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top + space.md }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: space.lg }}>
        <AppText variant="heading" accessibilityRole="header">Филтри за логистика</AppText>
        <Button title="Затвори" variant="ghost" compact onPress={onClose} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.lg }}>
        <TextField label="Име / оператор" value={value.q} onChangeText={(text) => change("q", text)} maxLength={200} />
        <QueryBoundary query={regions} stamp={false}>
          {(data) => <ChoiceGroup label="Област" value={value.region} onChange={(text) => change("region", text)}
            options={[{ value: "", label: "Всички области" }, ...data.regions.map((region) => ({ value: region.slug, label: region.name }))]} />}
        </QueryBoundary>
        <TextField label="Община" value={value.municipality} onChangeText={(text) => change("municipality", text)} maxLength={200} />
        <TextField label="Населено място" value={value.city} onChangeText={(text) => change("city", text)} maxLength={200} />
        <ChoiceGroup label="Тип" value={value.type} onChange={(text) => change("type", text)}
          options={[{ value: "", label: "Всички типове" }, ...Object.entries(LOGISTICS_MAP_CATEGORIES).map(([key, label]) => ({ value: key, label }))]} />
        <ChoiceGroup label="Статус" value={value.status} onChange={(text) => change("status", text)}
          options={[{ value: "", label: "Всички статуси" }, ...Object.entries(LOGISTICS_STATUSES).map(([key, label]) => ({ value: key, label }))]} />
        {LOGISTICS_CAPABILITIES.filter(([key]) => key !== "operational").map(([key, , label]) => <ChoiceGroup
          key={key} label={label} value={value[key as keyof Filters]} onChange={(text) => change(key as keyof Filters, text)}
          options={[{ value: "", label: "Всички (вкл. неизвестни)" }, { value: "true", label: "Проверено: да" }, { value: "false", label: "Проверено: не" }]} />)}
        <TextField label="Текуща проверка след (YYYY-MM-DD)" value={value.verifiedAfter}
          onChangeText={(text) => change("verifiedAfter", text)} placeholder="2026-10-31" maxLength={10} />
        {hasCenter && <ChoiceGroup label="Радиус по права линия" value={value.radius} onChange={(text) => change("radius", text)}
          options={[25, 50, 100, 200].map((number) => ({ value: String(number), label: `${number} км` }))} />}
        <ChoiceGroup label="Подреждане" value={value.sort} onChange={(text) => change("sort", text)}
          options={[{ value: "verification", label: "Проверени първо" }, { value: "name", label: "Име" },
            ...(hasCenter ? [{ value: "distance", label: "Разстояние" }] : [])]} />
        <AppText variant="caption" tone="muted">Населеното място търси в записите; не е геокодиране. Неизвестните възможности не се третират като „не“.</AppText>
        {error && <AppText accessibilityRole="alert" tone="danger">{error}</AppText>}
        <Button title="Приложи филтрите" onPress={onApply} />
        <Button title="Изчисти филтрите" variant="secondary" onPress={onReset} />
      </ScrollView>
    </View>
  </Modal>;
}
