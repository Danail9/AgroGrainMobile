import { useEffect } from "react";

import { useMe, usePlans } from "@/api/queries";
import { PlanList } from "@/ui/PlanList";
import { QueryBoundary } from "@/ui/QueryBoundary";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

export default function SubscriptionScreen() {
  const me = useMe();
  const plans = usePlans();
  const refetchMe = me.refetch;
  useEffect(() => {
    if (plans.dataUpdatedAt) void refetchMe();
  }, [plans.dataUpdatedAt, refetchMe]);

  return (
    <Screen
      back="/"
      title="Абонамент"
      subtitle="Планове и плащане"
      onRefresh={() => void plans.refetch().then(() => me.refetch())}
      refreshing={plans.isRefetching || me.isRefetching}
    >
      <AppText tone="muted">
        Пълен достъп до времето, цените, новините и AI анализите.
      </AppText>
      <QueryBoundary query={me} stamp={false}>
        {({ user }) => <PlanList role={user.role} onChanged={() => void me.refetch()} />}
      </QueryBoundary>
    </Screen>
  );
}
