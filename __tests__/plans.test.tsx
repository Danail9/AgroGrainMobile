import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import { router } from "expo-router";

import { api } from "@/api/client";
import { plansSchema } from "@/api/schemas";
import { PlanList } from "@/ui/PlanList";

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
    { tier: "TRADER", interval: "MONTH", priceCents: 10000, name: "Стопанин + Борса · месечен", suffix: "/мес." },
    { tier: "TRADER", interval: "YEAR", priceCents: 100000, name: "Стопанин + Борса · годишен", suffix: "/год." },
  ].map((plan) => ({
    ...plan,
    savingCents: null,
    features: ["Прогноза за времето"],
    tradeFeatures: plan.tier === "TRADER" ? ["Достъп до Борса"] : [],
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
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
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
    await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Надгради сега"));
    const confirm = alert.mock.calls[0]?.[2]?.find((button) => button.text === "Надгради и плати");
    await act(async () => { confirm?.onPress?.(); });
    expect(mockInitSheet).toHaveBeenCalledWith(expect.objectContaining({
      setupIntentClientSecret: "seti_secret",
    }));
    expect(mockCheckout).toHaveBeenLastCalledWith({
      interval: "MONTH", tier: "TRADER", changeTiming: "IMMEDIATE_UPGRADE", setupIntentId: "seti_1",
    });
    expect(router.replace).not.toHaveBeenCalled();
    const success = alert.mock.calls.find(([title]) => title === "Успешно плащане");
    expect(success?.[1]).toContain("Вече имаш достъп до Борса");
    await act(async () => { success?.[2]?.[0].onPress?.(); });
    expect(router.replace).toHaveBeenCalledWith("/trade");
  });

  it("does not charge or unlock access when card entry is canceled", async () => {
    if (mockPlans.current) mockPlans.current.tier = "BASE";
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockCheckout.mockResolvedValue({
      paymentIntentClientSecret: null, setupIntentClientSecret: "seti_secret", setupIntentId: "seti_1",
    });
    mockInitSheet.mockResolvedValue({});
    mockPresentSheet.mockResolvedValue({ error: { code: "Canceled" } });
    await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Надгради сега"));
    const confirm = alert.mock.calls[0]?.[2]?.find((button) => button.text === "Надгради и плати");
    await act(async () => { confirm?.onPress?.(); });
    expect(mockCheckout).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });
  it("activates a new subscription after PaymentSheet succeeds", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const previous = mockPlans.current;
    mockPlans.current = null;
    mockCheckout.mockResolvedValue({ paymentIntentClientSecret: "pi_secret" });
    mockInitSheet.mockResolvedValue({});
    mockPresentSheet.mockResolvedValue({});
    jest.mocked(api)
      .mockResolvedValueOnce({ synced: true })
      .mockResolvedValueOnce({
        subscription: { active: true, tier: "BASE", interval: "MONTH", canTrade: false },
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
      const success = alert.mock.calls.find(([title]) => title === "Успешно плащане");
      expect(success?.[2]?.[0].text).toBe("Към началото");
      await act(async () => { success?.[2]?.[0].onPress?.(); });
      expect(router.replace).toHaveBeenCalledWith("/");
    } finally {
      mockPlans.current = previous;
    }
  });

  it("warns against paying again when activation sync fails after payment", async () => {
    if (mockPlans.current) mockPlans.current.tier = "BASE";
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockCheckout.mockResolvedValue({ immediateUpgrade: true, paymentIntentClientSecret: null });
    jest.mocked(api).mockRejectedValue(new Error("Sync unavailable"));
    await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Надгради сега"));
    const confirm = alert.mock.calls[0]?.[2]?.find((button) => button.text === "Надгради и плати");
    await act(async () => { confirm?.onPress?.(); });
    expect(await screen.findByText(/Не плащай повторно/)).toBeTruthy();
    expect(screen.getByText(/Sync unavailable/)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    expect(api).toHaveBeenCalledTimes(1);
  });
  it("upgrades immediately after confirmation and opens Борса with refreshed access", async () => {
    if (mockPlans.current) mockPlans.current.tier = "BASE";
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockCheckout.mockResolvedValue({ immediateUpgrade: true, paymentIntentClientSecret: null });
    jest.mocked(api).mockResolvedValue({
      subscription: { active: true, tier: "TRADER", interval: "MONTH", canTrade: true },
    });
    const onChanged = jest.fn();
    await render(<PlanList role="FARMER" onChanged={onChanged} />);
    await fireEvent.press(screen.getByText("Надгради сега"));
    expect(mockCheckout).not.toHaveBeenCalled();
    const confirm = alert.mock.calls[0]?.[2]?.find(
      (button) => button.text === "Надгради и плати",
    );
    expect(confirm).toBeDefined();
    await act(async () => { confirm?.onPress?.(); });
    expect(mockCheckout).toHaveBeenCalledWith({
      tier: "TRADER", interval: "MONTH", changeTiming: "IMMEDIATE_UPGRADE",
    });
    expect(onChanged).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      "Успешно плащане",
      expect.stringContaining("Вече имаш достъп до Борса"),
      [expect.objectContaining({ text: "Към Борса" })],
      { cancelable: false },
    );
    const success = alert.mock.calls.find(([title]) => title === "Успешно плащане");
    await act(async () => { success?.[2]?.[0].onPress?.(); });
    expect(router.replace).toHaveBeenCalledWith("/trade");
  });

  it("does not treat a scheduled response as a successful immediate upgrade", async () => {
    if (mockPlans.current) mockPlans.current.tier = "BASE";
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockCheckout.mockResolvedValue({
      paymentIntentClientSecret: null,
      scheduledChange: { tier: "TRADER", interval: "MONTH", effectiveAt: "2027-10-06T08:00:00.000Z" },
    });
    await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Надгради сега"));
    const confirm = alert.mock.calls[0]?.[2]?.find(
      (button) => button.text === "Надгради и плати",
    );
    await act(async () => { confirm?.onPress?.(); });
    expect(await screen.findByText(/Сървърът не потвърди незабавно надграждане/)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("allows a scheduled yearly farmer upgrade to be activated now", async () => {
    if (mockPlans.current) {
      mockPlans.current.tier = "BASE";
      mockPlans.current.interval = "YEAR";
    }
    mockPlans.scheduledChange = {
      tier: "TRADER", interval: "YEAR", effectiveAt: "2027-10-06T08:00:00.000Z",
    };
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Месечно"));
    await fireEvent.press(screen.getByText("Виж опцията за надграждане сега"));
    expect(screen.getByRole("tab", { name: "Годишно", selected: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Надгради сега", disabled: false })).toBeTruthy();
    await fireEvent.press(screen.getByText("Надгради сега"));
    expect(alert).toHaveBeenCalledWith("Надграждане сега",
      expect.stringContaining("Това заменя планираната промяна"), expect.any(Array));
  });
  it("offers an immediate same-period upgrade but schedules annual changes", async () => {
    if (mockPlans.current) mockPlans.current.tier = "BASE";
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Надгради сега"));
    expect(alert).toHaveBeenCalledWith("Надграждане сега",
      expect.stringContaining("оставащия платен период"), expect.any(Array));
    await fireEvent.press(screen.getByText("Годишно"));
    expect(screen.queryByText("Надгради сега")).toBeNull();
    expect(screen.getAllByText("Промени при подновяване")).toHaveLength(2);
  });

  it("blocks older backends before sending a checkout that could charge immediately", async () => {
    mockPlans.supportsScheduledChanges = undefined;
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<PlanList role="FARMER" onChanged={jest.fn()} />);
    await fireEvent.press(screen.getByText("Промени при подновяване"));
    const confirm = alert.mock.calls[0]?.[2]?.find(
      (button) => button.text === "Планирай промяната",
    );
    expect(confirm).toBeDefined();
    await act(async () => { confirm?.onPress?.(); });
    expect(await screen.findByText(/Не е изпратена заявка за плащане/)).toBeTruthy();
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it("shows a scheduled annual change while keeping the current monthly plan", async () => {
    mockPlans.scheduledChange = {
      interval: "YEAR", tier: "TRADER", effectiveAt: "2026-11-06T08:00:00.000Z",
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

  it("shows both farmer products for monthly and annual billing without trader role labels", async () => {
    await render(<PlanList role="FARMER" onChanged={jest.fn()} />);

    expect(screen.getAllByText("Стопанин + Борса")).toHaveLength(2);
    expect(screen.queryByText("Търговец")).toBeNull();
    expect(screen.getByText("Стопанин")).toBeTruthy();
    expect(screen.getByText(/^50 €/)).toBeTruthy();
    expect(screen.getByText(/^100 €/)).toBeTruthy();
    expect(screen.getByText("Достъп до Борса")).toBeTruthy();
    expect(screen.queryByText("За търговци")).toBeNull();
    expect(screen.getByText("За стопани с достъп до Борса")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Месечно", selected: true })).toBeTruthy();
    expect(screen.getByText("Плащаш за един месец при всяко подновяване.")).toBeTruthy();

    await fireEvent.press(screen.getByText("Годишно"));
    expect(screen.getByRole("tab", { name: "Годишно", selected: true })).toBeTruthy();
    expect(screen.getByText("Плащаш за цялата година наведнъж.")).toBeTruthy();
    expect(screen.getByText(/^500 €/)).toBeTruthy();
    expect(screen.getByText(/^1000 €/)).toBeTruthy();
    expect(screen.getAllByText("Стопанин + Борса")).toHaveLength(2);
    expect(screen.queryByText("Текущият ти план")).toBeNull();
  });

  it("keeps trader plans available to trader accounts", async () => {
    await render(<PlanList role="TRADER" onChanged={jest.fn()} />);
    expect(screen.getByText(/^100 €/)).toBeTruthy();
    expect(screen.getByText("Достъп до Борса")).toBeTruthy();
    expect(screen.queryByText(/^50 €/)).toBeNull();
  });
});
