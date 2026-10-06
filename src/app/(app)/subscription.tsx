import { useMe } from "@/api/queries";
import { PlanList } from "@/ui/PlanList";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

export default function SubscriptionScreen() {
  const me = useMe();

  return (
    <Screen back="/" title="Абонамент" subtitle="Планове и плащане">
      <AppText tone="muted">
        Пълен достъп до времето, цените, новините и AI анализите.
      </AppText>
      <PlanList onChanged={() => void me.refetch()} />
    </Screen>
  );
}
