import { useLocalSearchParams } from "expo-router";
import { useLogisticsFacility } from "@/api/queries";
import { logisticsCoordinates, LOGISTICS_CHECKS } from "@/lib/logistics";
import { openLogisticsUrl as openUrl } from "@/lib/logistics-links";
import { formatShortDate } from "@/lib/format";
import { Button } from "@/ui/forms";
import { LogisticsSummary } from "@/ui/LogisticsSummary";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Card } from "@/ui/primitives";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";
import { space } from "@/theme/tokens";

const CAPACITY_FIELDS = [
  ["grainStorageTons", "Склад (т)"], ["loadingCapacityTPH", "Товарене (т/ч)"], ["unloadingCapacityTPH", "Разтоварване (т/ч)"],
  ["railwayTracks", "Брой коловози"], ["trackLengthMeters", "Коловози (м)"],
] as const;
const CONTACT_FIELDS = [
  ["operatorName", "Оператор"], ["contactPerson", "Лице за контакт"],
  ["contactPhone", "Телефон"], ["contactEmail", "Имейл"],
] as const;

export default function LogisticsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const facility = useLogisticsFacility(typeof id === "string" ? id : null);
  return <Screen title="Логистичен обект" back="/map" onRefresh={() => void facility.refetch()} refreshing={facility.isRefetching}>
    <QueryBoundary query={facility}>
      {(item) => <Card style={{ gap: space.md }}>
        <LogisticsSummary item={item} capabilities />
        {item.lastVerifiedAt && <AppText variant="small">Последна текуща проверка: {formatShortDate(new Date(item.lastVerifiedAt))}</AppText>}
        {logisticsCoordinates(item) && <AppText variant="small">Координати: {item.latitude}, {item.longitude} · {item.locationType === "CITY_APPROXIMATE" ? "Приблизително място" : LOGISTICS_CHECKS[item.claims.COORDINATES] ?? "Очаква проверка"}</AppText>}
        {CAPACITY_FIELDS.filter(([key]) => item[key] !== null).map(([key, label]) =>
          <AppText variant="small" key={key}>{label}: {item[key]}</AppText>)}
        {CAPACITY_FIELDS.some(([key]) => item[key] !== null) && <AppText variant="small">Капацитети: {LOGISTICS_CHECKS[item.claims.CAPACITIES] ?? "Очаква проверка"}</AppText>}
        {item.description?.trim() && <AppText>{item.description}</AppText>}
        {(CONTACT_FIELDS.some(([key]) => item[key]?.trim()) || item.website) && <>
          <AppText variant="heading">Контакти</AppText>
          {(CONTACT_FIELDS.some(([key]) => key !== "operatorName" && item[key]?.trim()) || item.website) &&
            <AppText variant="small">{LOGISTICS_CHECKS[item.claims.CONTACTS] ?? "Очаква проверка"}</AppText>}
          {CONTACT_FIELDS.filter(([key]) => item[key]?.trim()).map(([key, label]) =>
            <AppText variant="small" key={key}>{label}: {item[key]}</AppText>)}
        </>}
        {item.website && <Button title="Сайт на оператора" variant="secondary" onPress={() => void openUrl(item.website!)} />}
        {!!item.sources.length && <AppText variant="heading">Източници</AppText>}
        {item.sources.map((source) => <Card key={source.id} style={{ gap: space.sm }}>
          <AppText bold>{source.sourceName}</AppText>
          {source.reference?.trim() && <AppText variant="small">{source.reference}</AppText>}
          <AppText variant="caption" tone="muted">{source.publishedAt ? `Публикуван: ${formatShortDate(new Date(source.publishedAt))} · ` : ""}Проверен: {formatShortDate(new Date(source.checkedAt))}</AppText>
          <Button title={`Отвори източник: ${source.sourceName}`} variant="ghost" onPress={() => void openUrl(source.sourceUrl)} />
        </Card>)}
        <AppText variant="caption" tone="muted">Непроверените и изтекли данни не потвърждават текуща дейност. Потвърди условията с оператора преди транспорт.</AppText>
        {item.locationType !== "CITY_APPROXIMATE" && logisticsCoordinates(item) && <Button title="Отвори външна навигация" icon="navigate-outline"
          onPress={() => void openUrl(`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`)} />}
      </Card>}
    </QueryBoundary>
  </Screen>;
}
