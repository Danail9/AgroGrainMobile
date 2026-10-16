import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { Platform } from "react-native";

import { api } from "@/api/client";
import { plansSchema } from "@/api/schemas";
import { showDialog } from "@/ui/Dialog";
import { PlanList } from "@/ui/PlanList";

beforeEach(() => { jest.replaceProperty(Platform, "OS", "android"); });
afterAll(() => { jest.restoreAllMocks(); });

jest.mock("@/ui/Dialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/config", () => ({ STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder" }));
jest.mock("@/api/client", () => ({
  ...jest.requireActual("@/api/client"),
  api: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
}));
jest.mock("@stripe/stripe-react-native", () => ({
  useStripe: () => ({
    initPaymentSheet: mockInitSheet,
    presentPaymentSheet: mockPresentSheet,
  }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn(),
  }),
}));
jest.mock("@/api/queries", () => ({
  keys: { me: ["me"], trade: ["trade"], home: ["home"], notifications: ["notifications"] },
  usePlans: () => ({
    data: mockPlans,
    fetchStatus: "idle",
    isError: false,
    refetch: jest.fn(async () => ({ data: mockPlans, isError: false })),
  }),
  useStartCheckout: () => ({ mutateAsync: mockCheckout }),
}));

const mockCheckout = jest.fn();
const mockInitSheet = jest.fn();
const mockPresentSheet = jest.fn();
const mockPlans = plansSchema.parse({
  supportsImmediateUpgrades: true,
  supportsScheduledChanges: true,
  recommendedTier: "TRADER",
  current: {
    tier: "TRADER",
    interval: "MONTH",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    managedByAdmin: false,
  },
  plans: [
    { tier: "BASE", interval: "MONTH", priceCents: 5000, name: "Стопанин · месечен", suffix: "/мес." },
    { tier: "BASE", interval: "YEAR", priceCents: 50000, name: "Стопанин · годишен", suffix: "/год." },
    { tier: "TRADER", interval: "MONTH", priceCents: 5000, name: "Търговец · месечен", suffix: "/мес." },
    { tier: "TRADER", interval: "YEAR", priceCents: 50000, name: "Търговец · годишен", suffix: "/год." },
  ].map((plan) => ({
    ...plan,
    savingCents: plan.interval === "YEAR" ? 10000 : null,
    features: ["Прогноза за времето"],
    tradeFeatures: ["Достъп до Борса"],
  })),
});

describe("role-specific subscription plans", () => {
  afterEach(() => {
    if (mockPlans.current) {
      mockPlans.current.tier = "TRADER";
      mockPlans.current.interval = "MONTH";
      mockPlans.current.currentPeriodEnd = null;
      mockPlans.current.cancelAtPeriodEnd = false;
    }
    mockPlans.scheduledChange = null;
    mockPlans.supportsScheduledChanges = true;
    mockCheckout.mockReset();
    mockInitSheet.mockReset();
    mockPresentSheet.mockReset();
    jest.mocked(api).mockReset();
    jest.mocked(router.replace).mockClear();
    jest.mocked(showDialog).mockClear();
    jest.restoreAllMocks();
  });

  it("shows the paid period end and renewal with the year", async () => {
    if (mockPlans.current) mockPlans.current.currentPeriodEnd = "2027-10-06T08:00:00.000Z";
    await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
    expect(screen.getByText("Валиден до: 06.10.2027")).toBeTruthy();
    expect(screen.getByText("Следващо подновяване: 06.10.2027.")).toBeTruthy();
  });

  it("shows expiry without promising renewal for canceled subscriptions", async () => {
    if (mockPlans.current) {
      mockPlans.current.currentPeriodEnd = "2027-10-06T08:00:00.000Z";
      mockPlans.current.cancelAtPeriodEnd = true;
    }
    await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
    expect(screen.getByText("Валиден до: 06.10.2027")).toBeTruthy();
    expect(screen.getByText("Автоматичното подновяване е спряно.")).toBeTruthy();
    expect(screen.queryByText(/Следващо подновяване/)).toBeNull();
  });
  it("collects a missing card then completes the immediate upgrade", async () => {
    if (mockPlans.current) mockPlans.current.tier = "BASE";
    const alert = jest.mocked(showDialog);
    mockCheckout
      .mockResolvedValueOnce({
        paymentIntentClientSecret: null, setupIntentClientSecret: "seti_secret", setupIntentId: "seti_1",
      })
      .mockResolvedValueOnce({ paymentIntentClientSecret: null, immediateUpgrade: true });
    mockInitSheet.mockResolvedValue({});
    mockPresentSheet.mockResolvedValue({});
    jest.mocked(api).mockResolvedValue({
      subscription: { active: true, tier: "TRADER", interval: "MONTH", canTrade: true },
    });
    await render(<PlanList role="TRADER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Надгради сега"));
    const confirm = alert.mock.calls[0]?.[0].actions?.find((button) => button.label === "Надгради и плати");
    await act(async () => { confirm?.onPress?.(); });
    expect(mockInitSheet).toHaveBeenCalledWith(expect.objectContaining({
      setupIntentClientSecret: "seti_secret",
    }));
    expect(mockCheckout).toHaveBeenLastCalledWith({
      interval: "MONTH", tier: "TRADER", changeTiming: "IMMEDIATE_UPGRADE", setupIntentId: "seti_1",
    });
    expect(router.replace).not.toHaveBeenCalled();
    const success = alert.mock.calls.find(([dialog]) => dialog.title === "Успешно плащане");
    expect(success?.[0].message).toContain("Вече имаш достъп до Борса");
    await act(async () => { success?.[0].actions?.[0].onPress?.(); });
    expect(router.replace).toHaveBeenCalledWith("/trade");
  });

  it("does not charge or unlock access when card entry is canceled", async () => {
    if (mockPlans.current) mockPlans.current.tier = "BASE";
    const alert = jest.mocked(showDialog);
    mockCheckout.mockResolvedValue({
      paymentIntentClientSecret: null, setupIntentClientSecret: "seti_secret", setupIntentId: "seti_1",
    });
    mockInitSheet.mockResolvedValue({});
    mockPresentSheet.mockResolvedValue({ error: { code: "Canceled" } });
    await render(<PlanList role="TRADER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Надгради сега"));
    const confirm = alert.mock.calls[0]?.[0].actions?.find((button) => button.label === "Надгради и плати");
    await act(async () => { confirm?.onPress?.(); });
    expect(mockCheckout).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });
  it("activates a new subscription after PaymentSheet succeeds", async () => {
    const alert = jest.mocked(showDialog);
    const previous = mockPlans.current;
    mockPlans.current = null;
    mockCheckout.mockResolvedValue({ paymentIntentClientSecret: "pi_secret" });
    mockInitSheet.mockResolvedValue({});
    mockPresentSheet.mockResolvedValue({});
    jest.mocked(api)
      .mockResolvedValueOnce({ synced: true })
      .mockResolvedValueOnce({
        subscription: { active: true, tier: "BASE", interval: "MONTH", canTrade: true },
      });
    const onChanged = jest.fn();
    try {
      await render(<PlanList role="FARMER" onChanged={onChanged} />);
      await act(async () => {
        await fireEvent.press(screen.getAllByText("Избери този план")[0]);
      });
      expect(mockInitSheet).toHaveBeenCalledWith(expect.objectContaining({
        paymentIntentClientSecret: "pi_secret",
      }));
      expect(api).toHaveBeenNthCalledWith(1, "/subscription/sync", expect.objectContaining({ method: "POST" }));
      expect(api).toHaveBeenNthCalledWith(2, "/me", expect.any(Object));
      expect(onChanged).toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
      const success = alert.mock.calls.find(([dialog]) => dialog.title === "Успешно плащане");
      expect(success?.[0].actions?.[0].label).toBe("Към Борса");
      await act(async () => { success?.[0].actions?.[0].onPress?.(); });
      expect(router.replace).toHaveBeenCalledWith("/trade");
    } finally {
      mockPlans.current = previous;
    }
  });

  it("warns against paying again when activation sync fails after payment", async () => {
    if (mockPlans.current) mockPlans.current.tier = "BASE";
    const alert = jest.mocked(showDialog);
    mockCheckout.mockResolvedValue({ immediateUpgrade: true, paymentIntentClientSecret: null });
    jest.mocked(api).mockRejectedValue(new Error("Sync unavailable"));
    await render(<PlanList role="TRADER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Надгради сега"));
    const confirm = alert.mock.calls[0]?.[0].actions?.find((button) => button.label === "Надгради и плати");
    await act(async () => { confirm?.onPress?.(); });
    expect(await screen.findByText(/Не плащай повторно/)).toBeTruthy();
    expect(screen.getByText(/Sync unavailable/)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    expect(api).toHaveBeenCalledTimes(1);
  });
  it("upgrades immediately after confirmation and opens Борса with refreshed access", async () => {
    if (mockPlans.current) mockPlans.current.tier = "BASE";
    const alert = jest.mocked(showDialog);
    mockCheckout.mockResolvedValue({ immediateUpgrade: true, paymentIntentClientSecret: null });
    jest.mocked(api).mockResolvedValue({
      subscription: { active: true, tier: "TRADER", interval: "MONTH", canTrade: true },
    });
    const onChanged = jest.fn();
    await render(<PlanList role="TRADER" onChanged={onChanged} />);
    await fireEvent.press(screen.getByText("Надгради сега"));
    expect(mockCheckout).not.toHaveBeenCalled();
    const confirm = alert.mock.calls[0]?.[0].actions?.find((button) => button.label === "Надгради и плати",
    );
    expect(confirm).toBeDefined();
    await act(async () => { confirm?.onPress?.(); });
    expect(mockCheckout).toHaveBeenCalledWith({
      tier: "TRADER", interval: "MONTH", changeTiming: "IMMEDIATE_UPGRADE",
    });
    expect(onChanged).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(expect.objectContaining({
      title: "Успешно плащане",
      message: expect.stringContaining("Вече имаш достъп до Борса"),
      actions: [expect.objectContaining({ label: "Към Борса" })],
    }));
    const success = alert.mock.calls.find(([dialog]) => dialog.title === "Успешно плащане");
    await act(async () => { success?.[0].actions?.[0].onPress?.(); });
    expect(router.replace).toHaveBeenCalledWith("/trade");
  });

  it("does not treat a scheduled response as a successful immediate upgrade", async () => {
    if (mockPlans.current) mockPlans.current.tier = "BASE";
    const alert = jest.mocked(showDialog);
    mockCheckout.mockResolvedValue({
      paymentIntentClientSecret: null,
      scheduledChange: { tier: "TRADER", interval: "MONTH", effectiveAt: "2027-10-06T08:00:00.000Z" },
    });
    await render(<PlanList role="TRADER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Надгради сега"));
    const confirm = alert.mock.calls[0]?.[0].actions?.find((button) => button.label === "Надгради и плати",
    );
    await act(async () => { confirm?.onPress?.(); });
    expect(await screen.findByText(/Сървърът не потвърди незабавно надграждане/)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("allows a legacy scheduled yearly trader upgrade to be activated now", async () => {
    if (mockPlans.current) {
      mockPlans.current.tier = "BASE";
      mockPlans.current.interval = "YEAR";
    }
    mockPlans.scheduledChange = {
      tier: "TRADER", interval: "YEAR", effectiveAt: "2027-10-06T08:00:00.000Z",
    };
    const alert = jest.mocked(showDialog);
    await render(<PlanList role="TRADER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Месечно"));
    await fireEvent.press(screen.getByText("Виж опцията за надграждане сега"));
    expect(screen.getByRole("tab", { name: "Годишно", selected: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Надгради сега", disabled: false })).toBeTruthy();
    await fireEvent.press(screen.getByText("Надгради сега"));
    expect(alert).toHaveBeenCalledWith(expect.objectContaining({
      title: "Надграждане сега", message: expect.stringContaining("Това заменя планираната промяна"),
    }));
  });
  it("offers an immediate same-period upgrade but schedules annual changes", async () => {
    if (mockPlans.current) mockPlans.current.tier = "BASE";
    const alert = jest.mocked(showDialog);
    await render(<PlanList role="TRADER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Надгради сега"));
    expect(alert).toHaveBeenCalledWith(expect.objectContaining({
      title: "Надграждане сега", message: expect.stringContaining("оставащия платен период"),
    }));
    await fireEvent.press(screen.getByText("Годишно"));
    expect(screen.queryByText("Надгради сега")).toBeNull();
    expect(screen.getAllByText("Промени при подновяване")).toHaveLength(1);
  });

  it("blocks older backends before sending a checkout that could charge immediately", async () => {
    mockPlans.supportsScheduledChanges = undefined;
    const alert = jest.mocked(showDialog);
    await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Промени при подновяване"));
    const confirm = alert.mock.calls[0]?.[0].actions?.find((button) => button.label === "Планирай промяната",
    );
    expect(confirm).toBeDefined();
    await act(async () => { confirm?.onPress?.(); });
    expect(await screen.findByText(/Не е изпратена заявка за плащане/)).toBeTruthy();
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it("shows a scheduled annual change while keeping the current monthly plan", async () => {
    if (mockPlans.current) mockPlans.current.tier = "BASE";
    mockPlans.scheduledChange = {
      interval: "YEAR", tier: "BASE", effectiveAt: "2026-11-06T08:00:00.000Z",
    };
    await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
    expect(screen.getByText("Планирана промяна")).toBeTruthy();
    expect(screen.getByText(/Няма плащане сега/)).toBeTruthy();
    expect(screen.getByText("Текущият ти план")).toBeTruthy();
    await fireEvent.press(screen.getByText("Годишно"));
    expect(screen.getByRole("button", {
      name: "Планиран за подновяване", disabled: true,
    })).toBeTruthy();
  });

  it("shows one full-access farmer plan for monthly and annual billing", async () => {
    await render(<PlanList role="FARMER" onChanged={jest.fn()} />);

    expect(screen.queryByText("Стопанин + Борса")).toBeNull();
    expect(screen.queryByText("Търговец")).toBeNull();
    expect(screen.getAllByText("Стопанин")).toHaveLength(2);
    expect(screen.getByText(/^50 €/)).toBeTruthy();
    expect(screen.queryByText(/^100 €/)).toBeNull();
    expect(screen.getByText("Достъп до Борса")).toBeTruthy();
    expect(screen.queryByText("За търговци")).toBeNull();
    expect(screen.getByText("За стопани")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Месечно", selected: true })).toBeTruthy();
    expect(screen.getByText("Плащаш за един месец при всяко подновяване.")).toBeTruthy();

    await fireEvent.press(screen.getByText("Годишно"));
    expect(screen.getByRole("tab", { name: "Годишно", selected: true })).toBeTruthy();
    expect(screen.getByText("Плащаш за цялата година наведнъж.")).toBeTruthy();
    expect(screen.getByText(/^500 €/)).toBeTruthy();
    expect(screen.queryByText(/^1000 €/)).toBeNull();
    expect(screen.getByText("Спестяваш 100 € спрямо месечно плащане")).toBeTruthy();
    expect(screen.queryByText("Текущият ти план")).toBeNull();
  });

  it("keeps trader plans available to trader accounts", async () => {
    await render(<PlanList role="TRADER" onChanged={jest.fn()} />);
    expect(screen.getByText(/^50 €/)).toBeTruthy();
    expect(screen.getAllByText("Търговец")).toHaveLength(2);
    expect(screen.getByText("Достъп до Борса")).toBeTruthy();
    expect(screen.queryByText(/^100 €/)).toBeNull();
  });
});
