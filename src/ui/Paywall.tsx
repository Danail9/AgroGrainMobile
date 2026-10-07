import type { ReactNode } from "react";
import { View } from "react-native";

import type { Me } from "@/api/schemas";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/forms";
import { PlanList } from "@/ui/PlanList";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

/**
 * The inactive-subscription screen: the portal's plans, paid in Stripe's
 * PaymentSheet without leaving the app.
 */
export function Paywall({
  role,
  checking,
  onRefresh,
  actions,
}: {
  role: Me["user"]["role"];
  checking: boolean;
  onRefresh: () => void;
  actions: ReactNode;
}) {
  return (
    <Screen title="Избери абонамент" onRefresh={onRefresh} refreshing={checking}>
      <AppText tone="muted">
        Пълен достъп до времето, цените, новините и AI анализите.
      </AppText>
      <PlanList role={role} onChanged={onRefresh} />
      <View style={{ gap: space.sm }}>
        <Button title="Провери отново" variant="secondary" loading={checking} onPress={onRefresh} />
        {actions}
      </View>
    </Screen>
  );
}
