import { Linking, Pressable, View } from "react-native";

import { isApiError } from "@/api/client";
import { useInvoices, usePlans, useSetRenewal } from "@/api/queries";
import type { Me } from "@/api/schemas";
import { formatShortDate } from "@/lib/format";
import { colors, space } from "@/theme/tokens";
import { confirmDialog, showDialog } from "@/ui/Dialog";
import { Button } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { Card, Divider, Pill, pressedStyle } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

function formatMoney(cents: number, currency: string) {
  const amount = (cents / 100).toFixed(2).replace(".", ",");
  return currency.toUpperCase() === "EUR" ? `${amount} €` : `${amount} ${currency.toUpperCase()}`;
}

const STATUS = {
  paid: { label: "Платена", tone: "brand" },
  open: { label: "Чака плащане", tone: "warn" },
  void: { label: "Анулирана", tone: "neutral" },
  uncollectible: { label: "Неплатена", tone: "danger" },
  draft: { label: "Чернова", tone: "neutral" },
} as const;

/** Stop or restore auto-renewal of a card subscription; access runs to the period end. */
export function RenewalCard({ subscription }: { subscription: Me["subscription"] }) {
  const plans = usePlans();
  const renewal = useSetRenewal();
  const current = plans.data?.current;

  if (
    !current || current.managedByAdmin || subscription.status !== "ACTIVE" ||
    (current.paymentMethod && current.paymentMethod !== "STRIPE")
  ) {
    return null;
  }

  const end = current.currentPeriodEnd ? formatShortDate(new Date(current.currentPeriodEnd)) : null;
  const scheduled = plans.data?.scheduledChange;

  async function change(renew: boolean) {
    const ok = renew
      ? true
      : await confirmDialog({
          title: "Да спра ли автоматичното подновяване?",
          message: [
            end ? `Запазваш пълния достъп до ${end}. След това абонаментът няма да се поднови и няма да бъдеш таксуван.` : "Абонаментът няма да се поднови и няма да бъдеш таксуван отново.",
            scheduled ? "Планираната смяна на плана също ще бъде отменена." : null,
            "Можеш да го включиш отново по всяко време преди тази дата.",
          ].filter(Boolean).join(" "),
          confirmLabel: "Спри подновяването",
          cancelLabel: "Остави го",
          destructive: true,
          icon: "pause-circle-outline",
        });
    if (!ok) return;
    renewal.mutate(renew, {
      onSuccess: () => {
        void plans.refetch();
        showDialog({
          title: renew ? "Подновяването е включено" : "Подновяването е спряно",
          message: renew
            ? `Абонаментът ще се поднови автоматично${end ? ` на ${end}` : ""}.`
            : `Достъпът ти остава активен${end ? ` до ${end}` : " до края на платения период"}.`,
          icon: "checkmark-circle",
          tone: "success",
        });
      },
      onError: (e) =>
        showDialog({
          title: "Промяната не е запазена",
          message: isApiError(e) ? e.message : "Опитай отново.",
          icon: "alert-circle-outline",
          tone: "danger",
        }),
    });
  }

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Icon
          name={current.cancelAtPeriodEnd ? "pause-circle-outline" : "refresh-circle-outline"}
          size={22}
          color={current.cancelAtPeriodEnd ? colors.warn : colors.brand[600]}
        />
        <AppText variant="small" bold style={{ flex: 1 }}>
          Автоматично подновяване
        </AppText>
        <Pill tone={current.cancelAtPeriodEnd ? "warn" : "brand"}>
          {current.cancelAtPeriodEnd ? "Спряно" : "Включено"}
        </Pill>
      </View>
      <AppText variant="caption" tone="muted">
        {current.cancelAtPeriodEnd
          ? `Абонаментът няма да се поднови. Достъпът ти е активен${end ? ` до ${end}` : " до края на платения период"}.`
          : `Картата ти ще бъде таксувана автоматично${end ? ` на ${end}` : " в края на периода"}. Можеш да го спреш по всяко време — без такси.`}
      </AppText>
      <Button
        title={current.cancelAtPeriodEnd ? "Поднови автоматично" : "Спри подновяването"}
        variant={current.cancelAtPeriodEnd ? "primary" : "danger"}
        icon={current.cancelAtPeriodEnd ? "play-circle-outline" : "pause-circle-outline"}
        loading={renewal.isPending}
        onPress={() => void change(current.cancelAtPeriodEnd)}
      />
    </Card>
  );
}

/** Receipts for card payments and confirmed bank transfers, newest first. */
export function BillingHistory() {
  const invoices = useInvoices();
  const list = invoices.data?.invoices ?? [];

  if (invoices.isPending || (!list.length && !invoices.isError)) {
    return invoices.isPending ? null : (
      <Card>
        <AppText variant="small" bold>
          История на плащанията
        </AppText>
        <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
          Все още няма плащания.
        </AppText>
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <AppText variant="small" bold style={{ padding: space.lg }}>
        История на плащанията
      </AppText>
      {invoices.isError && !list.length ? (
        <>
          <Divider />
          <AppText variant="caption" tone="muted" style={{ padding: space.lg }}>
            Историята не можа да се зареди. Издърпай надолу, за да опиташ отново.
          </AppText>
        </>
      ) : null}
      {list.map((invoice) => {
        const url = invoice.hostedUrl ?? invoice.pdfUrl;
        const status = STATUS[invoice.status];
        return (
          <View key={invoice.id}>
            <Divider />
            <Pressable
              accessibilityRole={url ? "link" : undefined}
              disabled={!url}
              onPress={() => url && void Linking.openURL(url)}
              style={({ pressed }) => [
                { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
                pressed && pressedStyle,
              ]}
            >
              <Icon
                name={invoice.source === "BANK_TRANSFER" ? "business-outline" : "card-outline"}
                size={20}
                color={colors.muted}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="small" bold>
                  {formatMoney(invoice.amountCents, invoice.currency)}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {formatShortDate(new Date(invoice.createdAt))}
                  {invoice.source === "BANK_TRANSFER" ? " · Банков превод" : ""}
                  {invoice.number ? ` · № ${invoice.number}` : ""}
                </AppText>
                {invoice.description ? (
                  <AppText variant="caption" tone="muted">
                    {invoice.description}
                  </AppText>
                ) : null}
              </View>
              <Pill tone={status.tone}>{status.label}</Pill>
              {url ? <Icon name="open-outline" size={16} color={colors.muted} /> : null}
            </Pressable>
          </View>
        );
      })}
    </Card>
  );
}
