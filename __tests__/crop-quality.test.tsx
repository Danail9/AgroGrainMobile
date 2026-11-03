import { fireEvent, render, screen } from "@testing-library/react-native";

import { CROP_QUALITY_FIELDS, QUALITY_LABELS, cropQualitySchema, type QualityCrop } from "@/api/schemas";
import { CropQualitySpecs } from "@/ui/CropQualitySpecs";
import { ListingForm, OfferForm } from "@/ui/TradeForms";

const mockListing = jest.fn();
const mockOffer = jest.fn();
jest.mock("@/api/queries", () => ({
  useMarket: () => ({ data: { prices: [] } }),
  useMe: () => ({ data: { favoriteCrops: [] } }),
  useCreateListing: () => ({ mutate: mockListing, isPending: false }),
  useCreateOffer: () => ({ mutate: mockOffer, isPending: false }),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const crops = [
  { slug: "sunflower", name: "Слънчоглед" },
  { slug: "chickpea", name: "Нахут" },
  { slug: "coriander", name: "Кориандър" },
  { slug: "barley-malting", name: "Ечемик пивоварен" },
  { slug: "rapeseed", name: "Рапица" },
  { slug: "flax", name: "Лен" },
  { slug: "wheat", name: "Пшеница" },
];
beforeEach(() => {
  mockListing.mockReset();
  mockOffer.mockReset();
});

async function choose(name: string) {
  const quick = screen.queryByLabelText(`Избери ${name}`);
  if (quick) await fireEvent.press(quick);
  else {
    const open = screen.queryByLabelText("Избери култура") ?? screen.getByText("Промени");
    await fireEvent.press(open);
    await fireEvent.press(screen.getByText(name));
  }
}

it.each(crops.filter((crop) => crop.slug !== "wheat"))("shows only the applicable listing fields for $name", async (crop) => {
  await render(<ListingForm crops={[crop]} />);
  await choose(crop.name);
  const fields: readonly string[] = CROP_QUALITY_FIELDS[crop.slug as QualityCrop];
  for (const [field, label] of Object.entries(QUALITY_LABELS)) {
    expect(!!screen.queryByLabelText(label)).toBe(fields.includes(field));
  }
  expect(screen.queryByLabelText("Хектолитър")).toBeNull();
  expect(screen.queryByLabelText("Глутен")).toBeNull();
  if (crop.slug === "barley-malting") expect(screen.getByText(/очакват потвърждение/)).toBeTruthy();
});

it("submits optional chickpea protein and moisture percentages including zero and decimal commas", async () => {
  await render(<ListingForm crops={[crops[1]]} />);
  await choose("Нахут");
  await fireEvent.changeText(screen.getByLabelText("Количество"), "100");
  await fireEvent.changeText(screen.getByLabelText("Протеин"), "35,5");
  await fireEvent.changeText(screen.getByLabelText("Влага"), "0");
  await fireEvent.press(screen.getByText("Публикувай обява"));
  expect(mockListing).toHaveBeenCalledWith(expect.objectContaining({
    quality: { cropSlug: "chickpea", protein: 35.5, moisture: 0 },
    protein: "", hectolitre: "", gluten: "",
  }), expect.any(Object));
});

it.each(["-1", "100.01", "Infinity", "abc"])("rejects invalid percentages %s visibly without submitting", async (value) => {
  await render(<OfferForm crops={[crops[0]]} fertilizers={[]} />);
  await choose("Слънчоглед");
  await fireEvent.changeText(screen.getByLabelText("Цена"), "206");
  await fireEvent.changeText(screen.getByLabelText("Масленост"), value);
  await fireEvent.press(screen.getByText("Публикувай оферта"));
  expect(screen.getByText("Въведи процент от 0 до 100.")).toBeTruthy();
  expect(mockOffer).not.toHaveBeenCalled();
});

it("allows an offer without quality measurements and resets values after crop changes", async () => {
  await render(<OfferForm crops={crops} fertilizers={[]} />);
  await choose("Слънчоглед");
  await fireEvent.changeText(screen.getByLabelText("Цена"), "206");
  await fireEvent.changeText(screen.getByLabelText("Масленост"), "45");
  await choose("Рапица");
  expect(screen.getByLabelText("Масленост").props.value).toBe("");
  await fireEvent.press(screen.getByText("Публикувай оферта"));
  expect(mockOffer).toHaveBeenCalledWith(expect.objectContaining({
    quality: { cropSlug: "rapeseed" },
  }), expect.any(Object));
});

it("retains legacy wheat sample fields and omits crop-specific quality for wheat", async () => {
  await render(<ListingForm crops={[crops[6]]} />);
  await choose("Пшеница");
  await fireEvent.press(screen.getByText("Качество на пробата"));
  expect(screen.getByLabelText("Хектолитър")).toBeTruthy();
  expect(screen.getByLabelText("Глутен")).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Количество"), "100");
  await fireEvent.changeText(screen.getByLabelText("Протеин"), "12,5");
  await fireEvent.press(screen.getByText("Публикувай обява"));
  expect(mockListing.mock.calls[0][0].quality).toBeUndefined();
  expect(mockListing.mock.calls[0][0].protein).toBe("12.5");
});

it("clears listing measurements when switching crop profiles", async () => {
  await render(<ListingForm crops={crops} />);
  await choose("Слънчоглед");
  await fireEvent.changeText(screen.getByLabelText("Примеси"), "5");
  await choose("Нахут");
  expect(screen.queryByLabelText("Примеси")).toBeNull();
  expect(screen.getByLabelText("Протеин").props.value).toBe("");
  await fireEvent.changeText(screen.getByLabelText("Количество"), "100");
  await fireEvent.press(screen.getByText("Публикувай обява"));
  expect(mockListing.mock.calls[0][0].quality).toEqual({ cropSlug: "chickpea" });
});

it("publishes malting listings without provisional or wheat measurements after a crop switch", async () => {
  await render(<ListingForm crops={crops} />);
  await choose("Слънчоглед");
  await fireEvent.changeText(screen.getByLabelText("Масленост"), "45");
  await choose("Ечемик пивоварен");
  for (const label of [...Object.values(QUALITY_LABELS), "Хектолитър", "Глутен"]) {
    expect(screen.queryByLabelText(label)).toBeNull();
  }
  await fireEvent.changeText(screen.getByLabelText("Количество"), "100");
  await fireEvent.press(screen.getByText("Публикувай обява"));
  expect(mockListing).toHaveBeenCalledWith(expect.objectContaining({
    title: "Ечемик пивоварен", quality: { cropSlug: "barley-malting" },
    protein: "", hectolitre: "", gluten: "",
  }), expect.any(Object));
});

it("publishes malting crop offers with quality parameters still pending", async () => {
  await render(<OfferForm crops={[crops[3]]} fertilizers={[]} />);
  await choose("Ечемик пивоварен");
  expect(screen.getByText(/очакват потвърждение/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Цена"), "215");
  await fireEvent.press(screen.getByText("Публикувай оферта"));
  expect(mockOffer).toHaveBeenCalledWith(expect.objectContaining({
    title: "Ечемик пивоварен", quality: { cropSlug: "barley-malting" },
  }), expect.any(Object));
  expect(cropQualitySchema.safeParse({ cropSlug: "barley-malting", impurities: 0 }).success).toBe(false);
});

it("removes crop quality from fertilizer offers", async () => {
  await render(<OfferForm crops={[crops[0]]} fertilizers={[{ slug: "nitrogen", name: "Тор" }]} />);
  await choose("Слънчоглед");
  await fireEvent.changeText(screen.getByLabelText("Масленост"), "45");
  await fireEvent.press(screen.getByText("Торове"));
  expect(screen.queryByLabelText("Масленост")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Избери тор"));
  await fireEvent.press(screen.getByText("Тор"));
  await fireEvent.changeText(screen.getByLabelText("Цена"), "200");
  await fireEvent.press(screen.getByText("Публикувай оферта"));
  expect(mockOffer.mock.calls[0][0].quality).toBeUndefined();
});

it("renders zero measurements, ignores missing ones, and accepts valid API quality", async () => {
  const quality = cropQualitySchema.parse({ cropSlug: "sunflower", impurities: 0, oilContent: 45.5 });
  await render(<CropQualitySpecs quality={quality} />);
  expect(screen.getByText("Масленост 45,50%")).toBeTruthy();
  expect(screen.getByText("Примеси 0,00%")).toBeTruthy();
  expect(screen.queryByText(/Протеин/)).toBeNull();
});
