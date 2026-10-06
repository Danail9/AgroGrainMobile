import { useStripe } from "@stripe/stripe-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { isApiError } from "@/api/client";
import { usePlans, useStartCheckout } from "@/api/queries";
import { STRIPE_PUBLISHABLE_KEY } from "@/config";
import { colors, space } from "@/theme/tokens";
import { Button, FormMessage } from "@/ui/forms";
import { Gate } from "@/ui/Gate";
import { Icon } from "@/ui/Icon";
import { AppText } from "@/ui/Text";

type Interval = "MONTH" | "YEAR";

const INTERVAL_LABELS: Record<Interval, string> = { MONTH: "Месечно", YEAR: "Годишно" };

function formatEuro(cents: number) {
  const value = cents / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(".", ",")} €`;
}

/**
 * The inactive-subscription screen. The plans and prices come from the portal
 * (the plan tier follows the account type); payment happens in Stripe's
 * PaymentSheet without leaving the app.
 */
export function Paywall({
  checking,
  onRefresh,
  actions,
}: {
  checking: boolean;
  onRefresh: () => void;
  actions: ReactNode;
}) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const plans = usePlans();
  const checkout = useStartCheckout();
  const [interval, setInterval] = useState<Interval>("MONTH");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pay() {
    setError(null);
    setBusy(true);
    try {
      if (!STRIPE_PUBLISHABLE_KEY) throw new Error("Плащането не е настроено.");
      const session = await checkout.mutateAsync({ interval });
      const init = await initPaymentSheet({
        merchantDisplayName: "AgroGrain",
        paymentIntentClientSecret: session.paymentIntentClientSecret,
        returnURL: "agrograin://stripe-redirect",
      });
      if (init.error) throw new Error(init.error.message);

      const result = await presentPaymentSheet();
      if (result.error) {
        if (result.error.code !== "Canceled") throw new Error(result.error.message);
        return;
      }
      // The Stripe webhook activates the plan; re-check /me.
      onRefresh();
    } catch (e) {
      setError(isApiError(e) || e instanceof Error ? e.message : "Плащането не успя.");
    } finally {
      setBusy(false);
    }
  }

  const data = plans.data;

  return (
    <Gate
      icon="lock-closed-outline"
      title={data ? `Абонамент „${data.tierLabel}“` : "Абонамент"}
      message="Достъпът до AgroGrain изисква активен абонамент."
      actions={
        <>
          {data ? (
            <View style={{ gap: space.sm }}>
              {data.plans.map((plan) => {
                const selected = plan.interval === interval;
                return (
                  <Pressable
                    key={plan.interval}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setInterval(plan.interval)}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: space.md,
                      borderRadius: 14,
                      borderWidth: 2,
                      borderColor: selected ? colors.brand[600] : colors.line,
                      backgroundColor: colors.white,
                    }}
                  >
                    <AppText bold>{INTERVAL_LABELS[plan.interval]}</AppText>
                    <AppText bold>
                      {formatEuro(plan.priceCents)} {plan.suffix}
                    </AppText>
                  </Pressable>
                );
              })}
              <View style={{ gap: 6, paddingVertical: space.sm }}>
                {data.features.map((feature) => (
                  <View key={feature} style={{ flexDirection: "row", gap: space.sm }}>
                    <Icon name="checkmark-circle-outline" size={18} color={colors.brand[600]} />
                    <AppText variant="small" tone="muted" style={{ flex: 1 }}>
                      {feature}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          ) : plans.isError ? (
            <FormMessage error="Плановете не можаха да се заредят." />
          ) : null}
          <FormMessage error={error} />
          <Button title="Плати" loading={busy} disabled={!data} onPress={() => void pay()} />
          <Button title="Провери отново" variant="secondary" loading={checking} onPress={onRefresh} />
          {actions}
        </>
      }
    />
  );
}
