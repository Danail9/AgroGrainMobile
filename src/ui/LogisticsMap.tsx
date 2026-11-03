import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import type { LogisticsMapData } from "@/api/schemas";
import { LOGISTICS_COLORS, LOGISTICS_STATUSES } from "@/lib/logistics";
import { Icon } from "@/ui/Icon";
import { AppText } from "@/ui/Text";
import { colors, shadowCard } from "@/theme/tokens";
import { LogisticsCategoryIcon } from "@/ui/LogisticsCategoryIcon";

const BULGARIA: Region = { latitude: 42.7, longitude: 25.4, latitudeDelta: 3.8, longitudeDelta: 6.8 };
type Feature = LogisticsMapData["features"][number];

export function logisticsMarkerGroups(features: Feature[], region: Region) {
  const cells = new Map<string, Feature[]>();
  const latStep = Math.max(region.latitudeDelta / 7, 0.00001);
  const lngStep = Math.max(region.longitudeDelta / 7, 0.00001);
  for (const feature of features) {
    const [lng, lat] = feature.geometry.coordinates;
    const key = `${Math.floor(lat / latStep)},${Math.floor(lng / lngStep)}`;
    const cell = cells.get(key);
    if (cell) cell.push(feature);
    else cells.set(key, [feature]);
  }
  const groups = [...cells.values()];
  const center = (items: Feature[]) => [
    items.reduce((sum, item) => sum + item.geometry.coordinates[0], 0) / items.length,
    items.reduce((sum, item) => sum + item.geometry.coordinates[1], 0) / items.length,
  ];
  // Merge neighbouring grid cells whose markers would overlap at overview zoom.
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < groups.length && !merged; i++) {
      const a = center(groups[i]);
      for (let j = i + 1; j < groups.length; j++) {
        const b = center(groups[j]);
        const distance = Math.hypot((a[0] - b[0]) / (lngStep * 0.9), (a[1] - b[1]) / (latStep * 0.5));
        if (distance < 1) {
          groups[i].push(...groups[j]); groups.splice(j, 1); merged = true; break;
        }
      }
    }
  }
  return groups;
}

export function LogisticsMap({ data, selectedPoint, selectedCategory, resetView = 0, onBounds, onSelect, onSelectGroup }: {
  data: LogisticsMapData | null; selectedPoint: [number, number] | null;
  selectedCategory?: string;
  resetView?: number;
  onBounds: (bbox: string) => void; onSelect: (id: string) => void;
  onSelectGroup: (features: Feature[]) => void;
}) {
  const map = useRef<MapView>(null);
  const [region, setRegion] = useState(BULGARIA);
  const currentRegion = useRef(BULGARIA);
  const overview = useRef<Region | null>(null);
  const lastReset = useRef(resetView);
  const groups = useMemo(() => logisticsMarkerGroups(data?.features ?? [], region), [data, region]);
  useEffect(() => {
    if (selectedPoint) {
      overview.current ??= currentRegion.current;
      map.current?.animateToRegion({
        latitude: selectedPoint[1], longitude: selectedPoint[0], latitudeDelta: 0.06, longitudeDelta: 0.06,
      }, 300);
    }
  }, [selectedPoint]);
  useEffect(() => {
    if (lastReset.current === resetView) return;
    lastReset.current = resetView;
    const target = overview.current ?? BULGARIA;
    overview.current = null;
    map.current?.animateToRegion(target, 300);
  }, [resetView]);
  function changed(next: Region) {
    currentRegion.current = next;
    setRegion(next);
    const west = Math.max(-180, next.longitude - next.longitudeDelta / 2);
    const east = Math.min(180, next.longitude + next.longitudeDelta / 2);
    const south = Math.max(-90, next.latitude - next.latitudeDelta / 2);
    const north = Math.min(90, next.latitude + next.latitudeDelta / 2);
    if (west < east && south < north) onBounds([west, south, east, north].map((value) => value.toFixed(6)).join(","));
  }
  return <><MapView ref={map} testID="native-map" style={StyleSheet.absoluteFill}
    provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
    initialRegion={BULGARIA} userInterfaceStyle="light" mapType="standard"
    showsUserLocation={false} showsMyLocationButton={false} showsCompass
    showsPointsOfInterests={false} showsTraffic={false} toolbarEnabled={false}
    rotateEnabled={false} pitchEnabled={false}
    onMapReady={() => changed(region)} onRegionChangeComplete={changed}>
    {groups.map((features) => {
      const feature = features[0];
      const cluster = features.length > 1;
      const category = feature.properties.type ?? selectedCategory;
      const categoryCluster = cluster && !!category && features.every((item) => (item.properties.type ?? selectedCategory) === category);
      const longitude = features.reduce((sum, item) => sum + item.geometry.coordinates[0], 0) / features.length;
      const latitude = features.reduce((sum, item) => sum + item.geometry.coordinates[1], 0) / features.length;
      const approximate = features.some((item) => item.properties.locationType === "CITY_APPROXIMATE");
      const title = (cluster ? `${features.length} обекта` : feature.properties.name) + (approximate ? " · приблизително" : "");
      const color = cluster ? "#334155" : LOGISTICS_COLORS[feature.properties.status];
      const showLabel = !cluster && region.latitudeDelta <= 0.25;
      return <Marker key={features.map((item) => item.id).join(",")} testID={`marker-${feature.id}`}
        coordinate={{ latitude, longitude }} title={title}
        description={cluster ? "Натисни за списък на обектите" : LOGISTICS_STATUSES[feature.properties.status]}
        accessibilityLabel={title} onPress={() => {
          overview.current ??= currentRegion.current;
          if (cluster) {
            map.current?.animateToRegion({ latitude, longitude,
              latitudeDelta: Math.max(region.latitudeDelta / 2, 0.002),
              longitudeDelta: Math.max(region.longitudeDelta / 2, 0.002) }, 300);
            onSelectGroup(features);
          } else {
            map.current?.animateToRegion({ latitude, longitude,
              latitudeDelta: Math.min(region.latitudeDelta, 0.06),
              longitudeDelta: Math.min(region.longitudeDelta, 0.06) }, 300);
            onSelect(feature.properties.id);
          }
        }}>
        <View style={{ width: showLabel ? 150 : 48, alignItems: "center", gap: 3 }}>
          <View style={{ backgroundColor: cluster ? color : "#ffffff", borderColor: color, borderWidth: 2,
            borderStyle: approximate ? "dashed" : "solid",
            borderRadius: 22, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            {cluster ? categoryCluster ? <View style={{ alignItems: "center" }}>
              <LogisticsCategoryIcon type={category} size={19} color="#ffffff" />
              <AppText variant="caption" bold style={{ color: "#ffffff" }}>{features.length}</AppText>
            </View> : <AppText bold style={{ color: "#ffffff" }}>{features.length}</AppText>
              : <LogisticsCategoryIcon type={category} size={26} color={color} />}
          </View>
          {showLabel && <AppText variant="caption" numberOfLines={1} bold style={{ color: "#111827",
            backgroundColor: "#ffffff", borderRadius: 6, paddingHorizontal: 5 }}>{title}</AppText>}
        </View>
      </Marker>;
    })}
  </MapView>
    <Pressable accessibilityRole="button" accessibilityLabel="Общ изглед на България"
      accessibilityHint="Връща картата към всички области, без да променя филтрите"
      onPress={() => {
        overview.current = null;
        map.current?.animateToRegion(BULGARIA, 300);
      }}
      style={({ pressed }) => ({ position: "absolute", bottom: 24, right: 12, width: 48, height: 48,
        alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: colors.white,
        borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.7 : 1, ...shadowCard })}>
      <Icon name="scan-outline" size={24} color={colors.brand[600]} />
    </Pressable>
  </>;
}
