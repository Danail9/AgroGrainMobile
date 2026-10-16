import { useEffect } from "react";
import { Platform } from "react-native";

import { useInvoices, useMe, usePlans } from "@/api/queries";
import { BillingHistory, RenewalCard } from "@/ui/BillingManagement";
import { PlanList } from "@/ui/PlanList";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";
import { TrialNotice } from "@/ui/TrialNotice";

export default function SubscriptionScreen() {
  const me = useMe();
  const plans = usePlans();
  const invoices = useInvoices();
  const refetchMe = me.refetch;
  useEffect(() => {
    if (plans.dataUpdatedAt) void refetchMe();
  }, [plans.dataUpdatedAt, refetchMe]);

  return (
    <Screen
      back="/"
      title="Абонамент"
      subtitle="Планове и плащане"
      onRefresh={() => void Promise.all([plans.refetch(), invoices.refetch()]).then(() => me.refetch())}
      refreshing={plans.isRefetching || me.isRefetching}
    >
      <AppText tone="muted">
        Пълен достъп до времето, цените, новините и AI анализите.
      </AppText>
      <QueryBoundary query={me} stamp={false}>
        {({ user, subscription }) => (
          <>
            <TrialNotice subscription={subscription} />
            {subscription.trialActive ? (
              <AppText variant="caption" tone="muted">
                Ако купиш план сега, платеният период започва веднага.
              </AppText>
            ) : null}
            <PlanList role={user.role} onChanged={() => void me.refetch()} />
            {subscription.exempt ? null : (
              <>
                <RenewalCard subscription={subscription} />
                {subscription.paymentMethod === "APPLE" ? (
                  <AppText variant="caption" tone="muted">
                    Apple изпраща разписките за App Store покупките. История: Apple ID → Медия и покупки → История на покупките.
                  </AppText>
                ) : null}
                {Platform.OS === "ios" && subscription.paymentMethod === "APPLE" ? null : <BillingHistory />}
              </>
            )}
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}
