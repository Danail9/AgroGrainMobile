import { useQueryClient } from "@tanstack/react-query";
import { useStripe } from "@stripe/stripe-react-native";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { z } from "zod";

import { api, isApiError } from "@/api/client";
import { keys, usePlans, useStartCheckout } from "@/api/queries";
import { meSchema } from "@/api/schemas";
import { STRIPE_PUBLISHABLE_KEY } from "@/config";
import { formatShortDate } from "@/lib/format";
import { colors, space } from "@/theme/tokens";
import { Button, FormMessage } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { Card, Pill } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { AppText } from "@/ui/Text";

type Plan = NonNullable<ReturnType<typeof usePlans>["data"]>["plans"][number];

function formatEuro(cents: number) {
  const value = cents / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(".", ",")} €`;
}

function Features({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((item) => (
        <View key={item} style={{ flexDirection: "row", gap: space.sm }}>
          <Icon
            name="checkmark-circle-outline"
            size={18}
            color={muted ? colors.muted : colors.brand[600]}
          />
          <AppText variant="small" tone="muted" style={{ flex: 1 }}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/**
 * The portal's billing page: all four plans, the current one marked. Paying
 * happens in Stripe's PaymentSheet; an active paid plan is switched on the
 * saved card. `onChanged` runs once the payment went through.
 */
export function PlanList({ onChanged }: { onChanged: () => void }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const plans = usePlans();
  const checkout = useStartCheckout();
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(plan: Plan) {
    setError(null);
    setBusy(plan.name);
    try {
      if (!STRIPE_PUBLISHABLE_KEY) throw new Error("Плащането не е настроено.");
      const session = await checkout.mutateAsync({ interval: plan.interval, tier: plan.tier });
      if (session.paymentIntentClientSecret) {
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
      }
      // The Stripe webhook activates the plan a moment after the payment.
      const wantsTrade = plan.tier === "TRADER";
      let activated = false;
      for (let attempt = 0; attempt < 12 && !activated; attempt++) {
        // Ask the server to read the payment from Stripe instead of waiting for the webhook.
        await api("/subscription/sync", { method: "POST", schema: z.object({ synced: z.boolean() }) }).catch(() => undefined);
        const me = await api("/me", { schema: meSchema });
        client.setQueryData(keys.me, me);
        const sub = me.subscription;
        activated = sub.active && sub.tier === plan.tier && (!wantsTrade || sub.canTrade);
        if (!activated) await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      void client.invalidateQueries({ queryKey: keys.trade });
      void client.invalidateQueries({ queryKey: keys.home });
      void plans.refetch();
      onChanged();

      if (activated) {
        router.replace(wantsTrade ? "/trade" : "/");
      } else {
        Alert.alert(
          "Плащането е прието",
          "Активирането отнема няколко секунди. Издърпай надолу, за да обновиш.",
        );
      }
    } catch (e) {
      setError(isApiError(e) || e instanceof Error ? e.message : "Плащането не успя.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <QueryBoundary query={plans} stamp={false}>
      {({ plans: list, current, recommendedTier }) => (
        <>
          {current ? (
            <Card style={{ gap: 4 }}>
              <AppText variant="small" bold>
                Активен план:{" "}
                {list.find((p) => p.interval === current.interval && p.tier === current.tier)?.name}
              </AppText>
              <AppText variant="caption" tone="muted">
                {current.managedByAdmin
                  ? "Достъпът е предоставен от администратор."
                  : current.currentPeriodEnd
                    ? `${current.cancelAtPeriodEnd ? "Приключва" : "Подновява се"} на ${formatShortDate(new Date(current.currentPeriodEnd))}`
                    : "Активен"}
              </AppText>
            </Card>
          ) : null}

          {list.map((plan) => {
            const isCurrent =
              current?.interval === plan.interval && current.tier === plan.tier;
            const best = plan.interval === "YEAR" && plan.tier === "TRADER";
            return (
              <Card
                key={plan.name}
                style={{
                  gap: space.md,
                  borderWidth: best || plan.tier === recommendedTier ? 2 : 0,
                  borderColor: best ? colors.brand[600] : colors.brand[100],
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
                  <AppText bold style={{ flex: 1 }}>
                    {plan.name}
                  </AppText>
                  {best ? <Pill tone="brand">Най-изгоден</Pill> : null}
                </View>
                <View>
                  <AppText variant="title">
                    {formatEuro(plan.priceCents)}{" "}
                    <AppText variant="small" tone="muted">
                      {plan.suffix}
                    </AppText>
                  </AppText>
                  {plan.savingCents ? (
                    <AppText variant="caption" style={{ color: colors.brand[600] }}>
                      Спестяваш {formatEuro(plan.savingCents)} спрямо месечния
                    </AppText>
                  ) : null}
                </View>
                <Features items={plan.features} />
                {plan.tradeFeatures.length ? (
                  <>
                    <AppText variant="caption" tone="muted" bold>
                      ЗА ТЪРГОВЦИ
                    </AppText>
                    <Features items={plan.tradeFeatures} />
                  </>
                ) : (
                  <AppText variant="caption" tone="muted">
                    Без достъп до Борса.
                  </AppText>
                )}
                <Button
                  title={isCurrent ? "Текущият ти план" : current && !current.managedByAdmin ? "Смени и плати" : "Избери и плати"}
                  variant={isCurrent ? "secondary" : "primary"}
                  disabled={isCurrent || busy !== null}
                  loading={busy === plan.name}
                  onPress={() => {
                    const switching = !!current && !current.managedByAdmin;
                    if (!switching) return void choose(plan);
                    Alert.alert(
                      `Смяна на плана: ${plan.name}`,
                      `Сменяш на „${plan.name}“ за ${formatEuro(plan.priceCents)} ${plan.suffix}. Ще бъде удържана разликата за оставащия период от запазената ти карта.`,
                      [
                        { text: "Отказ", style: "cancel" },
                        { text: "Плати", onPress: () => void choose(plan) },
                      ],
                    );
                  }}
                />
              </Card>
            );
          })}

          <FormMessage error={error} />
          <AppText variant="caption" tone="muted" style={{ textAlign: "center" }}>
            Цените са в евро, без ДДС. Абонаментът се подновява автоматично и може да бъде спрян по всяко време.
          </AppText>
        </>
      )}
    </QueryBoundary>
  );
}
