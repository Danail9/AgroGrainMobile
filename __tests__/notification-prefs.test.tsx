import { fireEvent, render, screen } from "@testing-library/react-native";

import { notificationPrefsSchema } from "@/api/schemas";
import { NotificationPrefsForm } from "@/ui/SettingsForms";

const mockMutate = jest.fn();
jest.mock("@/api/queries", () => ({
  useUpdatePrefs: () => ({ mutate: mockMutate, isPending: false }),
}));
jest.mock("@/lib/push", () => ({
  pushSupported: () => false,
  pushUnavailableReason: () => null,
  enablePush: jest.fn(),
  disablePush: jest.fn(),
}));
jest.mock("@/auth/AuthContext", () => ({ useAuth: jest.fn() }));

const prefs = notificationPrefsSchema.parse({
  enabled: true, newOffer: true, newListing: true, subscriptionUpgrade: true,
  subscriptionReminder: true,
  priceMove: true, priceThreshold: 3, heavyRain: true, frost: true,
  strongWind: false, goodFieldWork: false, push: true,
});

beforeEach(() => mockMutate.mockReset());

describe("notification settings", () => {
  it.each(["FARMER", "TRADER", "ADMIN"] as const)("shows only relevant Борса controls for %s", async (role) => {
    await render(<NotificationPrefsForm prefs={prefs} role={role} />);
    expect(!!screen.queryByLabelText("Нови оферти в Борса")).toBe(role === "FARMER");
    expect(!!screen.queryByLabelText("Нови обяви в Борса")).toBe(role === "TRADER");
    expect(!!screen.queryByText("Борса")).toBe(role !== "ADMIN");
    expect(screen.getByLabelText("Промяна в цените")).toBeTruthy();
  });
  it.each([
    ["Всички известия", "enabled"],
    ["Нови оферти в Борса", "newOffer"],
    ["Нови обяви в Борса", "newListing"],
    ["Надграждане на абонамента", "subscriptionUpgrade"],
    ["Напомняне за абонамента", "subscriptionReminder"],
    ["Промяна в цените", "priceMove"],
    ["Очаквани валежи", "heavyRain"],
    ["Ниски температури", "frost"],
    ["Силен вятър", "strongWind"],
    ["Подходящи дни за работа", "goodFieldWork"],
  ])("saves only the %s category", async (label, key) => {
    await render(<NotificationPrefsForm prefs={prefs} role={key === "newListing" ? "TRADER" : "FARMER"} />);
    for (const enabled of [false, true]) {
      await fireEvent(screen.getByLabelText(label), "valueChange", enabled);
      expect(mockMutate).toHaveBeenLastCalledWith({ [key]: enabled }, expect.any(Object));
    }
  });

  it("disables categories while paused and keeps their saved choices", async () => {
    await render(<NotificationPrefsForm prefs={{ ...prefs, enabled: false }} role="FARMER" />);
    const offer = screen.getByLabelText("Нови оферти в Борса");
    expect(offer.props.disabled).toBe(true);
    expect(offer.props.value).toBe(true);
    expect(screen.getByLabelText("Всички известия").props.disabled).toBe(false);
    await fireEvent(screen.getByLabelText("Всички известия"), "valueChange", true);
    expect(mockMutate).toHaveBeenCalledWith({ enabled: true }, expect.any(Object));
  });

  it("shows a save error instead of reporting success", async () => {
    mockMutate.mockImplementation((_patch, callbacks) => callbacks.onError(new Error("offline")));
    await render(<NotificationPrefsForm prefs={prefs} role="FARMER" />);
    await fireEvent(screen.getByLabelText("Нови оферти в Борса"), "valueChange", false);
    expect(screen.getByText("Записът е неуспешен. Опитай отново.")).toBeTruthy();
    expect(screen.queryByText("Настройките са запазени.")).toBeNull();
  });
});
