import { fireEvent, render, screen } from "@testing-library/react-native";

import CropScreen from "@/app/(app)/market/[crop]";
import type { PriceRow } from "@/api/schemas";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ crop: "wheat-bread" }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockPrice: PriceRow = {
  slug: "wheat-bread", name: "Пшеница хлебна", emoji: "", category: "GRAIN",
  unit: "€/т", price: 205, changePct: null, sortIdx: 0, date: "2026-10-20T10:00:00.000Z",
  delivery: "VARNA", deliveryLabel: "Доставено до пристанище Варна",
  portPrices: [
    { destination: "VARNA", label: "Доставено до пристанище Варна", price: 205, date: "2026-10-20T10:00:00.000Z" },
    { destination: "BURGAS", label: "Доставено до пристанище Бургас", price: 210.5, date: "2026-10-20T09:00:00.000Z" },
  ],
};
const mockSetFavorite = jest.fn();
jest.mock("@/api/queries", () => ({
  useCrop: () => ({
    data: { crop: mockPrice, related: [], history: [], previousYear: [] },
    isPending: false, isError: false, error: null, isRefetching: false,
    fetchStatus: "idle", dataUpdatedAt: Date.now(), refetch: jest.fn(),
  }),
  useMe: () => ({ data: { favoriteCrops: [], subscription: { active: true } } }),
  useSetFavorite: () => ({ mutate: mockSetFavorite, isPending: false }),
}));

it("renders only current port quotes without national price, chart, comparisons or alert controls", async () => {
  await render(<CropScreen />);
  expect(screen.getByText("Доставено до пристанище Варна")).toBeTruthy();
  expect(screen.getByText("Доставено до пристанище Бургас")).toBeTruthy();
  expect(screen.getByText("205,00 €/т")).toBeTruthy();
  expect(screen.getByText("210,50 €/т")).toBeTruthy();
  expect(screen.getByText("Калкулатор на стойността")).toBeTruthy();
  expect(screen.getByText("20 500 €")).toBeTruthy();
  expect(screen.getByText("21 050 €")).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Количество (т)"), "10");
  expect(screen.getByText("2050 €")).toBeTruthy();
  expect(screen.getByText("2105 €")).toBeTruthy();
  expect(screen.queryByText(/Национална/)).toBeNull();
  expect(screen.queryByText("Движение на цената")).toBeNull();
  expect(screen.queryByText("30 дни")).toBeNull();
  expect(screen.queryByText("Целева цена")).toBeNull();
  expect(screen.queryByText("Ръчно въведени оферти. Условията за товарене на кораб се договарят отделно.")).toBeNull();
  expect(screen.getByLabelText("Добави в любими")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Добави в любими"));
  expect(mockSetFavorite).toHaveBeenCalledWith(
    { cropSlug: "wheat-bread", favorite: true }, expect.objectContaining({ onError: expect.any(Function) }),
  );
});
