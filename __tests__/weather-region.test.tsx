import { fireEvent, render, screen } from "@testing-library/react-native";
import WeatherScreen from "@/app/(app)/(tabs)/weather";
const mockWeather = jest.fn();
const mockProfileUpdate = jest.fn();
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/ui/Screen", () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/ui/Tabs", () => ({ Tabs: () => null }));
jest.mock("@/ui/QueryBoundary", () => ({ QueryBoundary: ({ query, children }: {
  query: { data: { regions?: unknown } }; children: (data: unknown) => React.ReactNode;
}) => query.data?.regions ? children(query.data) : null }));
jest.mock("@/api/queries", () => ({
  useMe: () => ({ data: { user: { regionSlug: "dobrich", regionName: "Добрич" } } }),
  useUpdateRegion: () => ({ mutate: mockProfileUpdate }),
  useRegions: () => ({ data: { regions: [{ slug: "dobrich", name: "Добрич" }, { slug: "varna", name: "Варна" }] } }),
  useWeather: (enabled: boolean, region?: string) => {
    mockWeather(enabled, region);
    return { data: { weather: { regionName: region === "varna" ? "Варна" : "Добрич", daily: [], isFallback: false } } };
  },
}));
it("temporarily switches forecast/statistics region and resets without editing the profile", async () => {
  await render(<WeatherScreen />);
  expect(screen.getByText("Област: Добрич")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: /Избери друга област/ }));
  await fireEvent.press(screen.getByRole("button", { name: "Варна" }));
  expect(mockWeather).toHaveBeenLastCalledWith(true, "varna");
  expect(screen.getByText("Област: Варна")).toBeTruthy();
  expect(screen.getByText("Временен избор — профилът не е променен")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Регион от профила" }));
  expect(mockWeather).toHaveBeenLastCalledWith(true, undefined);
  expect(screen.getByText("Област: Добрич")).toBeTruthy();
  expect(mockProfileUpdate).not.toHaveBeenCalled();
});
