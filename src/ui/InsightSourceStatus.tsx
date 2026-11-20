import { formatFullDate, formatHour } from "@/lib/format";
import { AppText } from "@/ui/Text";

export function InsightSourceStatus({ source }: {
  source: { checkOverdue?: boolean; lastCheckedAt?: string | null };
}) {
  if (!source.checkOverdue) return null;
  const checkedAt = source.lastCheckedAt ? new Date(source.lastCheckedAt) : null;
  return (
    <AppText variant="caption" tone="warn">
      {checkedAt
        ? `Запазена публикация · последна проверка в X: ${formatFullDate(checkedAt)}, ${formatHour(checkedAt)}. Наличността може да е променена.`
        : "Запазена публикация · няма скорошна проверка за наличност в X."}
    </AppText>
  );
}
