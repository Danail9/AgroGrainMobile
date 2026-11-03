import { z } from "zod";
import type { PublicLogisticsFacility } from "@/api/schemas";

export const LOGISTICS_CATEGORIES = {
  MILL: "Мелници", OIL_MILL: "Маслобойни", FEED_PLANT: "Фуражни заводи", BREWERY: "Пивоварни",
  RAILWAY_FREIGHT_STATION: "Товарна гара", GRAIN_TERMINAL: "Зърнен терминал",
  INTERMODAL_TERMINAL: "Интермодален терминал", PORT_TERMINAL: "Пристанищен терминал",
  GRAIN_STORAGE: "Зърнена складова база", PRIVATE_RAIL_SIDING: "Частен жп коловоз", OTHER: "Друг обект",
} as const;
export const LOGISTICS_TYPES = {
  ...LOGISTICS_CATEGORIES, MILLS_AND_OIL_MILLS: "Мелници и маслобойни (стара категория)",
} as const;
export const LOGISTICS_MAP_CATEGORIES = {
  MILL: "Мелници", OIL_MILL: "Маслобойни", FEED_PLANT: "Фуражни заводи",
  BREWERY: "Пивоварни", PORT_TERMINAL: "Пристанища",
} as const;
export const LOGISTICS_STATUSES = {
  VERIFIED_OPERATIONAL: "Проверен действащ зърнен жп обект",
  VERIFIED_INFRASTRUCTURE: "Проверена товарна жп инфраструктура",
  UNVERIFIED: "Очаква проверка", PLANNED: "Планиран",
  TEMPORARILY_INACTIVE: "Временно неактивен", PERMANENTLY_CLOSED: "Окончателно затворен",
} as const;
export const LOGISTICS_CHECKS: Record<string, string> = {
  PENDING: "Очаква проверка", VERIFIED: "Проверено", REJECTED: "Отхвърлено", EXPIRED: "Изтекла / обезсилена проверка",
};
export const LOGISTICS_LOCATION_TYPES = {
  UNKNOWN: "Точността не е потвърдена",
  CITY_APPROXIMATE: "Приблизително населено място — не е точният обект",
  ADDRESS_GEOCODED: "Геокодиран адрес — входът на обекта не е проверен",
  FACILITY_VERIFIED: "Проверено местоположение на обекта",
} as const;
export const LOGISTICS_COLORS = {
  VERIFIED_OPERATIONAL: "#008044", VERIFIED_INFRASTRUCTURE: "#2563eb", UNVERIFIED: "#eab308",
  PLANNED: "#6b7280", TEMPORARILY_INACTIVE: "#6b7280", PERMANENTLY_CLOSED: "#6b7280",
} as const;
export const LOGISTICS_CAPABILITIES = [
  ["rail", "hasRailConnection", "Жп връзка", "RAIL_CONNECTION"],
  ["freight", "supportsFreight", "Товарни операции", "FREIGHT_HANDLING"],
  ["load", "canLoadGrain", "Товарене на зърно", "GRAIN_LOADING"],
  ["unload", "canUnloadGrain", "Разтоварване на зърно", "GRAIN_UNLOADING"],
  ["storage", "hasGrainStorage", "Зърнен склад", "GRAIN_STORAGE"],
  ["operational", "operational", "Действащ", "OPERATIONAL"],
] as const;
export type LogisticsFilters = {
  q: string; region: string; municipality: string; city: string; type: string; status: string;
  rail: string; freight: string; load: string; unload: string; storage: string;
  verifiedAfter: string; radius: string; sort: string;
};
export const EMPTY_LOGISTICS_FILTERS: LogisticsFilters = {
  q: "", region: "", municipality: "", city: "", type: "", status: "",
  rail: "", freight: "", load: "", unload: "", storage: "", verifiedAfter: "", radius: "50", sort: "verification",
};
export type LogisticsCenter = { lat: number; lng: number };
export function accountLogisticsCity(settlement: string | null | undefined) {
  if (!settlement?.trim()) return null;
  const town = settlement.split(",").at(-1)?.trim().replace(/^(?:град|село|курорт|гр\.|с\.)\s+/iu, "").trim();
  return town || null;
}
const centerSchema = z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) });
const inputSchema = z.object({
  q: z.string().trim().max(200), region: z.string(), municipality: z.string().trim().max(200), city: z.string().trim().max(200),
  type: z.union([z.literal(""), z.enum(Object.keys(LOGISTICS_TYPES) as [keyof typeof LOGISTICS_TYPES, ...(keyof typeof LOGISTICS_TYPES)[]])]),
  status: z.union([z.literal(""), z.enum(Object.keys(LOGISTICS_STATUSES) as [keyof typeof LOGISTICS_STATUSES, ...(keyof typeof LOGISTICS_STATUSES)[]])]),
  rail: z.enum(["", "true", "false"]), freight: z.enum(["", "true", "false"]), load: z.enum(["", "true", "false"]),
  unload: z.enum(["", "true", "false"]), storage: z.enum(["", "true", "false"]),
  verifiedAfter: z.union([z.literal(""), z.iso.date({ error: "Въведи валидна дата YYYY-MM-DD." })]),
  radius: z.enum(["25", "50", "100", "200"]), sort: z.enum(["verification", "name", "distance"]),
});
export function logisticsQuery(filters: LogisticsFilters, center: LogisticsCenter | null) {
  const value = inputSchema.parse(filters);
  if (center) centerSchema.parse(center);
  if (!center && value.sort === "distance") throw new Error("Избери център за подреждане по разстояние.");
  const params = new URLSearchParams();
  for (const [key, data] of Object.entries(value)) {
    if (data && key !== "radius") params.set(key, data);
  }
  if (center) {
    params.set("lat", String(center.lat)); params.set("lng", String(center.lng)); params.set("radius", value.radius);
  }
  return params.toString();
}
export function logisticsCoordinates(item: Pick<PublicLogisticsFacility, "latitude" | "longitude">): [number, number] | null {
  const result = centerSchema.safeParse({ lat: item.latitude, lng: item.longitude });
  return result.success ? [result.data.lng, result.data.lat] : null;
}
