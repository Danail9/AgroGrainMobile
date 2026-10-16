import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { Platform } from "react-native";
import { api } from "@/api/client";
import { showDialog } from "@/ui/Dialog";
import { PlanList } from "@/ui/PlanList";

const mockBuy = jest.fn();
const mockRestore = jest.fn();
const mockManage = jest.fn();
const mockStripe = jest.fn();
const mockCheckout = jest.fn();
const mockRefresh = jest.fn(async () => ({}));
const mockSetQueryData = jest.fn();
let mockAppleActive = false;
let mockLoadError: Error | null = null;
let mockAppleSubscription = {
  cancelAtPeriodEnd: false,
  currentPeriodEnd: "2026-11-13T08:00:00.000Z",
  interval: "MONTH" as "MONTH" | "YEAR",
};
jest.mock("@/ui/Dialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/api/client", () => ({
  ...jest.requireActual("@/api/client"),
  api: jest.fn(),
}));
jest.mock("@/lib/apple-purchases", () => ({
  loadApplePlans: jest.fn(), buyApplePlan: (...args: unknown[]) => mockBuy(...args),
  restoreApplePurchases: () => mockRestore(), manageAppleSubscription: () => mockManage(),
  isApplePurchaseCancelled: () => false,
  applePurchaseErrorMessage: (e: Error) => e.message,
}));
jest.mock("@stripe/stripe-react-native", () => ({ useStripe: () => mockStripe() }));
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => mockLoadError ? ({
    data: undefined, isError: true, error: mockLoadError, refetch: mockRefresh,
  }) : ({
    data: {
      appleActive: mockAppleActive,
      canPurchase: true,
      subscription: mockAppleSubscription,
      month: { id: "monthly", displayPrice: "49,99 €", price: 49.99, currency: "EUR" },
      year: { id: "yearly", displayPrice: "499,99 €", price: 499.99, currency: "EUR" },
    },
    refetch: mockRefresh, fetchStatus: "idle", isError: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: mockRefresh,
    setQueryData: mockSetQueryData,
  }),
}));
jest.mock("@/api/queries", () => ({
  keys: { me: ["me"], trade: ["trade"], home: ["home"], notifications: ["notifications"], invoices: ["invoices"] },
  useMe: () => ({ data: { user: { id: "u1" } } }),
  usePlans: () => ({ data: { plans: [] } }),
  useStartCheckout: () => ({ mutateAsync: mockCheckout }),
}));
jest.mock("@/config", () => ({ PRIVACY_URL: "https://example.com/privacy", TERMS_URL: "https://example.com/terms" }));

const mockActiveMe = {
  user: { id: "u1", role: "FARMER" },
  subscription: {
    active: true, canTrade: false, status: "ACTIVE", interval: "YEAR", currentPeriodEnd: "2027-10-14T08:00:00.000Z",
  },
  notificationPrefs: {},
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAppleActive = false;
  mockAppleSubscription = {
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2026-11-13T08:00:00.000Z",
    interval: "MONTH",
  };
  mockLoadError = null;
  jest.replaceProperty(Platform, "OS", "ios");
  mockBuy.mockResolvedValue({
    appleActive: true,
    canPurchase: false,
    subscription: { active: true, canTrade: false, status: "ACTIVE" },
  });
  mockRestore.mockResolvedValue({
    appleActive: true,
    canPurchase: false,
    subscription: { active: true, canTrade: false, status: "ACTIVE" },
  });
  mockManage.mockResolvedValue({});
  (api as jest.Mock).mockResolvedValue(mockActiveMe);
});
afterEach(() => { jest.restoreAllMocks(); });

it("uses localized Apple prices and defaults to the yearly plan", async () => {
  await render(<PlanList role="TRADER" onChanged={jest.fn()} />);
  expect(screen.getByText("49,99 €")).toBeTruthy();
  expect(screen.getByText("Спести 17%")).toBeTruthy();
  expect(screen.getByText("≈ 41,67 € / месец")).toBeTruthy();
  expect(mockStripe).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Абонирай се · 499,99 €"));
  expect(mockBuy).toHaveBeenCalledWith(expect.objectContaining({ id: "yearly" }), expect.any(Function));
  expect(mockCheckout).not.toHaveBeenCalled();
});

it("switches the call to action when the monthly plan is selected", async () => {
  await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
  await fireEvent.press(screen.getByLabelText("Месечен 49,99 € / месец"));
  await fireEvent.press(screen.getByText("Абонирай се · 49,99 €"));
  expect(mockBuy).toHaveBeenCalledWith(expect.objectContaining({ id: "monthly" }), expect.any(Function));
});

it("shows status and management for an active yearly Apple subscription", async () => {
  mockAppleActive = true;
  mockAppleSubscription = { cancelAtPeriodEnd: false, currentPeriodEnd: "2026-11-13T08:00:00.000Z", interval: "YEAR" };
  await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
  expect(screen.getByText("Годишен абонамент")).toBeTruthy();
  expect(screen.getByText(/Активен до 13\.11\.2026/)).toBeTruthy();
  expect(screen.queryByText(/Абонирай се/)).toBeNull();
  expect(screen.queryByText("Надгради до годишен")).toBeNull();
  await fireEvent.press(screen.getByText("Управлявай в App Store"));
  expect(mockManage).toHaveBeenCalledTimes(1);
});

it("offers only the yearly upgrade when the monthly Apple plan is active", async () => {
  mockAppleActive = true;
  await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
  expect(screen.getByText("Месечен абонамент")).toBeTruthy();
  expect(screen.getByText(/Активен до 13\.11\.2026/)).toBeTruthy();
  expect(screen.queryByText(/Абонирай се/)).toBeNull();
  await fireEvent.press(screen.getByText("Надгради до годишен"));
  expect(mockBuy).toHaveBeenCalledWith(expect.objectContaining({ id: "yearly" }), expect.any(Function));
  expect(await screen.findByText("Надградено до годишен план")).toBeTruthy();
});

it("surfaces verification failures with a restore shortcut", async () => {
  mockBuy.mockRejectedValue(new Error("Не плащай повторно"));
  const log = jest.spyOn(console, "warn").mockImplementation(() => {});
  await render(<PlanList role="TRADER" onChanged={jest.fn()} />);
  await fireEvent.press(screen.getByText("Абонирай се · 499,99 €"));
  await waitFor(() => expect(showDialog).toHaveBeenCalled());
  expect(showDialog).toHaveBeenCalledWith(expect.objectContaining({
    title: "Плащането не е завършено",
    message: "Не плащай повторно",
    actions: [
      expect.objectContaining({ label: "Затвори" }),
      expect.objectContaining({ label: "Възстанови покупки" }),
    ],
  }));
  expect(screen.queryByText("Добре дошъл в AgroGrain Premium")).toBeNull();
  expect(log).toHaveBeenCalled();
});

it("renders plans even if background Apple sync fails", async () => {
  mockLoadError = new Error("Apple плащанията още не са настроени.");
  await render(<PlanList role="TRADER" onChanged={jest.fn()} />);
  expect(screen.getByText("49,99 €")).toBeTruthy();
  expect(screen.getByText("Абонирай се · 499,99 €")).toBeTruthy();
});

it("shows the success screen and takes a farmer into the app after purchase", async () => {
  await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
  await fireEvent.press(screen.getByText("Абонирай се · 499,99 €"));
  expect(mockSetQueryData).toHaveBeenCalled();
  expect(await screen.findByText("Добре дошъл в AgroGrain Premium")).toBeTruthy();
  expect(screen.getByText("14.10.2027")).toBeTruthy();
  await fireEvent.press(screen.getByText("Пазарни цени"));
  expect(router.replace).toHaveBeenCalledWith("/market");
});

it("sends a trader to the trade section after purchase", async () => {
  (api as jest.Mock).mockResolvedValue({
    ...mockActiveMe,
    user: { id: "u1", role: "TRADER" },
    subscription: { ...mockActiveMe.subscription, canTrade: true },
  });
  await render(<PlanList role="TRADER" onChanged={jest.fn()} />);
  await fireEvent.press(screen.getByText("Абонирай се · 499,99 €"));
  await fireEvent.press(await screen.findByText("Към Борса"));
  expect(router.replace).toHaveBeenCalledWith("/trade");
});

it("shows the success screen after restoring purchases", async () => {
  await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
  await fireEvent.press(screen.getByText("Възстанови покупки"));
  expect(mockRestore).toHaveBeenCalledTimes(1);
  expect(await screen.findByText("Покупките са възстановени")).toBeTruthy();
  await fireEvent.press(screen.getByText("Към началото"));
  expect(router.replace).toHaveBeenCalledWith("/");
});
