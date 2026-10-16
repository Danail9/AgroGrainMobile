import type { ReactNode } from "react";
import { View } from "react-native";

import type { Me } from "@/api/schemas";
import { colors, space } from "@/theme/tokens";
import { Button } from "@/ui/forms";
import { Icon } from "@/ui/Icon";
import { PlanList } from "@/ui/PlanList";
import { Card, IconTile, Pill } from "@/ui/primitives";
import { TrialNotice } from "@/ui/TrialNotice";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

/** Inactive accounts buy through Apple on iOS, Stripe on other platforms. */
export function Paywall({
  role,
  checking,
  onRefresh,
  actions,
  subscription,
}: {
  role: Me["user"]["role"];
  checking: boolean;
  onRefresh: () => void;
  actions: ReactNode;
  subscription?: Me["subscription"];
}) {
  return (
    <Screen title="Избери абонамент" onRefresh={onRefresh} refreshing={checking}>
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <IconTile tone="brand" size="lg">
            <Icon name="checkmark-circle-outline" size={24} color={colors.brand[600]} />
          </IconTile>
          <View style={{ flex: 1, gap: space.xs }}>
            <Pill tone="brand">Пълен достъп до AgroGrain</Pill>
            <AppText variant="heading">Всичко важно за стопанството ти</AppText>
          </View>
        </View>
        <AppText variant="small" tone="muted">
          Пазарни цени, прогноза за времето, новини, AI анализи и AgroGrain Борса.
        </AppText>
      </Card>
      {subscription ? <TrialNotice subscription={subscription} /> : null}

      <View style={{ gap: space.xs }}>
        <AppText variant="heading">Избери своя план</AppText>
        <AppText variant="caption" tone="muted">
          Срокът, цената и включените функции са показани при всеки вариант.
        </AppText>
      </View>
      <PlanList role={role} onChanged={onRefresh} />
      <View style={{ gap: space.sm }}>
        <Button title="Провери отново" variant="secondary" loading={checking} onPress={onRefresh} />
        {actions}
      </View>
    </Screen>
  );
}
