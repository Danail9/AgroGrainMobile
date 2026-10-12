import { useQueryClient } from "@tanstack/react-query";
import { useStripe } from "@stripe/stripe-react-native";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { z } from "zod";

import { api, isApiError } from "@/api/client";
import { keys, usePlans, useStartCheckout } from "@/api/queries";
import { meSchema, type Me } from "@/api/schemas";
import { STRIPE_PUBLISHABLE_KEY } from "@/config";
import { formatShortDate } from "@/lib/format";
import { planTierLabel } from "@/lib/plans";
import { colors, radius, space } from "@/theme/tokens";
import { showDialog } from "@/ui/Dialog";
import { Button, FormMessage } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { Card, Pill, pressedStyle } from "@/ui/primitives";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { AppText } from "@/ui/Text";

type Plan = NonNullable<ReturnType<typeof usePlans>["data"]>["plans"][number];
type BillingInterval = Plan["interval"];

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
 * Role-specific billing plans, with the current subscription marked. Paying
 * happens in Stripe's PaymentSheet; paid plan changes start at the next renewal.
 */
export function PlanList({
  role,
  onChanged,
}: {
  role: Me["user"]["role"];
  onChanged: () => void;
}) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const plans = usePlans();
  const checkout = useStartCheckout();
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval | null>(null);

  async function choose(plan: Plan, immediateUpgrade = false) {
    setError(null);
    setBusy(plan.name);
    let paymentAccepted = false;
    try {
      const refreshed = await plans.refetch();
      const billing = refreshed.data;
      if (refreshed.isError || !billing) throw new Error("Не успяхме да проверим абонамента. Опитай отново.");
      if (immediateUpgrade && !billing.supportsImmediateUpgrades) {
        throw new Error("Незабавното надграждане още не е налично. Не е изпратена заявка за плащане.");
      }
      if (billing.current && !billing.current.managedByAdmin &&
          !immediateUpgrade && !billing.supportsScheduledChanges) {
        throw new Error("Промяната при подновяване още не е налична. Не е изпратена заявка за плащане. Опитай отново след обновяването на услугата.");
      }
      if (!STRIPE_PUBLISHABLE_KEY) throw new Error("Плащането не е настроено.");
      const input = {
        interval: plan.interval,
        tier: plan.tier,
        changeTiming: immediateUpgrade ? "IMMEDIATE_UPGRADE" as const : "RENEWAL" as const,
      };
      let session = await checkout.mutateAsync(input);
      if (session.setupIntentClientSecret) {
        if (!immediateUpgrade || !session.setupIntentId) {
          throw new Error("Сървърът не потвърди добавянето на карта за надграждане.");
        }
        const init = await initPaymentSheet({
          merchantDisplayName: "AgroGrain",
          setupIntentClientSecret: session.setupIntentClientSecret,
          returnURL: "agrograin://stripe-redirect",
        });
        if (init.error) throw new Error(init.error.message);
        const result = await presentPaymentSheet();
        if (result.error) {
          if (result.error.code !== "Canceled") throw new Error(result.error.message);
          return;
        }
        session = await checkout.mutateAsync({ ...input, setupIntentId: session.setupIntentId });
      }
      if (immediateUpgrade && !session.immediateUpgrade) {
        await plans.refetch();
        onChanged();
        throw new Error("Сървърът не потвърди незабавно надграждане. Провери абонамента и плащанията, преди да опиташ отново.");
      }
      if (session.scheduledChange) {
        await plans.refetch();
        onChanged();
        showDialog({
          title: "Промяната е планирана",
          message: `${planTierLabel(plan.tier, role)} започва на ${formatShortDate(new Date(session.scheduledChange.effectiveAt))}. Дотогава запазваш текущия си план. Няма плащане сега.`,
          icon: "calendar",
          actions: [{ label: "Разбрах", style: "primary" }],
        });
        return;
      }
      if (!session.paymentIntentClientSecret && !session.immediateUpgrade) {
        await plans.refetch();
        onChanged();
        throw new Error("Сървърът не потвърди планирана промяна. Провери текущия си абонамент и плащанията, преди да опиташ отново.");
      }
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
      paymentAccepted = true;
      // The Stripe webhook activates the plan a moment after the payment.
      const wantsTrade = plan.tradeFeatures.length > 0;
      let activated = false;
      for (let attempt = 0; attempt < 12 && !activated; attempt++) {
        // Ask the server to read the payment from Stripe instead of waiting for the webhook.
        await api("/subscription/sync", { method: "POST", schema: z.object({ synced: z.boolean() }) });
        const me = await api("/me", { schema: meSchema });
        client.setQueryData(keys.me, me);
        const sub = me.subscription;
        activated = sub.active && sub.tier === plan.tier && sub.interval === plan.interval && (!wantsTrade || sub.canTrade);
        if (!activated) await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      void client.invalidateQueries({ queryKey: keys.trade });
      void client.invalidateQueries({ queryKey: keys.home });
      void client.invalidateQueries({ queryKey: keys.notifications });
      await plans.refetch();
      onChanged();

      if (activated) {
        showDialog({
          title: "Успешно плащане",
          message: wantsTrade
            ? "Абонаментът ти е активен. Вече имаш достъп до Борса."
            : "Абонаментът ти е активен. Вече имаш достъп до времето, цените, новините и AI анализите.",
          icon: "checkmark-circle",
          tone: "success",
          actions: [{
            label: wantsTrade ? "Към Борса" : "Към началото",
            style: "primary",
            onPress: () => router.replace(wantsTrade ? "/trade" : "/"),
          }],
        });
      } else {
        showDialog({
          title: "Плащането е прието",
          message: "Активирането отнема няколко секунди. Издърпай надолу, за да обновиш.",
          icon: "time",
          actions: [{ label: "Разбрах", style: "primary" }],
        });
      }
    } catch (e) {
      const message = isApiError(e) || e instanceof Error ? e.message : "Плащането не успя.";
      setError(paymentAccepted
        ? `Плащането е прието, но не успяхме да потвърдим активирането. Не плащай повторно. Обнови абонамента или се свържи с поддръжката. ${message}`
        : message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <QueryBoundary query={plans} stamp={false}>
      {({ plans: list, current, scheduledChange }) => {
        const interval = billingInterval ?? current?.interval ?? "MONTH";
        const rolePlans = list.filter((plan) =>
          (role === "FARMER" && plan.tier === "BASE") || (role === "TRADER" && plan.tier === "TRADER"),
        );
        const visiblePlans = rolePlans.filter((plan) => plan.interval === interval);

        return (
          <>
          {current ? (
            <Card
              style={{
                gap: 6,
                backgroundColor: colors.brand[50],
                borderColor: colors.brand[200],
                borderWidth: 1,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <Icon name="checkmark-circle" size={20} color={colors.brand[700]} />
                <AppText variant="small" bold style={{ flex: 1 }}>
                  Текущ абонамент
                </AppText>
                <Pill tone="brand">{current.interval === "MONTH" ? "Месечен" : "Годишен"}</Pill>
              </View>
              <AppText variant="heading">
                {planTierLabel(current.tier, role)}
              </AppText>
              {current.currentPeriodEnd ? (
                <AppText variant="small" bold>
                  Валиден до: {formatShortDate(new Date(current.currentPeriodEnd))}.{new Date(current.currentPeriodEnd).getFullYear()}
                </AppText>
              ) : null}
              <AppText variant="caption" tone="muted">
                {current.managedByAdmin
                  ? "Достъпът е предоставен от администратор."
                  : current.currentPeriodEnd
                    ? current.cancelAtPeriodEnd
                      ? "Автоматичното подновяване е спряно."
                      : `Следващо подновяване: ${formatShortDate(new Date(current.currentPeriodEnd))}.${new Date(current.currentPeriodEnd).getFullYear()}.`
                    : "Активен"}
              </AppText>
            </Card>
          ) : null}
          {scheduledChange ? (
            <Card style={{ gap: space.sm, backgroundColor: colors.brand[50] }}>
              <AppText variant="small" bold>Планирана промяна</AppText>
              <AppText variant="small">
                {planTierLabel(scheduledChange.tier, role)} · {scheduledChange.interval === "YEAR" ? "годишен" : "месечен"}
              </AppText>
              <AppText variant="caption" tone="muted">
                Започва на {formatShortDate(new Date(scheduledChange.effectiveAt))}. Дотогава запазваш текущия си план. Няма плащане сега.
              </AppText>
              {role === "TRADER" && current?.tier === "BASE" && !current.managedByAdmin &&
                scheduledChange.tier === "TRADER" &&
                scheduledChange.interval === current.interval ? (
                  <Button
                    title="Виж опцията за надграждане сега"
                    variant="secondary"
                    compact
                    onPress={() => setBillingInterval(current.interval)}
                  />
                ) : null}
            </Card>
          ) : null}

          <View style={{ gap: space.sm }}>
            <AppText variant="heading">
              Период на плащане
            </AppText>
            <View
              accessibilityRole="tablist"
              style={{
                flexDirection: "row",
                padding: 5,
                gap: 5,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.brand[100],
                backgroundColor: colors.brand[50],
              }}
            >
              {([
                { key: "MONTH", label: "Месечно", note: "За 1 месец" },
                { key: "YEAR", label: "Годишно", note: "За 12 месеца" },
              ] as const).map((option) => {
                const selected = interval === option.key;
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="tab"
                    accessibilityLabel={option.label}
                    accessibilityHint={option.note}
                    accessibilityState={{ selected }}
                    onPress={() => setBillingInterval(option.key)}
                    style={({ pressed }) => [{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                      minHeight: 64,
                      borderRadius: radius.md,
                      paddingHorizontal: space.sm,
                      paddingVertical: space.md,
                      backgroundColor: selected ? colors.brand[600] : "transparent",
                    }, pressed && pressedStyle]}
                  >
                    <AppText
                      variant="small"
                      bold
                      style={{ color: selected ? colors.white : colors.ink }}
                    >
                      {option.label}
                    </AppText>
                    <AppText
                      variant="caption"
                      align="center"
                      style={{ color: selected ? colors.white : colors.muted }}
                    >
                      {option.note}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <AppText variant="caption" tone="muted">
              {interval === "MONTH"
                ? "Плащаш за един месец при всяко подновяване."
                : "Плащаш за цялата година наведнъж."}
            </AppText>
          </View>

          {visiblePlans.length ? (
            visiblePlans.map((plan) => {
              const isCurrent =
                current?.interval === plan.interval && current.tier === plan.tier;
              const isScheduled = scheduledChange?.interval === plan.interval &&
                scheduledChange.tier === plan.tier;
              const canUpgrade = current && !current.managedByAdmin &&
                current.tier === "BASE" && plan.tier === "TRADER" &&
                current.interval === plan.interval;

              return (
                <Card
                  key={plan.name}
                  style={{
                    gap: space.md,
                    borderWidth: isCurrent ? 2 : 0,
                    borderColor: colors.brand[600],
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: space.sm,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="heading">{planTierLabel(plan.tier, role)}</AppText>
                      <AppText variant="caption" tone="muted">
                        {plan.tier === "BASE"
                          ? "За стопани"
                          : role === "FARMER"
                            ? "За стопани с достъп до Борса"
                            : "За търговци"}
                      </AppText>
                    </View>
                    {isCurrent ? <Pill tone="brand">Текущ план</Pill> : null}
                  </View>

                  <View style={{ gap: 2 }}>
                    <AppText variant="title">
                      {formatEuro(plan.priceCents)}{" "}
                      <AppText variant="small" tone="muted">
                        {plan.suffix}
                      </AppText>
                    </AppText>
                    {plan.savingCents ? (
                      <AppText variant="caption" style={{ color: colors.brand[700] }}>
                        Спестяваш {formatEuro(plan.savingCents)} спрямо месечно плащане
                      </AppText>
                    ) : null}
                  </View>

                  {plan.features.length ? (
                    <View style={{ gap: space.sm }}>
                      <AppText variant="caption" tone="muted" bold>
                        Включено в плана
                      </AppText>
                      <Features items={plan.features} />
                    </View>
                  ) : null}
                  {plan.tradeFeatures.length ? (
                    <View style={{ gap: space.sm }}>
                      <AppText variant="caption" tone="muted" bold>
                        Включена Борса
                      </AppText>
                      <Features items={plan.tradeFeatures} />
                    </View>
                  ) : (
                    <AppText variant="caption" tone="muted">
                      Борсата не е включена в този план.
                    </AppText>
                  )}
                  <Button
                    title={
                      canUpgrade
                        ? "Надгради сега"
                        : isScheduled
                        ? "Планиран за подновяване"
                        : isCurrent
                        ? "Текущият ти план"
                        : current && !current.managedByAdmin
                          ? "Промени при подновяване"
                          : "Избери този план"
                    }
                    variant={isCurrent ? "secondary" : "primary"}
                    disabled={isCurrent || (isScheduled && !canUpgrade) || busy !== null}
                    loading={busy === plan.name}
                    onPress={() => {
                      const switching = !!current && !current.managedByAdmin;
                      if (!switching) return void choose(plan);
                      if (canUpgrade) {
                        showDialog({
                          title: "Надграждане сега",
                          icon: "trending-up",
                          dismissable: true,
                          message: `Борсата ще бъде активирана веднага след успешно плащане. Stripe ще начисли разликата за оставащия платен период от запазената карта. Новата цена е ${formatEuro(plan.priceCents)} ${plan.suffix}. Датата на подновяване остава същата.${scheduledChange ? " Това заменя планираната промяна." : ""}`,
                          actions: [
                            { label: "Отказ", style: "cancel" },
                            { label: "Надгради и плати", style: "primary", onPress: () => void choose(plan, true) },
                          ],
                        });
                        return;
                      }
                      showDialog({
                        title: "Промяна при подновяване",
                        icon: "calendar",
                        dismissable: true,
                        message: `„${plan.name}“ за ${formatEuro(plan.priceCents)} ${plan.suffix} ще започне след края на текущия платен период${current.currentPeriodEnd ? ` на ${formatShortDate(new Date(current.currentPeriodEnd))}` : ""}. Запазваш текущия си достъп дотогава. Няма плащане сега.${scheduledChange ? " Това заменя вече планираната промяна." : ""}`,
                        actions: [
                          { label: "Отказ", style: "cancel" },
                          { label: "Планирай промяната", style: "primary", onPress: () => void choose(plan) },
                        ],
                      });
                    }}
                  />
                </Card>
              );
            })
          ) : (
            <Card>
              <AppText variant="small" tone="muted">
                В момента няма налични планове с {interval === "MONTH" ? "месечно" : "годишно"} плащане.
              </AppText>
            </Card>
          )}

          <FormMessage error={error} />
          <AppText variant="caption" tone="muted" style={{ textAlign: "center" }}>
            Цената е за избрания период и е без ДДС. Абонаментът се подновява автоматично и може да бъде спрян по всяко време.
          </AppText>
          </>
        );
      }}
    </QueryBoundary>
  );
}
