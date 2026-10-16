import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, View } from "react-native";

import { api } from "@/api/client";
import { keys, useMe, usePlans } from "@/api/queries";
import { meSchema, type Me } from "@/api/schemas";
import { PRIVACY_URL, TERMS_URL } from "@/config";
import { formatEuro, formatFullDate } from "@/lib/format";
import {
  applePurchaseErrorMessage, buyApplePlan, isApplePurchaseCancelled, loadApplePlans,
  manageAppleSubscription, restoreApplePurchases,
} from "@/lib/apple-purchases";
import { colors, radius, space } from "@/theme/tokens";
import { showDialog } from "@/ui/Dialog";
import { Button } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { Card, Pill, pressedStyle } from "@/ui/primitives";
import { PurchaseProgress, PurchaseSuccess, type PurchaseStep, type PurchaseSuccessInfo } from "@/ui/PurchaseFlow";
import { AppText } from "@/ui/Text";

type Interval = "MONTH" | "YEAR";
type SyncState = { subscription?: Me["subscription"]; appleActive?: boolean } | undefined;
type PricedPlan = { id: string; displayPrice: string; price?: number | null; currency?: string };

const ACTIVATION_POLLS = 4;
const ACTIVATION_DELAY_MS = 1500;
const MODAL_HANDOFF_MS = 350;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function ApplePlanList({
  role,
  onChanged,
}: {
  role?: Me["user"]["role"];
  onChanged: () => void;
}) {
  const me = useMe();
  const plans = usePlans();
  const client = useQueryClient();
  const apple = useQuery({
    queryKey: ["applePlans", me.data?.user.id],
    queryFn: loadApplePlans,
    enabled: Boolean(me.data?.user.id),
    staleTime: 60_000,
    retry: false,
    meta: { persist: false },
  });
  const [selected, setSelected] = useState<Interval>("YEAR");
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState<PurchaseStep | null>(null);
  const [success, setSuccess] = useState<PurchaseSuccessInfo | null>(null);

  /** Pushes the confirmed state into every cache the gates read, then re-reads /me until it is active. */
  async function unlockAccess(state: SyncState) {
    if (state?.subscription) {
      client.setQueryData<Me>(keys.me, (old) => (old ? { ...old, subscription: state.subscription! } : old));
    }
    let fresh: Me | null = null;
    for (let attempt = 0; attempt < ACTIVATION_POLLS; attempt++) {
      try {
        fresh = await api("/me", { schema: meSchema });
        client.setQueryData(keys.me, fresh);
        if (fresh.subscription.active) break;
      } catch (err) {
        console.warn("[apple-purchases] /me refresh failed after purchase", err);
      }
      if (attempt < ACTIVATION_POLLS - 1 && !(state?.subscription?.active || state?.appleActive)) {
        await sleep(ACTIVATION_DELAY_MS);
      } else break;
    }
    for (const key of [keys.trade, keys.home, keys.notifications, keys.invoices, ["plans"]]) {
      void client.invalidateQueries({ queryKey: key });
    }
    void apple.refetch();
    onChanged();
    return {
      active: fresh?.subscription.active ?? state?.subscription?.active ?? state?.appleActive ?? false,
      trader: (fresh?.user.role ?? role) === "TRADER" || Boolean(fresh?.subscription.canTrade ?? state?.subscription?.canTrade),
      interval: (fresh?.subscription.interval ?? state?.subscription?.interval ?? null) as Interval | null,
      activeUntil: fresh?.subscription.currentPeriodEnd ?? state?.subscription?.currentPeriodEnd ?? null,
    };
  }

  function showError(e: unknown, title: string) {
    if (isApplePurchaseCancelled(e)) return;
    console.warn("[apple-purchases] operation rejected", e);
    showDialog({
      title,
      message: applePurchaseErrorMessage(e),
      icon: "alert-circle",
      tone: "danger",
      dismissable: true,
      actions: [
        { label: "Затвори", style: "cancel" },
        { label: "Възстанови покупки", style: "primary", onPress: () => void restore() },
      ],
    });
  }

  function showPending() {
    showDialog({
      title: "Плащането се обработва",
      message: "Apple прие плащането, но активирането още не е завършило. Достъпът ще се отключи автоматично до минута. Не плащай повторно.",
      icon: "time",
      actions: [{ label: "Разбрах", style: "primary" }],
    });
  }

  async function purchase(plan: PricedPlan, kind: "purchase" | "upgrade") {
    setBusy(plan.id);
    try {
      const state = await buyApplePlan(plan, setStep);
      setStep("activating");
      const result = await unlockAccess(state);
      setStep(null);
      // iOS drops a modal presented while another one is still dismissing.
      await sleep(MODAL_HANDOFF_MS);
      if (result.active) setSuccess({ kind, ...result });
      else showPending();
    } catch (e) {
      setStep(null);
      await sleep(MODAL_HANDOFF_MS);
      showError(e, "Плащането не е завършено");
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    try {
      const state = await restoreApplePurchases();
      setStep("activating");
      const result = await unlockAccess(state);
      setStep(null);
      await sleep(MODAL_HANDOFF_MS);
      if (result.active) setSuccess({ kind: "restore", ...result });
      else showPending();
    } catch (e) {
      setStep(null);
      if (!isApplePurchaseCancelled(e)) {
        showDialog({
          title: "Няма покупки за възстановяване",
          message: applePurchaseErrorMessage(e),
          icon: "alert-circle",
          tone: "danger",
          actions: [{ label: "Разбрах", style: "primary" }],
        });
      }
    } finally {
      setBusy(null);
    }
  }

  async function manage() {
    setBusy("manage");
    try {
      const state = await manageAppleSubscription();
      await unlockAccess(state as SyncState);
    } catch (e) {
      if (!isApplePurchaseCancelled(e)) showError(e, "App Store абонамент");
    } finally {
      setBusy(null);
    }
  }

  function finish(href: Href) {
    setSuccess(null);
    router.replace(href);
  }

  const rolePlans = plans.data?.plans.filter((p) =>
    (role === "FARMER" && p.tier === "BASE") || (role === "TRADER" && p.tier === "TRADER"),
  ) ?? plans.data?.plans ?? [];
  const monthCatalog = rolePlans.find((p) => p.interval === "MONTH") ?? plans.data?.plans?.find((p) => p.interval === "MONTH");
  const yearCatalog = rolePlans.find((p) => p.interval === "YEAR") ?? plans.data?.plans?.find((p) => p.interval === "YEAR");

  const defaultFeatures = role === "TRADER"
    ? [
        "Всички пазарни цени за зърно и торове в реално време",
        "Пълен достъп до търговски оферти в AgroGrain Борса",
        "Публикуване на неограничен брой търговски оферти",
        "Директен контакт с регистрирани производители",
        "Персонализирани известия за нови обяви и ценови промени",
      ]
    : [
        "Пазарни цени за зърно и торове в реално време",
        "14-дневна детайлна агро прогноза за времето",
        "AI анализи и седмични препоръки за пазара",
        "AgroGrain Борса — обяви и директен контакт с търговци",
        "Известия за резки движения в цените и критично време",
      ];
  const catalogFor = selected === "YEAR" ? yearCatalog : monthCatalog;
  const features = catalogFor ? [...catalogFor.features, ...catalogFor.tradeFeatures] : defaultFeatures;

  const monthPlan: PricedPlan = apple.data?.month ?? {
    id: "bg.agrograin.premium.monthly",
    displayPrice: monthCatalog ? formatEuro(monthCatalog.priceCents) : "49,99 €",
    price: monthCatalog ? monthCatalog.priceCents / 100 : 49.99,
    currency: "EUR",
  };
  const yearPlan: PricedPlan = apple.data?.year ?? {
    id: "bg.agrograin.premium.yearly",
    displayPrice: yearCatalog ? formatEuro(yearCatalog.priceCents) : "499,99 €",
    price: yearCatalog ? yearCatalog.priceCents / 100 : 499.99,
    currency: "EUR",
  };
  const savingPct = monthPlan.price && yearPlan.price
    ? Math.round((1 - yearPlan.price / (monthPlan.price * 12)) * 100)
    : 17;
  const yearPerMonth = yearPlan.price && (yearPlan.currency ?? "EUR") === "EUR"
    ? formatEuro(Math.round((yearPlan.price * 100) / 12))
    : null;

  const current = apple.data?.subscription;
  const end = current?.currentPeriodEnd;
  const isAppleActive = Boolean(apple.data?.appleActive);
  const isMonthlyActive = isAppleActive && current?.interval === "MONTH";
  const isYearlyActive = isAppleActive && current?.interval === "YEAR";
  const canPurchase = apple.data ? apple.data.canPurchase : true;
  const daysLeft = end ? Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000)) : null;
  const chosen = selected === "YEAR" ? yearPlan : monthPlan;

  return (
    <View style={{ gap: space.md }}>
      <PurchaseProgress step={step} />
      <PurchaseSuccess info={success} onNavigate={finish} />

      {isAppleActive ? (
        <Card style={{ gap: space.md, borderWidth: 1, borderColor: colors.brand[200] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View style={{
              width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.brand[600],
              alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="shield-checkmark" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading">{isYearlyActive ? "Годишен" : "Месечен"} абонамент</AppText>
              <AppText variant="caption" tone="muted">Платен чрез Apple ID</AppText>
            </View>
            <Pill tone={current?.cancelAtPeriodEnd ? "warn" : "brand"}>
              {current?.cancelAtPeriodEnd ? "Изтича" : "Активен"}
            </Pill>
          </View>
          {end ? (
            <View style={{ backgroundColor: colors.soft, borderRadius: radius.md, padding: space.md, gap: 2 }}>
              <AppText variant="small" bold>
                {current?.cancelAtPeriodEnd ? "Достъпът изтича на" : "Активен до"} {formatFullDate(new Date(end))}
              </AppText>
              <AppText variant="caption" tone="muted">
                {daysLeft !== null ? `Остават ${daysLeft} ${daysLeft === 1 ? "ден" : "дни"}. ` : ""}
                {current?.cancelAtPeriodEnd
                  ? "Подновяването е спряно — поднови от App Store, за да не загубиш достъп."
                  : "След това се подновява автоматично чрез Apple."}
              </AppText>
            </View>
          ) : null}
          <Button
            title="Управлявай в App Store"
            variant="secondary"
            icon="settings-outline"
            loading={busy === "manage"}
            disabled={busy !== null}
            onPress={() => void manage()}
          />
        </Card>
      ) : !canPurchase ? (
        <Card style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
          <Icon name="information-circle" size={22} color={colors.brand[600]} />
          <AppText variant="small" style={{ flex: 1 }}>
            Вече имаш активен план или безплатен достъп. Apple покупка не е нужна сега.
          </AppText>
        </Card>
      ) : null}

      {isMonthlyActive ? (
        <Card style={{ gap: space.md, borderWidth: 2, borderColor: colors.brand[600] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <AppText variant="heading">Премини на годишен</AppText>
            <Pill tone="brand">{`Спести ${savingPct}%`}</Pill>
          </View>
          <AppText variant="title">
            {yearPlan.displayPrice} <AppText variant="small" tone="muted">/ година</AppText>
          </AppText>
          {yearPerMonth ? (
            <AppText variant="small" tone="muted">
              {`Само ${yearPerMonth} на месец вместо ${monthPlan.displayPrice}.`}
            </AppText>
          ) : null}
          <Button
            title="Надгради до годишен"
            icon="arrow-up-circle"
            loading={busy === yearPlan.id}
            disabled={busy !== null}
            onPress={() => void purchase(yearPlan, "upgrade")}
          />
        </Card>
      ) : null}

      {!isAppleActive && canPurchase ? (
        <>
          <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
            <PlanOption
              title="Годишен"
              price={yearPlan.displayPrice}
              suffix="/ година"
              note={yearPerMonth ? `≈ ${yearPerMonth} / месец` : "Плащане веднъж годишно"}
              badge={`Спести ${savingPct}%`}
              selected={selected === "YEAR"}
              onPress={() => setSelected("YEAR")}
            />
            <PlanOption
              title="Месечен"
              price={monthPlan.displayPrice}
              suffix="/ месец"
              note="Гъвкаво, откажи по всяко време"
              selected={selected === "MONTH"}
              onPress={() => setSelected("MONTH")}
            />
          </View>

          <Card style={{ gap: space.sm }}>
            <AppText variant="small" bold>Какво получаваш</AppText>
            {features.map((feature) => (
              <View key={feature} style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
                <Icon name="checkmark-circle" size={18} color={colors.brand[600]} />
                <AppText variant="small" tone="muted" style={{ flex: 1 }}>{feature}</AppText>
              </View>
            ))}
          </Card>

          <View style={{ gap: space.xs }}>
            <Button
              title={`Абонирай се · ${chosen.displayPrice}`}
              icon="logo-apple"
              loading={busy === chosen.id}
              disabled={busy !== null}
              onPress={() => void purchase(chosen, "purchase")}
            />
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}>
              <Icon name="lock-closed" size={12} color={colors.muted} />
              <AppText variant="caption" tone="muted">Сигурно плащане чрез Apple · откажи по всяко време</AppText>
            </View>
          </View>
        </>
      ) : null}

      <Button
        title="Възстанови покупки"
        variant="ghost"
        loading={busy === "restore"}
        disabled={busy !== null}
        onPress={() => void restore()}
      />
      <AppText variant="caption" tone="muted">
        Плащането се начислява на Apple ID. Абонаментът се подновява автоматично, освен ако го спреш поне 24 часа преди края на периода. Управление и прекратяване: App Store → Абонаменти. Платеният период започва веднага; безплатният месец при регистрация не отлага Apple таксуването.
      </AppText>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: space.lg }}>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={() => void Linking.openURL(TERMS_URL).catch(() => undefined)}>
          <AppText variant="caption" tone="brand" bold>Условия за ползване</AppText>
        </Pressable>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => undefined)}>
          <AppText variant="caption" tone="brand" bold>Политика за поверителност</AppText>
        </Pressable>
      </View>
    </View>
  );
}

function PlanOption({
  title, price, suffix, note, badge, selected, onPress,
}: {
  title: string;
  price: string;
  suffix: string;
  note: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title} ${price} ${suffix}`}
      onPress={onPress}
      style={({ pressed }) => [{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.lg,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: selected ? colors.brand[600] : colors.line,
        backgroundColor: selected ? colors.brand[50] : colors.surface,
      }, pressed && pressedStyle]}
    >
      <Icon
        name={selected ? "radio-button-on" : "radio-button-off"}
        size={22}
        color={selected ? colors.brand[600] : colors.muted}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <AppText variant="heading">{title}</AppText>
          {badge ? <Pill tone="brand">{badge}</Pill> : null}
        </View>
        <AppText variant="caption" tone="muted">{note}</AppText>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <AppText bold numeric>{price}</AppText>
        <AppText variant="caption" tone="muted">{suffix}</AppText>
      </View>
    </Pressable>
  );
}
