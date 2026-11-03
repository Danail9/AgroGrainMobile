import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import Constants from "expo-constants";
import { router } from "expo-router";
import { FlatList, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";
import { useLogistics, useLogisticsFacility, useLogisticsMap, useMe } from "@/api/queries";
import { isApiError } from "@/api/client";
import type { LogisticsMapData, PublicLogisticsFacility } from "@/api/schemas";
import {
  EMPTY_LOGISTICS_FILTERS, LOGISTICS_COLORS, LOGISTICS_STATUSES, LOGISTICS_MAP_CATEGORIES, logisticsCoordinates,
  logisticsQuery, type LogisticsFilters as Filters,
} from "@/lib/logistics";
import { reportError } from "@/lib/monitoring";
import { openLogisticsUrl } from "@/lib/logistics-links";
import { colors, shadowCard, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { LogisticsCategoryIcon } from "@/ui/LogisticsCategoryIcon";
import { Button } from "@/ui/forms";
import { LogisticsFilters } from "@/ui/LogisticsFilters";
import { LogisticsMap } from "@/ui/LogisticsMap";
import { LogisticsSummary } from "@/ui/LogisticsSummary";
import { QueryBoundary, Notice } from "@/ui/QueryBoundary";
import { Card } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export default function LogisticsScreen() {
  const mapAvailable = Platform.OS === "ios" ||
    (Platform.OS === "android" && Constants.expoConfig?.extra?.androidMapsConfigured === true);
  const [view, setView] = useState<"map" | "list">(mapAvailable ? "map" : "list");
  const [query, setQuery] = useState("");
  const [legendOpen, setLegendOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Filters>({ ...EMPTY_LOGISTICS_FILTERS });
  const [applied, setApplied] = useState<Filters>({ ...EMPTY_LOGISTICS_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [bbox, setBbox] = useState<string | null>(null);
  const boundsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [group, setGroup] = useState<LogisticsMapData["features"]>([]);
  const [selectedListItem, setSelectedListItem] = useState<PublicLogisticsFacility | null>(null);
  const [groupPoint, setGroupPoint] = useState<[number, number] | null>(null);
  const [resetView, setResetView] = useState(0);
  const [accountRegionOnly, setAccountRegionOnly] = useState(false);
  const me = useMe();
  const accountRegion = me.data?.user.regionSlug;
  const listParams = new URLSearchParams(query);
  if (accountRegionOnly && accountRegion) {
    listParams.set("region", accountRegion);
  }
  const listRef = useRef<FlatList<PublicLogisticsFacility>>(null);
  const insets = useSafeAreaInsets();
  const list = useLogistics(accountRegionOnly && accountRegion ? listParams.toString() : query, page,
    view === "list" && (!accountRegionOnly || !!accountRegion));
  const map = useLogisticsMap(query, bbox, mapAvailable && view === "map");
  const selected = useLogisticsFacility(selectedId);
  const selectedPoint = useMemo(() => selectedListItem ? logisticsCoordinates(selectedListItem) : groupPoint, [selectedListItem, groupPoint]);
  useEffect(() => () => { if (boundsTimer.current) clearTimeout(boundsTimer.current); }, []);
  const changeBounds = useCallback((next: string) => {
    if (boundsTimer.current) clearTimeout(boundsTimer.current);
    boundsTimer.current = setTimeout(() => setBbox(next), 250);
  }, []);
  function apply(filters: Filters) {
    try {
      setQuery(logisticsQuery(filters, null)); setApplied(filters); setDraft(filters); setPage(1);
      setFilterError(null); setFiltersOpen(false); setSelectedId(null); setSelectedListItem(null); setGroup([]);
      setGroupPoint(null);
      setResetView((value) => value + 1);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    } catch (error) {
      reportError("Invalid Logistics search filters", error);
      setFilterError(error instanceof z.ZodError ? error.issues[0]?.message ?? "Невалидни филтри." :
        error instanceof Error ? error.message : "Невалидни филтри.");
    }
  }
  function selectItem(item: PublicLogisticsFacility) {
    setSelectedListItem(item); setSelectedId(item.id);
  }
  const mapDataUnavailable = map.isError || map.fetchStatus === "paused";
  const mapError = isApiError(map.error) && map.error.status === 404
    ? "Обектите не се заредиха. Логистичният API още не е публикуван на сървъра."
    : isApiError(map.error) ? `Обектите не се заредиха. ${map.error.message}` :
      "Обектите не се заредиха. Провери връзката и достъпността на сървъра.";
  return <View style={{ flex: 1, backgroundColor: colors.canvas }}>
    {view === "map" && mapAvailable && <LogisticsMap data={mapDataUnavailable ? null : map.data ?? null}
      selectedCategory={applied.type || undefined}
      selectedPoint={selectedPoint} resetView={resetView} onBounds={changeBounds} onSelect={(id) => { setSelectedListItem(null); setGroupPoint(null); setSelectedId(id); }}
      onSelectGroup={setGroup} />}
    <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.md,
      ...(view === "map" ? { position: "absolute", top: 0, left: 0, right: 0 } as const : {}) }}>
      <View style={{ backgroundColor: colors.white, borderRadius: 20, padding: space.sm, gap: space.sm,
        borderWidth: 1, borderColor: colors.line, ...shadowCard }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.soft, borderRadius: 14, padding: 3 }}>
            {(mapAvailable ? ["map", "list"] as const : ["list"] as const).map((mode) =>
              <Pressable key={mode} accessibilityRole="button" accessibilityLabel={mode === "map" ? "Карта" : "Списък"}
                accessibilityState={{ selected: view === mode }} onPress={() => setView(mode)}
                style={({ pressed }) => ({ flex: 1, minHeight: 44, flexDirection: "row", gap: 6,
                  alignItems: "center", justifyContent: "center", borderRadius: 11,
                  backgroundColor: view === mode ? colors.white : "transparent", opacity: pressed ? 0.7 : 1 })}>
                <Icon name={mode === "map" ? "map-outline" : "list-outline"} size={18}
                  color={view === mode ? colors.brand[600] : colors.muted} />
                <AppText variant="small" bold style={{ color: view === mode ? colors.brand[600] : colors.muted }}>
                  {mode === "map" ? "Карта" : "Списък"}
                </AppText>
              </Pressable>)}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Филтри" accessibilityHint="Отваря филтрите за обекти"
            onPress={() => { setDraft(applied); setFilterError(null); setFiltersOpen(true); }}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.soft,
              alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
            <Icon name="options-outline" size={22} color={colors.brand[600]} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Легенда" accessibilityHint="Обяснява цветовете и приблизителните пинове"
            onPress={() => setLegendOpen(true)}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.soft,
              alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
            <Icon name="information-circle-outline" size={22} color={colors.brand[600]} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}
          accessibilityLabel="Категории обекти">
          {[["", "Всички категории"], ...Object.entries(LOGISTICS_MAP_CATEGORIES)].map(([type, label]) =>
            <Pressable key={type} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: applied.type === type }}
              onPress={() => apply({ ...applied, type })}
              style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", paddingHorizontal: 12,
                borderRadius: 22, backgroundColor: applied.type === type ? colors.brand[600] : colors.white,
                borderWidth: 1, borderColor: applied.type === type ? colors.brand[600] : colors.line, opacity: pressed ? 0.7 : 1 })}>
              {type && <LogisticsCategoryIcon type={type} size={20} color={applied.type === type ? colors.white : colors.brand[600]} />}
              <AppText variant="caption" bold style={{ color: applied.type === type ? colors.white : colors.ink }}>
                {type ? label : "Всички"}
              </AppText>
            </Pressable>)}
        </ScrollView>
      </View>
      {!mapAvailable && <Notice tone="info">{Platform.OS === "web" ? "Използвай уеб портала за интерактивната карта." :
        "За картата на Android е нужен Google Maps ключ в нов build. Списъкът и филтрите остават достъпни."}</Notice>}
    </View>
    {view === "map" && bbox && <View style={{ position: "absolute", bottom: 24, left: space.md, right: 76 }}>
      {mapDataUnavailable ? <View style={{ gap: space.sm }}>
        <Notice tone="warn">{map.fetchStatus === "paused" ? "Няма връзка. Обектите не са показани; картата остава достъпна." : mapError}</Notice>
        <Button title="Зареди обектите отново" compact variant="secondary" onPress={() => void map.refetch()} />
      </View> : <View style={{ alignSelf: "flex-start", backgroundColor: colors.white, borderRadius: 16,
        paddingHorizontal: space.md, paddingVertical: space.sm, ...shadowCard }}>
        <AppText variant="caption">{map.isPending ? "Зареждане на обектите…" :
          map.data?.features.length ? `Обекти в изгледа: ${map.data.features.length}` :
            "Няма публикувани обекти в този изглед. Промени областта или филтрите."}</AppText>
      </View>}
    </View>}
    {view === "list" && <FlatList ref={listRef} data={list.data?.items ?? []} keyExtractor={(item) => item.id}
      contentContainerStyle={{ gap: space.md, padding: space.md, paddingBottom: space.lg }} keyboardShouldPersistTaps="handled"
      refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); }}
      ListHeaderComponent={<View style={{ gap: space.sm }}>
        <QueryBoundary query={me} stamp={false}>{({ user }) => accountRegion ? <View style={{ gap: space.sm }}>
          <Button title={`Само моят регион: ${user.regionName}`} compact
            variant={accountRegionOnly ? "primary" : "secondary"} selected={accountRegionOnly}
            onPress={() => { setAccountRegionOnly((value) => !value); setPage(1); listRef.current?.scrollToOffset({ offset: 0 }); }} />
          {accountRegionOnly && <Button title="Всички региони" compact variant="ghost"
            onPress={() => { setAccountRegionOnly(false); setPage(1); }} />}
          <AppText variant="caption" tone="muted">Използва областта от профила, без GPS. Останалите филтри остават активни.</AppText>
        </View> : <View style={{ gap: space.sm }}>
          <AppText variant="caption">Няма регион в профила. Добави го, за да търсиш само в него.</AppText>
          <Button title="Настройки на профила" compact variant="ghost" onPress={() => router.push("/settings")} />
        </View>}</QueryBoundary>
        <QueryBoundary query={list}>{(data) => <AppText bold>{data.total} обекта · страница {data.page}</AppText>}</QueryBoundary>
      </View>}
      renderItem={({ item }) => <Card>
        <LogisticsSummary item={item} />
        {!logisticsCoordinates(item) && <AppText variant="caption" tone="muted">Без координати — не е показан на картата</AppText>}
        <Button title={`Отвори ${item.name}`} variant="ghost" onPress={() => selectItem(item)} />
      </Card>}
      ListEmptyComponent={list.data && !list.data.items.length ? <Card><AppText>Няма публикувани обекти за избраните филтри.</AppText></Card> : null}
      ListFooterComponent={list.data ? <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="Предишна" variant="secondary" disabled={page === 1} onPress={() => { setPage((value) => value - 1); listRef.current?.scrollToOffset({ offset: 0 }); }} />
        <Button title="Следваща" variant="secondary" disabled={page * list.data.pageSize >= list.data.total} onPress={() => { setPage((value) => value + 1); listRef.current?.scrollToOffset({ offset: 0 }); }} />
      </View> : null} />}
    <LogisticsFilters open={filtersOpen} value={draft} hasCenter={false} error={filterError} onChange={setDraft}
      onClose={() => setFiltersOpen(false)} onApply={() => apply(draft)} onReset={() => apply({ ...EMPTY_LOGISTICS_FILTERS })} />
    <Modal visible={legendOpen || group.length > 0} transparent animationType="slide" onRequestClose={() => { setLegendOpen(false); setGroup([]); }}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
        <Card style={{ maxHeight: "65%", paddingBottom: insets.bottom + space.md }}>
          <Button title="Затвори" variant="ghost" onPress={() => { setLegendOpen(false); setGroup([]); }} />
          {group.length ? <FlatList data={group} keyExtractor={(feature) => feature.id}
            contentContainerStyle={{ gap: space.sm }}
            renderItem={({ item: feature }) => <Button title={feature.properties.name} variant="secondary"
              onPress={() => { setGroup([]); setSelectedListItem(null); setGroupPoint([...feature.geometry.coordinates]); setSelectedId(feature.properties.id); }} />} /> :
            <ScrollView contentContainerStyle={{ gap: space.sm }}>
              <AppText bold>Категории</AppText>
              {Object.entries(LOGISTICS_MAP_CATEGORIES).map(([type, label]) => <View key={type}
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <LogisticsCategoryIcon type={type} color={colors.brand[600]} />
                <AppText variant="small">{label}</AppText>
              </View>)}
              <AppText bold>Статус на проверката</AppText>
              {Object.entries(LOGISTICS_COLORS).map(([key, color]) => <View key={key} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                <AppText variant="caption" style={{ flex: 1 }}>{LOGISTICS_STATUSES[key as keyof typeof LOGISTICS_STATUSES]}</AppText>
              </View>)}
            <AppText variant="caption" tone="muted">Цветът показва проверката на обекта, не точността на координатите. Обекти без координати са само в списъка.</AppText>
            <AppText variant="caption" tone="muted">Пунктирна рамка: приблизително местоположение. Имената се показват при приближаване. Натисни пин, за да приближиш и видиш подробности.</AppText>
            <AppText variant="caption" tone="muted">Групите от една категория показват нейната икона и брой. Смесените групи показват само брой.</AppText>
            </ScrollView>}
        </Card>
      </View>
    </Modal>
    <Modal visible={!!selectedId} transparent animationType="slide" onRequestClose={() => setSelectedId(null)}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
        <View style={{ maxHeight: "55%", backgroundColor: colors.canvas, padding: space.lg, paddingBottom: insets.bottom + space.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center", marginBottom: space.sm }} />
          <Button title="Затвори обекта" variant="ghost" onPress={() => setSelectedId(null)} />
          <ScrollView contentContainerStyle={{ gap: space.md }}>
            <QueryBoundary query={selected}>
              {(data) => <>
                <LogisticsSummary item={data} capabilities mapCard />
                <AppText variant="caption" tone="muted">Провери източниците и потвърди условията с оператора преди транспорт.</AppText>
                {data.locationType !== "CITY_APPROXIMATE" && logisticsCoordinates(data) && <Button title="Отвори външна навигация" icon="navigate-outline" variant="secondary"
                  onPress={() => void openLogisticsUrl(`https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`)} />}
                <Button title="Всички данни и източници" onPress={() => {
                  setSelectedId(null); router.push({ pathname: "/logistics/[id]", params: { id: data.id } });
                }} />
              </>}
            </QueryBoundary>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}
