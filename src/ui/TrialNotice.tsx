import type { Me } from "@/api/schemas";
import { space } from "@/theme/tokens";
import { Card } from "@/ui/primitives";
import { AppText } from "@/ui/Text";

export function TrialNotice({ subscription }: { subscription: Me["subscription"] }) {
  if (!subscription.trialEndsAt || (!subscription.trialActive && subscription.active)) return null;
  const end = new Intl.DateTimeFormat("bg-BG", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia",
  }).format(new Date(subscription.trialEndsAt));
  return (
    <Card style={{ gap: space.sm }}>
      <AppText variant="small" bold>
        {subscription.trialActive ? "Безплатен пробен месец" : "Пробният месец приключи"}
      </AppText>
      <AppText variant="caption" tone="muted">
        {subscription.trialActive
          ? `Пълен достъп, включително Борса, до ${end}. След това избери платен план, за да продължиш. Няма автоматично таксуване.`
          : "Избери платен план, за да продължиш. Не е извършено автоматично таксуване."}
      </AppText>
    </Card>
  );
}
