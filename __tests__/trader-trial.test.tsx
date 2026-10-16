import { render, screen } from "@testing-library/react-native";
import { subscriptionSchema } from "@/api/schemas";
import { subscriptionLabel } from "@/lib/plans";
import { TrialNotice } from "@/ui/TrialNotice";

const base = {
  active: true, canTrade: true, exempt: false, freeAccess: true, status: "NONE",
  interval: null, tier: null, currentPeriodEnd: null, cancelAtPeriodEnd: false,
};

it("parses trial fields and displays expiry and no automatic charge", async () => {
  const subscription = subscriptionSchema.parse({
    ...base, trialActive: true, trialEndsAt: "2026-11-13T08:00:00Z",
  });
  expect(subscriptionLabel(subscription, "TRADER")).toBe("Безплатен пробен месец");
  await render(<TrialNotice subscription={subscription} />);
  expect(screen.getByText(/13.11.2026/)).toBeTruthy();
  expect(screen.getByText(/Няма автоматично таксуване/)).toBeTruthy();
});

it("shows the payment requirement for an expired trial", async () => {
  const subscription = subscriptionSchema.parse({
    ...base, active: false, freeAccess: false, trialActive: false, trialEndsAt: "2026-11-13T08:00:00Z",
  });
  await render(<TrialNotice subscription={subscription} />);
  expect(screen.getByText("Пробният месец приключи")).toBeTruthy();
  expect(screen.getByText(/Избери платен план/)).toBeTruthy();
});

it("supports older server payloads without trial fields", async () => {
  const subscription = subscriptionSchema.parse(base);
  await render(<TrialNotice subscription={subscription} />);
  expect(screen.queryByText("Безплатен пробен месец")).toBeNull();
  expect(subscriptionLabel(subscription)).toBe("Свободен достъп");
});

it("does not label a paid subscription as a trial", async () => {
  const subscription = subscriptionSchema.parse({
    ...base, freeAccess: false, interval: "MONTH", tier: "TRADER", trialActive: false,
    trialEndsAt: "2026-11-13T08:00:00Z",
  });
  await render(<TrialNotice subscription={subscription} />);
  expect(screen.queryByText("Безплатен пробен месец")).toBeNull();
  expect(subscriptionLabel(subscription)).toBe("Търговец · месечен");
});
