import { View } from "react-native";
import type { PublicLogisticsFacility } from "@/api/schemas";
import { LOGISTICS_CAPABILITIES, LOGISTICS_CHECKS, LOGISTICS_COLORS, LOGISTICS_STATUSES, LOGISTICS_TYPES, LOGISTICS_LOCATION_TYPES } from "@/lib/logistics";
import { space } from "@/theme/tokens";
import { AppText } from "@/ui/Text";
import { formatShortDate } from "@/lib/format";
import { openLogisticsUrl } from "@/lib/logistics-links";
import { Button } from "@/ui/forms";
import { LogisticsCategoryIcon } from "@/ui/LogisticsCategoryIcon";
import { Notice } from "@/ui/QueryBoundary";

export function LogisticsSummary({ item, capabilities = false, mapCard = false }: { item: PublicLogisticsFacility; capabilities?: boolean; mapCard?: boolean }) {
  const approximate = item.locationType === "CITY_APPROXIMATE";
  const address = [item.city, item.municipality, item.address].filter((value) => value?.trim()).join(" · ");
  const hasContacts = [item.contactPerson, item.contactPhone, item.contactEmail, item.website].some((value) => value?.trim());
  return <View style={{ gap: space.sm }}>
    <AppText variant="heading" accessibilityRole="header">{item.name}</AppText>
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      <LogisticsCategoryIcon type={item.type} color={LOGISTICS_COLORS[item.status]} />
      <AppText variant="small" tone="muted" style={{ flex: 1 }}>{LOGISTICS_TYPES[item.type as keyof typeof LOGISTICS_TYPES] ?? item.type}</AppText>
    </View>
    {!(approximate && item.status === "UNVERIFIED") && <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: LOGISTICS_COLORS[item.status] }} />
      <AppText variant="small" bold style={{ flex: 1 }}>{LOGISTICS_STATUSES[item.status]}</AppText>
    </View>}
    {address && <AppText variant="small" tone="muted">{address}</AppText>}
    {approximate ? <Notice tone="warn">Приблизително място — ориентир за населеното място, не точният обект. Не използвай за доставка; потвърди адреса и входа с оператора.</Notice> :
      <AppText variant="caption" bold>{LOGISTICS_LOCATION_TYPES[item.locationType ?? "UNKNOWN"]}</AppText>}
    {!approximate && !item.sources.length && <AppText variant="caption" tone="muted">Няма добавен източник. Публикацията не е проверка на информацията.</AppText>}
    {item.distanceKm !== null && <AppText variant="small">{item.distanceKm.toFixed(1)} км по права линия — не пътен маршрут</AppText>}
    {mapCard && <>
      {item.description && <AppText variant="small" numberOfLines={4}>{item.description}</AppText>}
      {item.operatorName?.trim() && <AppText variant="small">Оператор: {item.operatorName}</AppText>}
      {item.contactPerson?.trim() && <AppText variant="small">Лице за контакт: {item.contactPerson}</AppText>}
      {item.contactPhone?.trim() && <AppText variant="small">Телефон: {item.contactPhone}</AppText>}
      {item.contactEmail?.trim() && <AppText variant="small">Имейл: {item.contactEmail}</AppText>}
      {hasContacts && <AppText variant="caption" tone="muted">Контакти: {LOGISTICS_CHECKS[item.claims.CONTACTS] ?? "Очаква проверка"}</AppText>}
      {item.website && <Button title="Сайт на оператора" compact variant="secondary" onPress={() => void openLogisticsUrl(item.website!)} />}
      {item.lastVerifiedAt && <AppText variant="caption" tone="muted">Последна текуща проверка: {formatShortDate(new Date(item.lastVerifiedAt))}</AppText>}
    </>}
    {capabilities && LOGISTICS_CAPABILITIES.filter(([, field]) => typeof item[field] === "boolean").map(([, field, label, claim]) => <AppText key={field} variant="small">
      {label}: {item[field] ? "Да" : "Не"} · {LOGISTICS_CHECKS[item.claims[claim]] ?? "Очаква проверка"}
    </AppText>)}
    {mapCard && item.sources.slice(0, 1).map((source) => <View key={source.id} style={{ gap: 4 }}>
      <AppText variant="caption" tone="muted">Източник: {source.sourceName} · проверен {formatShortDate(new Date(source.checkedAt))}</AppText>
      <Button title="Отвори източника" compact variant="ghost" onPress={() => void openLogisticsUrl(source.sourceUrl)} />
    </View>)}
  </View>;
}
