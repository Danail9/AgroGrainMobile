import { fireEvent, render, screen } from "@testing-library/react-native";

import { notificationPrefsSchema, type Me } from "@/api/schemas";
import { phoneInput } from "@/lib/phone";
import { initialsOf, notificationSummary } from "@/lib/settings";
import { NotificationPrefsForm, PasswordForm, ProfileForm } from "@/ui/SettingsForms";

const mockMutate = jest.fn();
jest.mock("@/api/queries", () => ({
  useUpdateProfile: () => ({ mutate: mockMutate, isPending: false }),
  useUpdatePrefs: () => ({ mutate: mockMutate, isPending: false }),
}));
jest.mock("@/lib/push", () => ({ pushSupported: () => false, pushUnavailableReason: () => "Push unavailable", enablePush: jest.fn(), disablePush: jest.fn() }));
jest.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ adoptSession: jest.fn() }) }));

const prefs = notificationPrefsSchema.parse({
  enabled: true, newOffer: true, newListing: true, subscriptionUpgrade: true,
  subscriptionReminder: true, priceMove: true, priceThreshold: 3, heavyRain: true,
  frost: true, strongWind: false, goodFieldWork: false, push: true,
});

const user: Me["user"] = {
  id: "u1",
  email: "d@abv.bg",
  name: "Dobromir Dinev",
  farmName: "Dinev Agro",
  phone: "+359897321321",
  role: "FARMER",
  regionSlug: "dobrich",
  regionName: "Добрич",
  settlement: null,
};

beforeEach(() => mockMutate.mockReset());

describe("price update notification preferences", () => {
  it.each(["FARMER", "TRADER", "ADMIN"] as const)("shows and saves the price-update switch for %s", async (role) => {
    await render(<NotificationPrefsForm prefs={prefs} role={role} />);
    const toggle = screen.getByRole("switch", { name: "Актуализации на цените" });
    expect(toggle.props.value).toBe(true);
    await fireEvent(toggle, "valueChange", false);
    expect(mockMutate).toHaveBeenCalledWith({ priceMove: false }, expect.any(Object));
  });

  it("disables price notifications when the global setting is off", async () => {
    await render(<NotificationPrefsForm prefs={{ ...prefs, enabled: false }} role="ADMIN" />);
    expect(screen.getByRole("switch", { name: "Актуализации на цените" }).props.disabled).toBe(true);
  });
});

describe("settings helpers", () => {
  it("builds initials from the first and last name", () => {
    expect(initialsOf("Dobromir Dinev")).toBe("DD");
    expect(initialsOf("  иван  ")).toBe("И");
    expect(initialsOf("Иван Петров Иванов")).toBe("ИИ");
    expect(initialsOf("")).toBe("?");
  });

  it("summarises the notification switches for the role", () => {
    expect(notificationSummary(prefs, "FARMER")).toBe("Включени · 9 от 11");
    expect(notificationSummary({ ...prefs, enabled: false }, "FARMER")).toBe("Спрени");
    expect(notificationSummary({ ...prefs, strongWind: true, goodFieldWork: true }, "ADMIN")).toBe("Всички включени");
  });

  it("keeps only digits and single spaces in a phone number", () => {
    expect(phoneInput("+359 (88) 8-123")).toBe("359 88 8123");
    expect(phoneInput(" 888  123abc")).toBe("888 123");
  });
});

describe("ProfileForm", () => {
  it("enables saving only after a change", async () => {
    await render(<ProfileForm user={user} />);
    expect(screen.getByText("Няма промени")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Телефон"), "888 123 456");
    await fireEvent.press(screen.getByText("Запази промените"));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "888 123 456", phoneCode: "+359" }),
      expect.any(Object),
    );
  });

  it("picks the dial code from a country list", async () => {
    await render(<ProfileForm user={user} />);
    await fireEvent.press(screen.getByLabelText("Код на държава +359. Промени"));
    await fireEvent.press(screen.getByText("Румъния"));
    expect(screen.getByLabelText("Код на държава +40. Промени")).toBeTruthy();
  });
});

describe("PasswordForm", () => {
  it("checks the new password as it is typed", async () => {
    await render(<PasswordForm />);
    await fireEvent.changeText(screen.getByLabelText("Нова парола"), "short");
    expect(screen.getByText("Поне 8 символа")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Текуща парола"), "old-pass");
    await fireEvent.changeText(screen.getByLabelText("Нова парола"), "longer-pass");
    await fireEvent.changeText(screen.getByLabelText("Повтори новата парола"), "longer-pass");
    expect(screen.getByText("Паролите съвпадат")).toBeTruthy();
    expect(screen.getAllByLabelText("Покажи паролата")).toHaveLength(3);
  });
});

describe("groupNewsByDay", () => {
  it("splits articles into today, yesterday and earlier", () => {
    const { groupNewsByDay } = jest.requireActual("@/lib/news") as typeof import("@/lib/news");
    const now = new Date(2026, 9, 9, 10, 0).getTime();
    const at = (d: number, h: number) => ({ publishedAt: new Date(2026, 9, d, h).toISOString() });
    const groups = groupNewsByDay([at(9, 8), at(8, 23), at(8, 1), at(5, 12)], now);
    expect(groups.map((g) => [g.title, g.items.length])).toEqual([["Днес", 1], ["Вчера", 2], ["По-рано", 1]]);
  });
});
