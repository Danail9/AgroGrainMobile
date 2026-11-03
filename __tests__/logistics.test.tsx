import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { Linking, Platform } from "react-native";
import { logisticsListSchema, logisticsMapSchema, type PublicLogisticsFacility, type LogisticsMapData } from "@/api/schemas";
import { EMPTY_LOGISTICS_FILTERS, accountLogisticsCity, logisticsCoordinates, logisticsQuery } from "@/lib/logistics";
import LogisticsScreen from "@/app/(app)/(tabs)/map";
import LogisticsDetailScreen from "@/app/(app)/logistics/[id]";
import { LogisticsSummary } from "@/ui/LogisticsSummary";
import { LogisticsMap, logisticsMarkerGroups } from "@/ui/LogisticsMap";
import { LogisticsCategoryIcon } from "@/ui/LogisticsCategoryIcon";
import { openLogisticsUrl } from "@/lib/logistics-links";
import { reportError } from "@/lib/monitoring";
import { showDialog } from "@/ui/Dialog";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ id: "test" }),
}));
jest.mock("expo-constants", () => ({
  __esModule: true, default: { expoConfig: { extra: { androidMapsConfigured: false } } },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockAnimate = jest.fn();
jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ ref, ...props }: { ref: unknown }) => {
      React.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimate }));
      return <View {...props} />;
    },
    Marker: (props: object) => <View {...props} />,
    PROVIDER_GOOGLE: "google",
  };
});
jest.mock("@/lib/monitoring", () => ({ reportError: jest.fn() }));
jest.mock("@/ui/Dialog", () => ({ showDialog: jest.fn() }));
const mockRefetch = jest.fn();
const mockQuery = jest.fn();
const mockMapQuery = jest.fn();
let mockListError = false;
let mockMapError = false;
let mockSettlement: string | null = "Област Бургас, град Бургас";
let mockRegionSlug = "burgas";
const mockItem: PublicLogisticsFacility = {
  id: "test", slug: "test-only", name: "TEST ONLY Grain terminal", type: "GRAIN_TERMINAL", status: "UNVERIFIED",
  regionSlug: "burgas", city: "TEST city", municipality: null, address: null, latitude: 42, longitude: 27,
  hasRailConnection: true, supportsFreight: null, operational: null, canLoadGrain: null, canUnloadGrain: false,
  hasGrainStorage: null, grainStorageTons: null, loadingCapacityTPH: null, unloadingCapacityTPH: null,
  railwayTracks: 0, trackLengthMeters: null, operatorName: null, contactPerson: null, contactPhone: null,
  contactEmail: null, website: null, description: null, distanceKm: 42.25, lastVerifiedAt: null,
  claims: Object.fromEntries(["IDENTITY", "COORDINATES", "RAIL_CONNECTION", "FREIGHT_HANDLING", "OPERATIONAL",
    "GRAIN_LOADING", "GRAIN_UNLOADING", "GRAIN_STORAGE", "CAPACITIES", "CONTACTS"].map((key) => [key, "PENDING"])),
  sources: [{ id: "source", sourceName: "TEST ONLY source", sourceUrl: "https://example.com/source",
    reference: "TEST reference", publishedAt: null, checkedAt: "2026-10-31T10:00:00Z" }],
};
const mockFeature: LogisticsMapData["features"][number] = {
  type: "Feature", id: "test", geometry: { type: "Point", coordinates: [27, 42] },
  properties: { id: "test", name: "TEST ONLY Grain terminal", status: "UNVERIFIED", color: "#eab308" },
};
let mockDetailItem = mockItem;
jest.mock("@/api/queries", () => ({
  useMe: () => ({ data: { user: { settlement: mockSettlement, regionSlug: mockRegionSlug, regionName: "Бургас" } }, isPending: false, isError: false,
    fetchStatus: "idle", dataUpdatedAt: 0 }),
  useLogistics: (query: string, page: number, enabled: boolean) => {
    mockQuery(query, page, enabled);
    return { data: mockListError ? undefined : { items: [mockItem], total: 30, page, pageSize: 25 },
      isPending: false, isError: mockListError, error: mockListError ? new Error("error") : null,
      isRefetching: false, fetchStatus: "idle", dataUpdatedAt: 0, refetch: mockRefetch };
  },
  useLogisticsMap: (...args: unknown[]) => { mockMapQuery(...args); return {
    data: { type: "FeatureCollection", features: [mockFeature] }, isPending: false, isError: mockMapError,
    error: new Error("error"), fetchStatus: "idle", refetch: mockRefetch,
  }; },
  useLogisticsFacility: () => ({ data: mockDetailItem, isPending: false, isError: false,
    error: null, isRefetching: false, fetchStatus: "idle", dataUpdatedAt: 0, refetch: mockRefetch }),
  useRegions: () => ({ data: { regions: [{ slug: "burgas", name: "Бургас" }], settlements: [] },
    isPending: false, isError: false, fetchStatus: "idle", dataUpdatedAt: 0 }),
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, "OS", "ios");
  mockListError = false; mockMapError = false;
  mockSettlement = "Област Бургас, град Бургас";
  mockRegionSlug = "burgas";
  mockDetailItem = mockItem;
});
afterEach(() => jest.restoreAllMocks());
describe("query serialization and shared public contracts", () => {
  it.each([
    ["Област Бургас, град Бургас", "Бургас"],
    ["Област Варна, село Слънчево", "Слънчево"],
    ["гр. Стара Загора", "Стара Загора"],
    [null, null],
  ])("extracts account town from %s", (input, expected) => {
    expect(accountLogisticsCity(input)).toBe(expected);
  });
  it("sends verified filters and names without treating unknown as false", () => {
    const params = new URLSearchParams(logisticsQuery({ ...EMPTY_LOGISTICS_FILTERS, q: "Бургас & жп", load: "false" }, null));
    expect(params.get("q")).toBe("Бургас & жп"); expect(params.get("load")).toBe("false");
    expect(params.has("rail")).toBe(false); expect(params.has("radius")).toBe(false);
  });
  it.each(["25", "50", "100", "200"])("preserves the shared radius API for %s km", (radius) => {
    const params = new URLSearchParams(logisticsQuery({ ...EMPTY_LOGISTICS_FILTERS, radius, sort: "distance" }, { lat: 42, lng: 27 }));
    expect(params.get("lat")).toBe("42"); expect(params.get("lng")).toBe("27"); expect(params.get("radius")).toBe(radius);
  });
  it.each([{ radius: "300" }, { verifiedAfter: "2026-99-01" }, { sort: "distance" }, { rail: "unknown" }])(
    "rejects invalid query %j", (patch) => expect(() => logisticsQuery({ ...EMPTY_LOGISTICS_FILTERS, ...patch }, null)).toThrow());
  it("validates coordinate pairs", () => {
    expect(logisticsCoordinates(mockItem)).toEqual([27, 42]);
    expect(logisticsCoordinates({ latitude: null, longitude: 27 })).toBeNull();
    expect(logisticsCoordinates({ latitude: 91, longitude: 27 })).toBeNull();
  });
  it("accepts nullable capability fields and real GeoJSON responses", () => {
    expect(logisticsListSchema.safeParse({ items: [mockItem], total: 1, page: 1, pageSize: 25 }).success).toBe(true);
    expect(logisticsMapSchema.safeParse({ type: "FeatureCollection", features: [mockFeature] }).success).toBe(true);
    expect(logisticsListSchema.safeParse({ items: [{ ...mockItem, status: "AI_ASSUMED" }], total: 1, page: 1, pageSize: 25 }).success).toBe(false);
  });
});
describe("native logistics overview", () => {
  it("hides all missing fields and empty sections on the full detail page", async () => {
    mockDetailItem = { ...mockItem, sources: [], latitude: null, longitude: null,
      hasRailConnection: null, canUnloadGrain: null, railwayTracks: null };
    await render(<LogisticsDetailScreen />);
    expect(screen.queryByText(/Няма информация|Няма описание|Няма текуща проверка/)).toBeNull();
    expect(screen.queryByText(/^Контакти$|^Източници$|^Капацитети:|^Координати:/)).toBeNull();
  });
  it("keeps zero capacities and supplied contacts visible on the full detail page", async () => {
    mockDetailItem = { ...mockItem, contactPhone: "+359 test", grainStorageTons: 0, sources: [],
      locationType: "CITY_APPROXIMATE" };
    await render(<LogisticsDetailScreen />);
    expect(screen.getByText("Склад (т): 0")).toBeTruthy();
    expect(screen.getByText("Брой коловози: 0")).toBeTruthy();
    expect(screen.getByText("Телефон: +359 test")).toBeTruthy();
    expect(screen.getByText("Контакти")).toBeTruthy();
    expect(screen.queryByText(/^Оператор:/)).toBeNull();
    expect(screen.getByText("Координати: 42, 27 · Приблизително място")).toBeTruthy();
  });
  it("hides missing contact, address, date and capability rows while retaining the approximate warning", async () => {
    await render(<LogisticsSummary mapCard capabilities item={{ ...mockItem, city: null, municipality: null,
      address: null, locationType: "CITY_APPROXIMATE", sources: [], hasRailConnection: null, canUnloadGrain: null }} />);
    expect(screen.queryByText(/Оператор:|Телефон:|Имейл:|Контакти:|Последна текуща проверка:/)).toBeNull();
    expect(screen.queryByText(/Няма информация/)).toBeNull();
    expect(screen.queryByText(/Жп връзка:|Товарни операции:|Товарене на зърно:|Разтоварване на зърно:|Зърнен склад:|Действащ:/)).toBeNull();
    expect(screen.getByText(/Приблизително място/)).toBeTruthy();
  });
  it("shows supplied contact people and real verification dates", async () => {
    await render(<LogisticsSummary mapCard item={{ ...mockItem, contactPerson: "Test contact", lastVerifiedAt: "2026-10-31T10:00:00Z" }} />);
    expect(screen.getByText("Лице за контакт: Test contact")).toBeTruthy();
    expect(screen.getByText("Контакти: Очаква проверка")).toBeTruthy();
    expect(screen.getByText(/Последна текуща проверка:/)).toBeTruthy();
  });
  it("uses the saved account region without a settlement, preserves categories and leaves the map unchanged", async () => {
    mockSettlement = null;
    await render(<LogisticsScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Мелници" }));
    await fireEvent.press(screen.getByRole("button", { name: /Списък/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Само моят регион: Бургас" }));
    const params = new URLSearchParams(mockQuery.mock.calls.at(-1)[0]);
    expect(params.get("region")).toBe("burgas");
    expect(params.get("city")).toBeNull();
    expect(params.get("cityExact")).toBeNull();
    expect(params.get("type")).toBe("MILL");
    expect(mockMapQuery.mock.calls.at(-1)[0]).not.toContain("region=");
    expect(mockQuery.mock.calls.at(-1)[1]).toBe(1);
    await fireEvent.press(screen.getByRole("button", { name: "Всички региони" }));
    expect(mockQuery.mock.calls.at(-1)[0]).toBe("type=MILL&sort=verification");
  });
  it("explains a missing account region instead of silently claiming a regional filter", async () => {
    mockRegionSlug = "";
    await render(<LogisticsScreen />);
    await fireEvent.press(screen.getByRole("button", { name: /Списък/ }));
    expect(screen.getByText(/Няма регион в профила/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Само моят регион/ })).toBeNull();
  });
  it("warns about source-free public records without implying verification", async () => {
    await render(<LogisticsSummary item={{ ...mockItem, sources: [] }} mapCard />);
    expect(screen.getByText("Няма добавен източник. Публикацията не е проверка на информацията.")).toBeTruthy();
    expect(screen.getByText("Очаква проверка")).toBeTruthy();
  });
  it("clearly marks approximate town pins and does not label them as exact facilities", async () => {
    await render(<LogisticsSummary item={{ ...mockItem, locationType: "CITY_APPROXIMATE" }} mapCard />);
    expect(screen.getByText(/Приблизително място — ориентир/)).toBeTruthy();
    expect(screen.getByText(/Не използвай за доставка/)).toBeTruthy();
    expect(screen.queryByText("Очаква проверка")).toBeNull();
    expect(screen.queryByText(/Контакти:/)).toBeNull();
  });
  it("uses a single approximate notice on list cards instead of repeated verification warnings", async () => {
    await render(<LogisticsSummary item={{ ...mockItem, locationType: "CITY_APPROXIMATE", sources: [] }} />);
    expect(screen.getAllByText(/Приблизително място/)).toHaveLength(1);
    expect(screen.queryByText("Очаква проверка")).toBeNull();
    expect(screen.queryByText(/Няма добавен източник/)).toBeNull();
  });
  it.each(["PLANNED", "TEMPORARILY_INACTIVE", "PERMANENTLY_CLOSED"] as const)("preserves important %s status on approximate cards", async (status) => {
    await render(<LogisticsSummary item={{ ...mockItem, locationType: "CITY_APPROXIMATE", status }} />);
    expect(screen.getByText(/Приблизително място/)).toBeTruthy();
    expect(screen.getByText(status === "PLANNED" ? "Планиран" : status === "TEMPORARILY_INACTIVE" ? "Временно неактивен" : "Окончателно затворен")).toBeTruthy();
  });
  it("labels approximate markers before selection", async () => {
    await render(<LogisticsMap data={{ type: "FeatureCollection", features: [{
      ...mockFeature, properties: { ...mockFeature.properties, locationType: "CITY_APPROXIMATE" },
    }] }} selectedPoint={null} onBounds={jest.fn()} onSelect={jest.fn()} onSelectGroup={jest.fn()} />);
    expect(screen.getByTestId("marker-test").props.title).toContain("приблизително");
  });
  it.each([
    ["MILL", "Мелници"],
    ["OIL_MILL", "Маслобойни"],
    ["FEED_PLANT", "Фуражни заводи"],
    ["BREWERY", "Пивоварни"],
    ["PORT_TERMINAL", "Пристанища"],
  ])("applies %s directly from the map category row and resets it", async (type, label) => {
    await render(<LogisticsScreen />);
    await fireEvent.press(screen.getByRole("button", { name: label }));
    expect(mockMapQuery).toHaveBeenLastCalledWith(`type=${type}&sort=verification`, null, true);
    expect(screen.getByRole("button", { name: label }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Всички категории" }));
    expect(mockMapQuery).toHaveBeenLastCalledWith("sort=verification", null, true);
  });
  it("offers only the five public categories in the toolbar and type filters", async () => {
    await render(<LogisticsScreen />);
    for (const label of ["Товарна гара", "Зърнен терминал", "Интермодален терминал", "Зърнена складова база", "Частен жп коловоз", "Друг обект"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
    await fireEvent.press(screen.getByRole("button", { name: /Филтри/ }));
    for (const label of ["Мелници", "Маслобойни", "Фуражни заводи", "Пивоварни", "Пристанища"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText("Товарна гара")).toBeNull();
    expect(screen.queryByText("Пристанищен терминал")).toBeNull();
  });
  it("shows practical contact and provenance information in marker cards", async () => {
    await render(<LogisticsSummary item={{ ...mockItem, operatorName: "Test operator", contactPhone: "+359 000",
      website: "https://example.com", description: "Test terminal description" }} capabilities mapCard />);
    expect(screen.getByText("Оператор: Test operator")).toBeTruthy();
    expect(screen.getByText("Телефон: +359 000")).toBeTruthy();
    expect(screen.getByText("Test terminal description")).toBeTruthy();
    expect(screen.getByText("Контакти: Очаква проверка")).toBeTruthy();
    expect(screen.queryByText(/Последна текуща проверка:/)).toBeNull();
    expect(screen.getByRole("button", { name: "Отвори източника" })).toBeTruthy();
  });
  it("opens Apple Maps without a key, GPS, radius controls or a list request", async () => {
    await render(<LogisticsScreen />);
    const map = screen.getByTestId("native-map");
    expect(map.props.provider).toBeUndefined();
    expect(map.props.showsUserLocation).toBe(false);
    expect(screen.queryByRole("button", { name: /Близо до мен/ })).toBeNull();
    expect(mockQuery).toHaveBeenLastCalledWith("", 1, false);
    await fireEvent.press(screen.getByRole("button", { name: /Филтри/ }));
    expect(screen.queryByText("Радиус по права линия")).toBeNull();
  });
  it("keeps list search and explicitly explains missing Android configuration", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    await render(<LogisticsScreen />);
    expect(screen.queryByTestId("native-map")).toBeNull();
    expect(screen.getByText(/нужен Google Maps ключ/)).toBeTruthy();
    expect(mockQuery).toHaveBeenLastCalledWith("", 1, true);
  });
  it("uses Google Maps when Android configuration is present", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    jest.replaceProperty(Constants.expoConfig!.extra!, "androidMapsConfigured", true);
    await render(<LogisticsScreen />);
    expect(screen.getByTestId("native-map").props.provider).toBe("google");
  });
  it("applies filters to both views and resets pagination", async () => {
    await render(<LogisticsScreen />);
    await fireEvent.press(screen.getByRole("button", { name: /Списък/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Следваща" }));
    expect(mockQuery).toHaveBeenLastCalledWith("", 2, true);
    await fireEvent.press(screen.getByRole("button", { name: /Филтри/ }));
    await fireEvent.changeText(screen.getByLabelText("Име / оператор"), "terminal");
    await fireEvent.press(screen.getByRole("button", { name: "Приложи филтрите" }));
    expect(mockQuery).toHaveBeenLastCalledWith("q=terminal&sort=verification", 1, true);
    await fireEvent.press(screen.getByRole("button", { name: /Карта/ }));
    expect(mockMapQuery).toHaveBeenLastCalledWith("q=terminal&sort=verification", null, true);
  });
  it("keeps the base map visible when the server fails, clears markers and offers retry", async () => {
    mockMapError = true;
    await render(<LogisticsScreen />);
    await act(() => screen.getByTestId("native-map").props.onMapReady());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    expect(screen.getByText(/Обектите не се заредиха/)).toBeTruthy();
    expect(screen.queryByTestId("marker-test")).toBeNull();
    expect(screen.getByTestId("native-map")).toBeTruthy();
    expect(screen.queryByText(/Няма публикувани обекти в този изглед/)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Зареди обектите отново" }));
    expect(mockRefetch).toHaveBeenCalled();
  });
  it("opens a labelled marker's facility sheet and its external directions", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await render(<LogisticsScreen />);
    expect(screen.getByTestId("marker-test").props.title).toBe(mockItem.name);
    await act(() => screen.getByTestId("marker-test").props.onPress());
    await fireEvent.press(screen.getByRole("button", { name: /Отвори външна навигация/ }));
    expect(open).toHaveBeenCalledWith("https://www.google.com/maps/dir/?api=1&destination=42,27");
    await fireEvent.press(screen.getByRole("button", { name: "Всички данни и източници" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/logistics/[id]", params: { id: "test" } });
  });
  it("opens a list facility and distinguishes failure from an empty list", async () => {
    mockListError = true;
    await render(<LogisticsScreen />);
    await fireEvent.press(screen.getByRole("button", { name: /Списък/ }));
    expect(screen.getByText("Нещо се обърка")).toBeTruthy();
    expect(screen.queryByText("Няма публикувани обекти за избраните филтри.")).toBeNull();
  });
  it("shows sources, zero capacities and individual verification states", async () => {
    await render(<LogisticsDetailScreen />);
    expect(screen.getByText("Брой коловози: 0")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Отвори източник: TEST ONLY source" })).toBeTruthy();
    expect(screen.getByText(/Координати: 42, 27 · Очаква проверка/)).toBeTruthy();
  });
  it("distinguishes unknown and false without inferring grain handling", async () => {
    await render(<LogisticsSummary item={mockItem} capabilities />);
    expect(screen.queryByText(/Товарене на зърно:/)).toBeNull();
    expect(screen.getByText("Разтоварване на зърно: Не · Очаква проверка")).toBeTruthy();
    expect(screen.getByText("Жп връзка: Да · Очаква проверка")).toBeTruthy();
  });
});
describe("native map markers", () => {
  it.each(["MILL", "OIL_MILL", "FEED_PLANT", "BREWERY", "PORT_TERMINAL"])("uses the selected %s icon for untyped pins and clusters", async (type) => {
    const props = { selectedPoint: null, selectedCategory: type, onBounds: jest.fn(), onSelect: jest.fn(), onSelectGroup: jest.fn() };
    const result = await render(<LogisticsMap {...props} data={{ type: "FeatureCollection", features: [mockFeature] }} />);
    expect(screen.getByTestId(`category-icon-${type}`)).toBeTruthy();
    const second = { ...mockFeature, id: "second" };
    await result.rerender(<LogisticsMap {...props} data={{ type: "FeatureCollection", features: [mockFeature, second] }} />);
    expect(screen.getByTestId(`category-icon-${type}`)).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    await result.rerender(<LogisticsMap {...props} selectedCategory={undefined} data={{ type: "FeatureCollection", features: [mockFeature] }} />);
    expect(screen.getByTestId("category-icon-OTHER")).toBeTruthy();
  });
  it("passes the selected category from the toolbar into the map", async () => {
    await render(<LogisticsScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Мелници" }));
    expect(screen.getAllByTestId("category-icon-MILL")).toHaveLength(2);
    expect(screen.queryByTestId("category-icon-OTHER")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Всички категории" }));
    expect(screen.getByTestId("category-icon-OTHER")).toBeTruthy();
  });
  it("keeps explicit server categories rather than overriding them with the selected category", async () => {
    const feature = { ...mockFeature, properties: { ...mockFeature.properties, type: "OIL_MILL" } };
    await render(<LogisticsMap selectedCategory="MILL" data={{ type: "FeatureCollection", features: [feature] }} selectedPoint={null}
      onBounds={jest.fn()} onSelect={jest.fn()} onSelectGroup={jest.fn()} />);
    expect(screen.getByTestId("category-icon-OIL_MILL")).toBeTruthy();
    expect(screen.queryByTestId("category-icon-MILL")).toBeNull();
  });
  it.each(["MILL", "OIL_MILL", "FEED_PLANT", "BREWERY", "PORT_TERMINAL"])("renders the category-specific %s marker", async (type) => {
    const feature = { ...mockFeature, properties: { ...mockFeature.properties, type } };
    await render(<LogisticsMap data={{ type: "FeatureCollection", features: [feature] }} selectedPoint={null}
      onBounds={jest.fn()} onSelect={jest.fn()} onSelectGroup={jest.fn()} />);
    expect(screen.getByTestId(`category-icon-${type}`)).toBeTruthy();
    expect(screen.queryByTestId("category-icon-OTHER")).toBeNull();
  });
  it("shows category icons for homogeneous clusters, and counts only for mixed clusters", async () => {
    const a = { ...mockFeature, properties: { ...mockFeature.properties, type: "MILL" } };
    const b = { ...a, id: "second", properties: { ...a.properties, id: "second" } };
    const props = { selectedPoint: null, onBounds: jest.fn(), onSelect: jest.fn(), onSelectGroup: jest.fn() };
    const result = await render(<LogisticsMap {...props} data={{ type: "FeatureCollection", features: [a, b] }} />);
    expect(screen.getByTestId("category-icon-MILL")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    await result.rerender(<LogisticsMap {...props} data={{ type: "FeatureCollection",
      features: [a, { ...b, properties: { ...b.properties, type: "OIL_MILL" } }] }} />);
    expect(screen.queryByTestId("category-icon-MILL")).toBeNull();
    expect(screen.getByText("2")).toBeTruthy();
  });
  it("provides a neutral fallback for old API responses without guessing the category", async () => {
    await render(<LogisticsCategoryIcon color="#000000" />);
    expect(screen.getByTestId("category-icon-OTHER")).toBeTruthy();
    expect(logisticsMapSchema.parse({ type: "FeatureCollection", features: [mockFeature] }).features[0].properties.type).toBeUndefined();
    const typed = { ...mockFeature, properties: { ...mockFeature.properties, type: "MILL" } };
    expect(logisticsMapSchema.parse({ type: "FeatureCollection", features: [typed] }).features[0].properties.type).toBe("MILL");
  });
  it("returns to the tighter Bulgaria overview and clears the saved selection viewport", async () => {
    const props = { data: { type: "FeatureCollection" as const, features: [mockFeature] }, selectedPoint: null,
      onBounds: jest.fn(), onSelect: jest.fn(), onSelectGroup: jest.fn() };
    const result = await render(<LogisticsMap {...props} resetView={0} />);
    const initial = screen.getByTestId("native-map").props.initialRegion;
    expect(initial).toEqual({ latitude: 42.7, longitude: 25.4, latitudeDelta: 3.8, longitudeDelta: 6.8 });
    await act(() => screen.getByTestId("native-map").props.onRegionChangeComplete({
      latitude: 43, longitude: 26, latitudeDelta: 2, longitudeDelta: 3,
    }));
    await act(() => screen.getByTestId("marker-test").props.onPress());
    await fireEvent.press(screen.getByRole("button", { name: "Общ изглед на България" }));
    expect(mockAnimate).toHaveBeenLastCalledWith(initial, 300);
    await result.rerender(<LogisticsMap {...props} resetView={1} />);
    expect(mockAnimate).toHaveBeenLastCalledWith(initial, 300);
    expect(props.onSelectGroup).not.toHaveBeenCalled();
  });
  it("restores the pre-selection viewport on category reset, even after repeated selections", async () => {
    const props = { data: { type: "FeatureCollection" as const, features: [mockFeature] }, selectedPoint: null,
      onBounds: jest.fn(), onSelect: jest.fn(), onSelectGroup: jest.fn() };
    const result = await render(<LogisticsMap {...props} resetView={0} />);
    const before = { latitude: 43, longitude: 26, latitudeDelta: 2, longitudeDelta: 3 };
    await act(() => screen.getByTestId("native-map").props.onRegionChangeComplete(before));
    await act(() => screen.getByTestId("marker-test").props.onPress());
    await act(() => screen.getByTestId("native-map").props.onRegionChangeComplete({
      latitude: 42, longitude: 27, latitudeDelta: 0.06, longitudeDelta: 0.06,
    }));
    await act(() => screen.getByTestId("marker-test").props.onPress());
    await result.rerender(<LogisticsMap {...props} resetView={1} />);
    expect(mockAnimate).toHaveBeenLastCalledWith(before, 300);
    await act(() => screen.getByTestId("native-map").props.onRegionChangeComplete(before));
    const next = { ...before, latitude: 41, longitude: 24 };
    await act(() => screen.getByTestId("native-map").props.onRegionChangeComplete(next));
    await act(() => screen.getByTestId("marker-test").props.onPress());
    await result.rerender(<LogisticsMap {...props} resetView={2} />);
    expect(mockAnimate).toHaveBeenLastCalledWith(next, 300);
  });
  it("hides overview names and zooms single markers without losing selection", async () => {
    const select = jest.fn();
    await render(<LogisticsMap data={{ type: "FeatureCollection", features: [mockFeature] }} selectedPoint={null}
      onBounds={jest.fn()} onSelect={select} onSelectGroup={jest.fn()} />);
    expect(screen.queryByText(mockFeature.properties.name)).toBeNull();
    expect(screen.getByTestId("native-map").props.userInterfaceStyle).toBe("light");
    await act(() => screen.getByTestId("marker-test").props.onPress());
    expect(mockAnimate).toHaveBeenCalledWith({ latitude: 42, longitude: 27, latitudeDelta: 0.06, longitudeDelta: 0.06 }, 300);
    expect(select).toHaveBeenCalledWith("test");
    await act(() => screen.getByTestId("native-map").props.onRegionChangeComplete({
      latitude: 42, longitude: 27, latitudeDelta: 0.06, longitudeDelta: 0.06,
    }));
    expect(screen.getByText(mockFeature.properties.name)).toBeTruthy();
  });
  const data: LogisticsMapData = { type: "FeatureCollection", features: [mockFeature] };
  it("emits the initial Bulgaria bbox without requiring a gesture", async () => {
    const bounds = jest.fn();
    await render(<LogisticsMap data={data} selectedPoint={null} onBounds={bounds} onSelect={jest.fn()} onSelectGroup={jest.fn()} />);
    await act(() => screen.getByTestId("native-map").props.onMapReady());
    expect(bounds).toHaveBeenCalledWith("22.000000,40.800000,28.800000,44.600000");
    await act(() => screen.getByTestId("native-map").props.onRegionChangeComplete({
      latitude: 42.5, longitude: 25, latitudeDelta: 5, longitudeDelta: 10,
    }));
    expect(bounds).toHaveBeenLastCalledWith("20.000000,40.000000,30.000000,45.000000");
  });
  it("groups dense markers without dropping any facilities", () => {
    const features = Array.from({ length: 2000 }, (_, index) => ({ ...mockFeature, id: String(index) }));
    const groups = logisticsMarkerGroups(features, { latitude: 42, longitude: 27, latitudeDelta: 5, longitudeDelta: 8 });
    expect(groups).toHaveLength(1);
    expect(groups.flat()).toHaveLength(2000);
  });
  it("merges close markers across grid boundaries without losing members", () => {
    const first = { ...mockFeature, geometry: { type: "Point" as const, coordinates: [27.99, 42] as [number, number] } };
    const second = { ...mockFeature, id: "second", geometry: { type: "Point" as const, coordinates: [28.01, 42] as [number, number] } };
    const groups = logisticsMarkerGroups([first, second], { latitude: 42, longitude: 27, latitudeDelta: 7, longitudeDelta: 7 });
    expect(groups).toHaveLength(1);
    expect(groups.flat()).toHaveLength(2);
  });
  it("zooms a cluster and exposes all coincident facilities for selection", async () => {
    const features = [mockFeature, { ...mockFeature, id: "second", properties: { ...mockFeature.properties, id: "second" } }];
    const group = jest.fn();
    await render(<LogisticsMap data={{ type: "FeatureCollection", features }} selectedPoint={null}
      onBounds={jest.fn()} onSelect={jest.fn()} onSelectGroup={group} />);
    await act(() => screen.getByTestId("marker-test").props.onPress());
    expect(group).toHaveBeenCalledWith(features);
    expect(mockAnimate).toHaveBeenCalled();
  });
  it("centres on a selected list facility using correct coordinate axes", async () => {
    await render(<LogisticsMap data={data} selectedPoint={[27, 42]}
      onBounds={jest.fn()} onSelect={jest.fn()} onSelectGroup={jest.fn()} />);
    expect(mockAnimate).toHaveBeenCalledWith({ latitude: 42, longitude: 27, latitudeDelta: 0.06, longitudeDelta: 0.06 }, 300);
  });
});
describe("safe external navigation", () => {
  it("rejects non-HTTPS links and explicitly reports failure", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await openLogisticsUrl("http://example.com");
    expect(open).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalled();
    expect(showDialog).toHaveBeenCalled();
  });
  it("reports navigation launch failures", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("Cannot open"));
    await openLogisticsUrl("https://example.com");
    expect(reportError).toHaveBeenCalled();
    expect(showDialog).toHaveBeenCalled();
  });
});
